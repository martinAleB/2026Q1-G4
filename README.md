# Cloud Presti — Guía de ejecución

Guía para desplegar la plataforma sobre AWS Academy y operarla desde el dashboard.

## Acerca del proyecto

Plataforma fintech que sugiere potenciales clientes a entidades financieras mediante un motor de scoring crediticio basado en datos del BCRA. Proyecto académico para la materia Cloud Computing (ITBA).

### Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS (us-east-1)                      │
│                                                             │
│   S3 (frontend estático)      VPC 10.0.0.0/16               │
│   ┌──────────────────┐        ┌──────────────────────────┐  │
│   │  React + Vite    │        │  Subnets públicas (NAT)  │  │
│   │  Dashboard SPA   │        │  Subnets privadas        │  │
│   └──────────────────┘        └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↑
         │ terraform apply (GitHub Actions)
         │
┌─────────────────┐
│  Python Engine  │  ← datos BCRA → preprocessing → MLP → score 0.0–1.0
└─────────────────┘
```

### Estructura del repositorio

```
cloud-presti/
├── frontend/        # SPA React + Vite (dashboard para entidades financieras)
├── engine/          # Motor de scoring crediticio en Python
├── terraform/       # Infraestructura AWS con Terraform
│   └── modules/
│       └── network/ # Módulo reutilizable de VPC
├── backend/         # Lambdas Node.js + engine Python (SQS consumer)
└── .github/
    └── workflows/   # CI/CD de infraestructura y frontend
