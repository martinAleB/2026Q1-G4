# Cloud Presti — Guía de ejecución

Guía para desplegar la plataforma sobre AWS Academy y operarla desde el dashboard.

## Acerca del proyecto

Plataforma que sugiere productos propios de una Fintech para sus distintos clientes mediante un motor de scoring crediticio basado en datos del BCRA. Proyecto académico para la materia Cloud Computing (ITBA).

### Arquitectura general

```
┌──────────────────────────────────────────────────────────────────────┐
│                          AWS (us-east-1)                             │
│                                                                      │
│   S3 (frontend estático)         VPC 10.0.0.0/16                     │
│   ┌──────────────────┐           ┌─────────────────────────────────┐ │
│   │  React + Vite    │  →  HTTP  │  Subnets públicas (NAT × 2)     │ │
│   │  Dashboard SPA   │   API GW  │  Subnets privadas (Lambdas VPC) │ │
│   └──────────────────┘           └─────────────────────────────────┘ │
│           ↑                                                          │
│           │ JWT (Cognito hosted UI)                                  │
│           │                                                          │
│   Cognito User Pool + Secrets Manager (client secret)                │
│                                                                      │
│   API Gateway HTTP API ──→ 14 Lambdas ──→ DynamoDB (5 tablas)        │
│                                       └→ SQS → simulations-engine    │
│                                                  ↓                   │
│                                             BCRA (via NAT)           │
│                                                  ↓                   │
│                                          DynamoDB simulations        │
│                                                                      │
│   EventBridge cron mensual ──→ portfolio-updater Lambda              │
│                                                                      │
│   SQS DLQ + Lambda async DLQ + EventBridge target DLQ (3 capas)      │
│   CloudWatch Log Groups con retention configurable                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Estructura del repositorio

```
cloud-presti/
├── frontend/               # SPA React + Vite (dashboard fintech)
├── engine/                 # Pipeline Python de training del modelo crediticio
├── backend/                # 14 Lambdas — Node.js (13) + Python (simulations-engine)
├── terraform/              # Stack principal de infra (root module)
│   └── modules/
│       └── network/        # Módulo interno de VPC + subnets + RTs + SGs + endpoints
├── terraform-bootstrap/    # Stack independiente para el state remoto (run una vez)
├── scripts/                # Helpers: bootstrap, deploy, build-engine, build-frontend...
└── .github/
    └── workflows/          # CI (validate) + apply / destroy / bootstrap manuales