```

### Cómo funciona el scoring

1. **Fuente de datos**: archivos del BCRA (`deudores.txt` + `24DSF.txt`).
2. **Features**: ~23 variables por CUIT — situación actual, días de atraso, ratios de cobertura, tendencia a 24 meses, etc.
3. **Modelo**: MLP (TensorFlow/Keras) → `Input → Dense(16, relu) → Dense(1, sigmoid)`.
4. **Score**: valor continuo entre `0.0` (irrecuperable) y `1.0` (excelente).
5. **Recomendación**: el dashboard muestra productos financieros elegibles según el score de cada cliente.

Ver [`engine/README.md`](engine/README.md) para documentación detallada del pipeline de entrenamiento.

## 1. Descripción de módulos

La infraestructura se organiza en un módulo interno y un módulo público reutilizable, además de la raíz que actúa como composición.

### 1.1 Módulo raíz (`terraform/`)

Compone el resto: declara la VPC mediante el módulo `network`, las cuatro tablas DynamoDB, la cola SQS, el conjunto de Lambdas, el HTTP API de API Gateway, el User Pool de Cognito y el bucket S3 del frontend. Centraliza en `locals.tf` los catálogos de Lambdas, integraciones y rutas para evitar duplicación de código.

### 1.2 Módulo `network` (`terraform/modules/network/`)

Módulo interno que encapsula la creación de la VPC y su plano de red. Es declarativo: recibe listas de configuración (`vpc_config`, `subnets_config`, `route_tables_config`, `security_groups_config`) y materializa los recursos correspondientes.

**Inputs principales:**

| Input | Tipo | Descripción |
|---|---|---|
| `vpc_config` | `object` | Nombre, CIDR y región de la VPC |
| `subnets_config` | `list(object)` | Subnets con AZ y flag `nat_gateway` |
| `route_tables_config` | `list(object)` | Route tables con sus rutas y subnets asociadas |
| `security_groups_config` | `list(object)` | Security groups con reglas inbound/outbound |

**Outputs:** `vpc_id`, `subnet_ids` (mapa CIDR→ID), `route_table_ids` (mapa nombre→ID), `security_group_ids` (mapa nombre→ID), `nat_gateway_ids`.

**Recursos creados:** `aws_vpc`, `aws_subnet`, `aws_internet_gateway`, `aws_eip`, `aws_nat_gateway`, `aws_route_table`, `aws_route`, `aws_route_table_association`, `aws_security_group`, `aws_security_group_rule`.

### 1.3 Módulo público `terraform-aws-modules/dynamodb-table/aws` v4.4.0

Módulo del registry oficial, instanciado cuatro veces para crear las tablas `cloud-presti-simulations`, `cloud-presti-fintech`, `cloud-presti-producto` y `cloud-presti-usuario`. Todas usan `billing_mode = PAY_PER_REQUEST` y partition key `sub` (claim del JWT de Cognito) para aislamiento por tenant.

### 1.4 Módulo de bootstrap (`terraform-bootstrap/`)

Stack independiente que crea el bucket S3 del state remoto (versionado y cifrado con SSE-S3) y la tabla DynamoDB de locking. Se aplica una sola vez por entorno, antes de cualquier `terraform apply` sobre el stack principal.

## 2. Explicación de funciones y meta-argumentos

### 2.1 Meta-argumentos

| Meta-argumento | Uso en el proyecto |
|---|---|
| `for_each` | Instancia múltiples recursos del mismo tipo desde un mapa. Se usa para declarar las 11 Lambdas genéricas, sus permisos, los event source mappings, las integraciones y rutas del HTTP API, las subnets, route tables y security groups del módulo `network` |
| `dynamic` | Bloque condicional para argumentos anidados. En `aws_lambda_function` envuelve `vpc_config` para inyectarlo solo cuando `each.value.in_vpc == true` |
| `lifecycle` + `precondition` | Validaciones tempranas en `aws_route` del módulo `network`: garantizan que una ruta `target = "nat"` solo se declare si todas las subnets de la route table están en la misma AZ y existe un NAT Gateway en esa AZ |
| `depends_on` | Orden explícito en `terraform_data.build_frontend` para asegurar que Cognito, API Gateway y el bucket S3 estén listos antes de compilar el frontend |
| `count` | No se utiliza; toda iteración pasa por `for_each` para mantener identidades estables por clave |

### 2.2 Funciones

| Función | Uso en el proyecto |
|---|---|
| `flatten()` | Aplana listas anidadas para alimentar `for_each`. Se usa en `locals.tf` (permisos y event sources) y en el módulo `network` (rutas y reglas de SG) |
| `for ... in ...` | Expresiones para construir mapas y listas a partir de las listas de configuración del módulo `network` |
| `jsonencode()` | Serializa la bucket policy del frontend a JSON en `frontend.tf` |
| `filemd5()` | Genera el hash del script `build-frontend.sh` y lo incluye en `triggers_replace` de `terraform_data` para que un cambio en el script fuerce el rebuild |
| `length()` | Validaciones de cantidad en preconditions y en reglas de SG |
| `contains()` | Verifica pertenencia a un conjunto en preconditions y en la resolución de referencias entre SGs por nombre |
| `keys()` | Extrae las claves de un mapa para validar contra ellas en preconditions |
| `distinct()` | Elimina duplicados al calcular las AZs únicas de una route table |
| `toset()` | Convierte la lista de nombres de SG en un set para chequeos de pertenencia |

### 2.3 Otros recursos relevantes

- **`data "archive_file"`**: empaqueta el código fuente de cada Lambda en un ZIP durante el plan/apply. El `source_code_hash` se calcula automáticamente, por lo que un cambio en el código dispara el redeploy de la Lambda.
- **`data "aws_iam_role" "lab_role"`**: referencia al rol preexistente `LabRole` de AWS Academy, único IAM role disponible en el entorno del lab.
- **`terraform_data`**: recurso utilizado para ejecutar el provisioner `local-exec` que compila y sincroniza el frontend, con `triggers_replace` que detectan cambios en los outputs relevantes.

## 3. Requisitos

- Cuenta AWS Academy Learner Lab con sesión activa (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`). Las credenciales vencen cada 4–12 h.
- Fork del repositorio `cloud-presti` en GitHub.
- Para despliegue local: Terraform ≥ 1.9, AWS CLI v2, Node.js ≥ 20, `uv`, `bash`.

## 4. Configuración inicial en GitHub

En **Settings → Secrets and variables → Actions** del fork:

**Secrets** (se renuevan en cada sesión del lab):

| Secret | Origen |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS Academy → Start Lab → AWS Details → AWS CLI |
| `AWS_SECRET_ACCESS_KEY` | ídem |
| `AWS_SESSION_TOKEN` | ídem |

**Variables** (única vez):

| Variable | Descripción |
|---|---|
| `TF_STATE_BUCKET` | Bucket S3 del state remoto de Terraform |
| `TF_LOCK_TABLE` | Tabla DynamoDB de state locking |
| `TF_FRONTEND_BUCKET_NAME` | Bucket S3 del sitio estático (nombre único global) |

## 5. Despliegue por GitHub Actions (recomendado)

### 5.1 Bootstrap

Crea el bucket de state y la tabla de lock. Se ejecuta una sola vez por entorno.

1. **Actions → Bootstrap Apply → Run workflow**.
2. Esperar que termine en verde.

### 5.2 Apply

1. Verificar que los tres Secrets de AWS estén vigentes.
2. **Actions → Terraform Apply → Run workflow**.

El workflow encadena dos jobs:

- `infrastructure`: instala dependencias de las Lambdas, inicializa el backend remoto, valida, planea y aplica la infra completa (VPC, Cognito, API Gateway, Lambdas, DynamoDB, SQS, S3, VPC endpoints), y captura los outputs.
- `frontend`: genera `.env.production` con los outputs reales, compila el SPA y sincroniza `dist/` al bucket S3.

Al finalizar, el output `website_endpoint` contiene la URL pública del frontend.

### 5.3 Reaplicar

Cualquier cambio en `terraform/`, `backend/` o `frontend/` se propaga reejecutando **Terraform Apply**.

## 6. Despliegue local (alternativo)

Asume que el bootstrap ya corrió, o que se ejecutará localmente en el paso 6.2.

### 6.1 Variables de entorno

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...
export AWS_DEFAULT_REGION=us-east-1