```

### Cómo funciona el scoring

1. **Fuente de datos**: archivos del BCRA (`deudores.txt` + `24DSF.txt`).
2. **Features**: ~23 variables por CUIT — situación actual, días de atraso, ratios de cobertura, tendencia a 24 meses, etc.
3. **Modelo**: MLP (TensorFlow/Keras) → `Input → Dense(16, relu) → Dense(1, sigmoid)`.
4. **Score**: valor continuo entre `0.0` (irrecuperable) y `10.0` (excelente).
5. **Recomendación**: el dashboard muestra productos financieros elegibles según el score de cada cliente.

Ver [`engine/README.md`](engine/README.md) para documentación detallada del pipeline de entrenamiento.

---

## 1. Descripción de módulos

La infraestructura se organiza en un módulo interno reutilizable, un módulo público del registry y un stack de bootstrap independiente, todos compuestos por el root module.

### 1.1 Módulo raíz (`terraform/`)

Compone el resto: declara la VPC mediante el módulo `network`, las 5 tablas DynamoDB, la cola SQS y su DLQ, las 14 Lambdas, el HTTP API de API Gateway, el User Pool de Cognito con su client secret en Secrets Manager, los CloudWatch Log Groups con retention, las metric alarms sobre el DLQ y las Lambdas críticas (`terraform/alarms.tf`), el EventBridge cron del portfolio updater y el bucket S3 del frontend. Centraliza en `locals.tf` los catálogos de Lambdas, integraciones y rutas para evitar duplicación de código. Ver [`terraform/README.md`](terraform/README.md) para el detalle archivo por archivo.

### 1.2 Módulo `network` (`terraform/modules/network/`)

Módulo interno que encapsula la VPC y su plano de red. Es declarativo: recibe listas de configuración y materializa los recursos correspondientes.

**Inputs principales:**

| Input | Tipo | Descripción |
|---|---|---|
| `vpc_config` | `object` | Nombre, CIDR y región de la VPC |
| `subnets_config` | `list(object)` | Subnets con AZ y flag `nat_gateway` |
| `route_tables_config` | `list(object)` | Route tables con sus rutas (target `igw` o `nat`) y subnets asociadas |
| `security_groups_config` | `list(object)` | Security groups con reglas inbound/outbound, soporta referencias cruzadas por nombre |
| `vpc_endpoints_config` | `list(object)` | VPC endpoints (Gateway o Interface) con sus subnets / route tables / SGs asociados |

**Outputs:** `vpc_id`, `subnet_ids` (mapa CIDR→ID), `route_table_ids` (mapa nombre→ID), `security_group_ids` (mapa nombre→ID), `nat_gateway_ids`, `vpc_endpoint_ids` (mapa nombre→ID).

**Recursos creados:** `aws_vpc`, `aws_subnet`, `aws_internet_gateway`, `aws_eip`, `aws_nat_gateway`, `aws_route_table`, `aws_route`, `aws_route_table_association`, `aws_security_group`, `aws_security_group_rule`, `aws_vpc_endpoint`.

Ver [`terraform/modules/network/README.md`](terraform/modules/network/README.md) para ejemplos completos de uso.

### 1.3 Módulo público `terraform-aws-modules/dynamodb-table/aws` v4.4.0

Módulo del registry oficial, instanciado **cinco veces** para crear las tablas:

| Tabla (módulo) | Nombre AWS | Hash key | Range key | Propósito |
|---|---|---|---|---|
| `dynamodb_simulations` | `${stack_name}-simulations` | `sub` | `sk` | Resultados de las simulaciones |
| `dynamodb_fintech` | `${stack_name}-fintech` | `sub` | — | Parámetros generales de cada fintech |
| `dynamodb_product` | `${stack_name}-product` | `sub` | `product_id` | Catálogo de productos de cada fintech |
| `dynamodb_user` | `${stack_name}-user` | `sub` | `cuit` | Relación fintech ↔ CUIT consultado |
| `dynamodb_portfolio` | `${stack_name}-portfolio` | `pk` | `sk` (+ `gsi1` inverso + `record-type-pk-index` sparse) | Monitoreo continuo del estado crediticio de CUITs trackeados |

Todas usan `billing_mode = PAY_PER_REQUEST`. Tres GSIs declarados:

- `dynamodb_simulations.task-id-sub-index` (hash `task_id`, range `sub`): lookup directo por `task_id` para `recommendations-get` y `simulations-results`, sin tener que hacer Query por `sub` + `FilterExpression`. La range key `sub` mantiene aislamiento por tenant en la propia KeyCondition.
- `dynamodb_portfolio.gsi1` (hash `gsi1_pk`, range `gsi1_sk`): relación inversa fintech → cuit, leída por `portfolio-get`.
- `dynamodb_portfolio.record-type-pk-index` (hash `record_type`, range `pk`): **sparse GSI** que solo indexa los items `INFO` (las filas `FINTECH#<sub>` no tienen el atributo `record_type`). Usado por el cron `portfolio-updater` para iterar todos los CUITs trackeados sin Scan + FilterExpression.

### 1.4 Stack de bootstrap (`terraform-bootstrap/`)

Stack independiente que crea el bucket S3 del state remoto (versionado, encriptado AES256, public access bloqueado) y la tabla DynamoDB de locking. Se aplica una sola vez por entorno antes de cualquier `terraform apply` del stack principal. Ver [`terraform-bootstrap/README.md`](terraform-bootstrap/README.md).

---

## 2. Explicación de funciones y meta-argumentos

### 2.1 Meta-argumentos