export TF_STATE_BUCKET=...
export TF_LOCK_TABLE=...
export TF_FRONTEND_BUCKET_NAME=...
export TF_VAR_bucket_name=$TF_FRONTEND_BUCKET_NAME
```

### 6.2 Bootstrap (solo la primera vez)

```bash
bash scripts/bootstrap.sh
```

### 6.3 Apply

```bash
bash scripts/deploy.sh
```

`deploy.sh` orquesta:

1. Instalación de dependencias de las Lambdas Node y empaquetado del engine Python contra `manylinux_2_28`.
2. `terraform init` contra el backend remoto.
3. `terraform apply -auto-approve`.
4. Build del frontend con los outputs de Terraform y `aws s3 sync` al bucket.
5. Impresión del `website_endpoint` final.

## 7. Verificación post-deploy

Recursos esperados en la cuenta AWS:

- VPC `10.0.0.0/16` con 4 subnets, 2 NAT Gateways e IGW.
- 12 Lambdas con prefijo `cloud-presti-`.
- 4 tablas DynamoDB: `simulations`, `fintech`, `producto`, `usuario`.
- 1 cola SQS `cloud-presti-simulations-queue`.
- 1 HTTP API en API Gateway v2.
- 1 User Pool de Cognito con dominio Hosted UI.
- 1 bucket S3 con static website hosting.

Smoke tests:

```bash
curl -I "$(terraform -chdir=terraform output -raw website_endpoint)"
curl -i "$(terraform -chdir=terraform output -raw simulations_api_endpoint)/callback"
```

## 8. Uso de la aplicación

### 8.1 Registro

1. Abrir la URL del `website_endpoint` y seleccionar **Crear cuenta**.
2. Completar email y contraseña (mínimo 8 caracteres, con mayúscula, minúscula y número). El frontend redirige a la Hosted UI de Cognito.
3. Confirmar el email con el código recibido.
4. El trigger `fintech-post-confirmation` crea automáticamente la fila inicial en `cloud-presti-fintech` con los parámetros generales por defecto.
5. Cognito redirige al callback del API Gateway; los JWT quedan disponibles en el frontend para autenticar las siguientes requests.

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

Cada cambio se persiste vía `PUT /fintech` en la tabla `cloud-presti-fintech`. Los clientes que no superan estos umbrales son rechazados antes de ejecutar inferencia.

### 8.3 Alta de productos

En **Productos → Nuevo producto**, completar:

- Nombre comercial, monto, cuotas, tasa de interés.
- `min_score` y `max_score`: rango de score elegible (escala 0–10).
- `prioridad`: peso comercial 1–10, usado para ordenar las recomendaciones.

Se recomienda definir al menos dos productos con rangos solapados y prioridades distintas para validar el ranking.

### 8.4 Ejecución de una simulación

En **Simulaciones → Nueva simulación**, ingresar un CUIT.

Flujo:

1. `POST /simulations` (Lambda `simulations-handler`): registra el CUIT, crea la fila en `cloud-presti-simulations` con `status = PROCESSING` y un `task_id`, y encola el mensaje en SQS. Responde `202 Accepted`.
2. `simulations-engine` (Python, event source SQS): consulta el BCRA, deriva las features, aplica el filtro de la fintech y ejecuta inferencia TFLite.
3. El estado final se persiste en la misma fila de DynamoDB.

Estados posibles:

| Status | Significado |
|---|---|
| `PROCESSING` | En la cola o en procesamiento |
| `COMPLETED` | Score calculado (`score ∈ [0,1]`) |
| `REJECTED` | No superó el filtro de parámetros generales (`rejection_reasons`) |
| `FAILED` | Error definitivo tras reintentos (`error_message`) |

Ante fallos transitorios, el engine reencola con back-off (60/120/240/480 s).

### 8.5 Consulta de recomendaciones

Al abrir el detalle de una simulación `COMPLETED`, el frontend invoca `GET /recomendaciones?task_id=<id>`. La Lambda `recommendations-get`:

1. Lee la simulación y los productos de la fintech autenticada.
2. Escala el score a `[0, 10]`.
3. Devuelve dos listas:
   - `elegibles`: productos cuyo rango `[min_score, max_score]` contiene al score, ordenados por `prioridad DESC`.
   - `no_elegibles`: el resto, con un `motivo` que indica si el score quedó por debajo o por encima del rango.

## 9. Teardown

**Vía GitHub Actions**: **Actions → Terraform Destroy → Run workflow**, tipear `destroy` en el campo de confirmación. Vacía el bucket del frontend y ejecuta `terraform destroy`. El state y la tabla de lock permanecen.

**Vía local**:

```bash
bash scripts/destroy.sh
```

Para eliminar también el bootstrap:

```bash
bash scripts/destroy-bootstrap.sh
```

## 10. Troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| `ExpiredToken` / `InvalidClientTokenId` | Credenciales del lab vencidas | Regenerar en AWS Academy y actualizar Secrets/exports |
| `terraform apply` colgado | Lock activo de otra ejecución | Esperar; si quedó huérfano, borrar el ítem en `TF_LOCK_TABLE` |
| Simulación en `PROCESSING` indefinido | Error en `simulations-engine` | Revisar CloudWatch Logs del Lambda |
| Simulación `FAILED` con HTTP 404 | CUIT sin historial BCRA | Esperado; probar con otro CUIT |
| Frontend devuelve 404 en rutas internas | Falta sync del bundle a S3 | Reejecutar el job `frontend` o `scripts/deploy.sh` |
| CORS bloquea el llamado al API | Header `Authorization` ausente | Verificar que el frontend esté enviando el JWT |

## Anexo — Comandos rápidos

```bash
# Despliegue inicial local
bash scripts/bootstrap.sh
bash scripts/deploy.sh

# Reaplicar
bash scripts/deploy.sh

# Refresh solo del frontend
bash scripts/build-frontend.sh \
  "$(terraform -chdir=terraform output -raw auth_cognito_domain)" \
  "$(terraform -chdir=terraform output -raw auth_client_id)" \
  "$(terraform -chdir=terraform output -raw auth_api_gateway_endpoint)" \
  "$(terraform -chdir=terraform output -raw simulations_api_endpoint)" \
  "./frontend" \
  "$(terraform -chdir=terraform output -raw bucket_name)"

# Teardown
bash scripts/destroy.sh
```

## Documentación adicional

- [`engine/README.md`](engine/README.md) — pipeline de preprocessing y entrenamiento del modelo crediticio.
- [`terraform/modules/network/README.md`](terraform/modules/network/README.md) — variables, outputs y ejemplos de uso del módulo `network`.