| Meta-argumento | Uso en el proyecto |
|---|---|
| `for_each` | Instancia múltiples recursos del mismo tipo desde un mapa. Se usa para las 14 Lambdas, sus permisos, integraciones y rutas del HTTP API, los 14 CloudWatch Log Groups, las subnets, route tables, security groups y VPC endpoints del módulo `network`, las 5 tablas DynamoDB invocadas como módulos y las alarmas de errores por Lambda crítica |
| `dynamic` | Bloque condicional para argumentos anidados. En `aws_lambda_function.lambdas` envuelve `vpc_config` para inyectarlo solo cuando `each.value.in_vpc == true`, y `dead_letter_config` para Lambdas async opt-in vía `local.lambda_async_dlq_arns` |
| `lifecycle` + `precondition` | Validaciones tempranas en `aws_route` y `aws_vpc_endpoint` del módulo `network`: garantizan invariantes (route `target = "nat"` requiere subnets en la misma AZ con NAT presente; tipo de VPC endpoint válido; campos requeridos por tipo) |
| `depends_on` | Orden explícito: `aws_lambda_function` depende de `aws_cloudwatch_log_group.lambdas` para que el log group con retention exista antes; `terraform_data.build_frontend` depende de Cognito, API Gateway y bucket S3 |
| `provider` | Configurado a nivel root con `default_tags` que propagan `Project`, `Environment`, `ManagedBy` y `Repository` a todos los recursos taggables |
| `count` | No se utiliza; toda iteración pasa por `for_each` para identidades estables por clave |

### 2.2 Funciones

| Función | Uso en el proyecto |
|---|---|
| `flatten()` | Aplana listas anidadas para alimentar `for_each`. Usado en `locals.tf` (permisos de Lambda) y en el módulo `network` (rutas y reglas de SG) |
| `for ... in ...` | Expresiones para construir mapas y listas dinámicamente, e.g. los `subnet_ids` del VPC config se derivan de `var.private_subnet_cidrs` |
| `concat()` | Compone listas heterogéneas: orígenes CORS (bucket + extras) y conjunto completo de Lambdas para los log groups (`for_each` map + auth-callback standalone) |
| `lookup()` | Acceso seguro a mapas con default: `lookup(local.lambda_async_dlq_arns, each.key, null)` para que solo las Lambdas async opt-in tengan DLQ |
| `jsonencode()` | Serializa la bucket policy del frontend y el `redrive_policy` de SQS |
| `filemd5()` | Genera el hash del script `build-frontend.sh` y lo incluye en `triggers_replace` de `terraform_data` |
| `length()`, `contains()`, `keys()`, `distinct()`, `toset()` | Utilidades de manipulación de colecciones para preconditions y composición de mapas |

### 2.3 Otros recursos relevantes

- **`data "archive_file"`**: empaqueta el código fuente de cada Lambda en un ZIP durante el plan/apply. El `source_code_hash` se calcula automáticamente, por lo que un cambio en el código dispara redeploy.
- **`data "aws_iam_role" "lab_role"`**: referencia al rol preexistente `LabRole` de AWS Academy, único IAM role disponible (no se pueden crear roles en el lab).
- **`terraform_data.build_frontend`**: ejecuta `local-exec` con `scripts/build-frontend.sh`. Sus `triggers_replace` (cognito_domain, client_id, api_endpoint, bucket_name, hash del script) garantizan rebuild ante cualquier cambio relevante.
- **`aws_secretsmanager_secret` + `secret_version`**: guardan el client secret de Cognito. La Lambda `auth-callback` lo lee en runtime con cache a nivel de módulo, evitando inyección como env var plana.
- **`aws_sqs_queue.main_dlq`**: dead letter queue compartida. Apuntan ahí: el SQS principal (via `redrive_policy`), las Lambdas async opt-in `portfolio-updater` y `fintech-post-confirmation` (via `dead_letter_config`), y el EventBridge target del cron mensual.
- **`aws_cloudwatch_log_group.lambdas`**: 14 log groups creados explícitamente para fijar `retention_in_days` (default 7) y evitar logs "Never expire" que sangran el budget.
- **`aws_cloudwatch_event_rule.portfolio_updater`**: regla cron mensual que dispara la Lambda de portfolio updates.
- **`local.lambda_defaults`**: defaults compartidos (handler, runtime, timeout, memory) entre el `for_each` y `aws_lambda_function.auth_callback` standalone (separada por dependencia cíclica con Cognito).

---

## 3. Requisitos

- Cuenta AWS Academy Learner Lab con sesión activa (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`). Las credenciales vencen cada 4–12 h.
- Fork del repositorio `cloud-presti` en GitHub.
- Para despliegue local: Terraform ≥ 1.9, AWS CLI v2, Node.js ≥ 20, `uv`, `bash`.

### 3.1 Setup del clone (una sola vez por desarrollador)

El repo incluye `.pre-commit-config.yaml` con hooks de `terraform fmt`, `terraform validate`, TFLint y Checkov que corren automáticamente en cada `git commit`. Para activarlos en tu clone:

```bash
pip install pre-commit
pre-commit install
```

A partir de ahí, los hooks corren solos. Para correrlos manualmente sobre todo el repo:

```bash
pre-commit run --all-files
```

> **Nota**: los hooks de TFLint y Checkov requieren las herramientas instaladas localmente (`brew install tflint` y `pip install checkov`). Si no las tenés, esos hooks fallan al commit — comentalos en `.pre-commit-config.yaml` o instalalos.

---

## 4. Configuración inicial en GitHub

En **Settings → Secrets and variables → Actions** del fork:

**Secrets** (se renuevan en cada sesión del lab):

| Secret | Origen |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS Academy → Start Lab → AWS Details → AWS CLI |
| `AWS_SECRET_ACCESS_KEY` | ídem |
| `AWS_SESSION_TOKEN` | ídem |

**Variables** (una sola, por desarrollador):

| Variable | Descripción | Ejemplo |
|---|---|---|
| `STACK_NAME` | Prefijo único de este deployment. Cada integrante del equipo usa su propio valor para no chocar con los demás (los nombres globales de S3, los IDs de DynamoDB, etc. se derivan automáticamente de esto) | `tincho-presti` |

Los nombres del bucket de state, lock table y bucket del frontend se derivan automáticamente:

- `state_bucket = ${STACK_NAME}-state-bucket`
- `lock_table = ${STACK_NAME}-lock-table`
- `frontend_bucket = ${STACK_NAME}-frontend-bucket`

---

## 5. Despliegue por GitHub Actions (recomendado)

### 5.1 Bootstrap

Crea el bucket de state y la tabla de lock. Se ejecuta **una sola vez por entorno** (o cuando AWS Academy resetea el lab por completo).

1. **Actions → Bootstrap Apply → Run workflow**.
2. Esperar que termine en verde.

### 5.2 Apply

1. Verificar que los tres Secrets de AWS estén vigentes.
2. **Actions → Terraform Apply → Run workflow**.

El workflow encadena dos jobs:

- **`infrastructure`**: instala dependencias de las Lambdas, builda el engine Python, inicializa el backend remoto, valida, hace `terraform plan -out=tfplan`, aplica ese plan exacto, y captura los outputs.
- **`frontend`**: genera `.env.production` con los outputs reales, compila el SPA y sincroniza `dist/` al bucket S3.

Al finalizar, el output `website_endpoint` contiene la URL pública del frontend.

### 5.3 Reaplicar

Cualquier cambio en `terraform/`, `backend/` o `frontend/` se propaga reejecutando **Terraform Apply**. El plan es incremental — solo aplica deltas.

### 5.4 CI (PR validation)

El workflow `CI` corre en cada push y PR. Valida en paralelo:

- **`terraform`**: `fmt -check` + `validate` del stack principal.
- **`terraform-bootstrap`**: idem del bootstrap.
- **`terraform-module-network`**: validate del módulo aislado, atrapa errores que el for_each desde el root no detecta.
- **`engine-build`**: corre `build-engine.sh` completo y verifica que los artefactos esperados (numpy, ai-edge-litert, tflite model) estén en el bundle.
- **`frontend`**: `npm ci` + `npm run build` con un `.env.production` dummy.

Los hooks de `pre-commit` (sección 3.1) replican localmente las verificaciones críticas antes de commit.

---

## 6. Despliegue local (alternativo)

Asume que el bootstrap ya corrió, o que se ejecutará localmente en el paso 6.2.

### 6.1 Variables de entorno

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...

# Una sola variable identifica tu stack. scripts/env.sh deriva el resto.
export STACK_NAME=tincho-presti
```

`scripts/env.sh` (sourceado por todos los scripts principales) deriva automáticamente:

- `TF_VAR_aws_region = us-east-1` (configurable vía `export TF_VAR_aws_region=...`)
- `AWS_DEFAULT_REGION = $TF_VAR_aws_region` (para que los `aws` CLI commands de los scripts usen la misma región que Terraform)
- `TF_VAR_stack_name = $STACK_NAME`
- `TF_STATE_BUCKET = ${STACK_NAME}-state-bucket`
- `TF_LOCK_TABLE = ${STACK_NAME}-lock-table`
- `TF_FRONTEND_BUCKET_NAME = ${STACK_NAME}-frontend-bucket`
- `TF_VAR_bucket_name = $TF_FRONTEND_BUCKET_NAME`

### 6.2 Bootstrap (solo la primera vez)

```bash
bash scripts/bootstrap.sh
```

### 6.3 Apply

```bash
bash scripts/deploy.sh
```

`deploy.sh` orquesta:

1. `install-lambdas.sh` — `npm ci` en cada Lambda Node y `build-engine.sh` para el engine Python (bundle manylinux con TFLite + numpy).
2. `terraform-init.sh` — `terraform init` contra el backend S3 remoto.
3. `terraform-apply.sh` — `terraform apply -auto-approve` del stack principal.
4. `build-frontend.sh` — compila el SPA con los outputs reales y sincroniza a S3.
5. Imprime el `website_endpoint` final.

---

## 7. Verificación post-deploy

Recursos esperados en la cuenta AWS (prefijados con `${STACK_NAME}`):

- **Red**: VPC `10.0.0.0/16` con 4 subnets, 2 NAT Gateways, 1 IGW, 4 route tables, 2 security groups, 2 VPC endpoints (DynamoDB Gateway + SQS Interface).
- **Lambdas**: 14 funciones — `auth-callback`, `fintech-{get, post-confirmation, update}`, `product-{get, create, update, delete}`, `simulations-{handler, results, engine}`, `recommendations-get`, `portfolio-{get, updater}`.
- **DynamoDB**: 5 tablas — `simulations` (con GSI `task-id-sub-index` para lookup por `task_id`), `fintech`, `product`, `user`, `portfolio` (con GSI `gsi1` para listar CUITs por fintech y sparse GSI `record-type-pk-index` para iterar items INFO en el cron).
- **SQS**: 2 colas — `simulations-queue` (principal) y `simulations-queue-dlq` (dead letter).
- **API Gateway**: 1 HTTP API con stage `$default`, 1 JWT authorizer, 10 rutas, throttling configurado.
- **Cognito**: 1 User Pool, 1 hosted UI domain, 1 App Client.
- **Secrets Manager**: 1 secret con el client secret de Cognito.
- **CloudWatch**: 14 log groups con `retention_in_days = 7`, 1 EventBridge rule (cron mensual) + target, y 5 metric alarms (1 sobre la profundidad del DLQ + 4 sobre `Errors` de las Lambdas async/event-driven críticas).
- **S3**: 1 bucket de frontend con SSE AES256, website hosting y bucket policy pública para read.

Smoke tests:

```bash
curl -I "$(terraform -chdir=terraform output -raw website_endpoint)"
curl -i "$(terraform -chdir=terraform output -raw api_endpoint)/callback"
```

---

## 8. Uso de la aplicación

### 8.1 Registro

1. Abrir la URL del `website_endpoint` y seleccionar **Crear cuenta**.
2. Completar email y contraseña (mínimo 8 caracteres, con mayúscula, minúscula y número). El frontend redirige a la Hosted UI de Cognito.
3. Confirmar el email con el código recibido.
4. El trigger `fintech-post-confirmation` crea automáticamente la fila inicial en la tabla `fintech` con los parámetros generales por defecto.
5. Cognito redirige al callback del API Gateway, que canjea el code por tokens consultando el client secret en Secrets Manager.

### 8.2 Configuración de parámetros generales

En **Parámetros**, definir el filtro previo al scoring. Los valores por defecto al momento del registro son:

| Parámetro | Default |
|---|---|
| `max_situacion_crediticia` | 2 |
| `max_entidades_con_deuda` | 3 |
| `max_deuda_total_ars` | 350000 |
| `min_meses_situacion_1` | 6 |
| `max_dias_atraso` | 30 |
| `permite_proceso_judicial` | false |

Cada cambio se persiste vía `PUT /fintech` en la tabla `fintech`. Los clientes que no superan estos umbrales son rechazados antes de ejecutar inferencia.

### 8.3 Alta de productos

En **Productos → Nuevo producto**, completar:

- `name`, `amount`, `installments`, `interest`, `term`.
- `min_score` y `max_score`: rango de score elegible (escala 0–10).
- `priority`: peso comercial 1–10, usado para ordenar las recomendaciones.

Se recomienda definir al menos dos productos con rangos solapados y prioridades distintas para validar el ranking.

### 8.4 Ejecución de una simulación

> **Importante**: antes de ejecutar la primera simulación es necesario haber dado de alta al menos un producto (sección 8.3). Sin productos, la consulta de recomendaciones (sección 8.5) devuelve listas vacías porque no hay nada que rankear contra el score del cliente.

En **Simulaciones → Nueva simulación**, ingresar un CUIT.

Flujo:

1. `POST /simulations` (Lambda `simulations-handler`): registra el CUIT, crea la fila en la tabla `simulations` con `status = PROCESSING` y un `task_id`, traquea el CUIT en `portfolio`, y encola el mensaje en SQS. Las 4 escrituras a DynamoDB se ejecutan en una sola **transacción** (`TransactWriteItems`) → atomicidad garantizada. Responde `202 Accepted`.
2. `simulations-engine` (Python, event source SQS): consulta el BCRA, deriva las features, aplica el filtro de la fintech y ejecuta inferencia TFLite.
3. El estado final se persiste en la misma fila de DynamoDB.

Estados posibles:

| Status | Significado |
|---|---|
| `PROCESSING` | En la cola o en procesamiento |
| `COMPLETED` | Score calculado (`score ∈ [0,1]`) |
| `REJECTED` | No superó el filtro de parámetros generales (ver `rejection_reasons`) |
| `FAILED` | Error definitivo tras reintentos (ver `error_message`) |

Si una invocación falla 3 veces consecutivas, SQS mueve el mensaje al `simulations-queue-dlq` para inspección manual (retention 14 días).

### 8.5 Consulta de recomendaciones

Al abrir el detalle de una simulación `COMPLETED`, el frontend invoca `GET /recommendations?task_id=<id>`. La Lambda `recommendations-get`:

1. Lee la simulación y los productos de la fintech autenticada.
2. Escala el score a `[0, 10]`.
3. Devuelve dos listas:
   - `eligible`: productos cuyo rango `[min_score, max_score]` contiene al score, ordenados por `priority DESC`.
   - `not_eligible`: el resto, con un `reason` que indica si el score quedó por debajo o por encima del rango.

### 8.6 Portfolio (monitoreo continuo)

En **Cartera** se listan los CUITs que esta fintech ya consultó alguna vez. Para cada uno se muestra el `current_status`, el `previous_status` y la tendencia (`up`, `down`, `stable`).

Backend:

- `GET /portfolio` (Lambda `portfolio-get`): lista los CUITs trackeados usando el GSI `gsi1` (acceso por `FINTECH#<sub>` → todos sus CUITs sin scan). Soporta búsqueda por CUIT exacto y paginación.
- **Cron mensual** (EventBridge `cron(0 10 1 * ? *)` → Lambda `portfolio-updater`): el día 1 de cada mes a las 10:00 UTC, escanea todos los CUITs trackeados y actualiza sus estados. **Actualmente es un mock** — randomiza los estados con 20% de chance. La Lambda emite un `console.warn` al inicio explicitando que es mock. Para producción debería invocar al BCRA o reutilizar el `simulations-engine`.
- Si la invocación del cron falla, EventBridge reintenta (hasta 1 hora) y luego deposita el evento en el `main_dlq`. Si el handler Lambda falla por excepción, Lambda reintenta 2 veces y luego también deposita en el `main_dlq`.

---

## 9. Teardown

**Vía GitHub Actions**: **Actions → Terraform Destroy → Run workflow**, tipear `destroy` en el campo de confirmación. Vacía el bucket del frontend y ejecuta `terraform destroy`. El state y la tabla de lock permanecen.

**Vía local**:

```bash
bash scripts/destroy.sh
```

Para eliminar también el bootstrap (state bucket + lock table):

```bash
bash scripts/destroy-bootstrap.sh
```

---

## 10. Troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| `ExpiredToken` / `InvalidClientTokenId` | Credenciales del lab vencidas | Regenerar en AWS Academy y actualizar Secrets/exports |
| `terraform apply` colgado | Lock activo de otra ejecución | Esperar; si quedó huérfano, borrar el ítem en la lock table |
| Simulación en `PROCESSING` indefinido | Error en `simulations-engine` | Revisar CloudWatch Logs del Lambda (`/aws/lambda/${STACK_NAME}-simulations-engine`) y la DLQ |
| Simulación `FAILED` con HTTP 404 | CUIT sin historial BCRA | Esperado; probar con otro CUIT |
| Frontend devuelve 404 en rutas internas | Falta sync del bundle a S3 | Reejecutar el job `frontend` o `scripts/deploy.sh` |
| CORS bloquea el llamado al API | Origen no permitido | El bucket S3 y `localhost:5173` están permitidos por default. Otros orígenes: agregar via `TF_VAR_cors_additional_origins='["..."]'` y reapply |
| Cron de portfolio no corre | Evento sin entrega | Revisar el `main_dlq` para ver si el evento llegó ahí (retry policy del EventBridge target) |

---

## Anexo — Comandos rápidos

```bash
export STACK_NAME=tincho-presti                # tu prefijo único

# Despliegue inicial local
bash scripts/bootstrap.sh
bash scripts/deploy.sh

# Reaplicar
bash scripts/deploy.sh

# Refresh solo del frontend
bash scripts/build-frontend.sh \
  "$(terraform -chdir=terraform output -raw auth_cognito_domain)" \
  "$(terraform -chdir=terraform output -raw auth_client_id)" \
  "$(terraform -chdir=terraform output -raw api_endpoint)" \
  "./frontend" \
  "$(terraform -chdir=terraform output -raw bucket_name)"

# Tail de logs de una Lambda específica
aws logs tail "/aws/lambda/${STACK_NAME}-simulations-engine" --follow --since 5m

# Inspeccionar mensajes en la DLQ
aws sqs receive-message \
  --queue-url $(aws sqs get-queue-url --queue-name ${STACK_NAME}-simulations-queue-dlq --query QueueUrl --output text) \
  --max-number-of-messages 5 \
  --visibility-timeout 0

# Teardown
bash scripts/destroy.sh
```

---

## Documentación adicional

- [`engine/README.md`](engine/README.md) — pipeline de preprocessing y entrenamiento del modelo crediticio.
- [`terraform/README.md`](terraform/README.md) — composición del stack principal, archivos y variables.
- [`terraform/modules/network/README.md`](terraform/modules/network/README.md) — variables, outputs y ejemplos de uso del módulo `network`.
- [`terraform-bootstrap/README.md`](terraform-bootstrap/README.md) — bootstrap del state remoto.
