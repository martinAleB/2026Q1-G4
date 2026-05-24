# `terraform/` — Root module

Composición principal del proyecto. Materializa la VPC, las tablas DynamoDB, las Lambdas, la API HTTP de API Gateway, el User Pool de Cognito, la cola SQS y el bucket S3 del frontend.

Para el panorama general del proyecto y los pasos de deploy end-to-end, ver el [`README.md`](../README.md) de la raíz del repo.

---

## Estructura de archivos

| Archivo | Contenido |
|---|---|
| `main.tf` | Invocaciones de módulos (VPC + 5 tablas DynamoDB) + data sources + SQS queue. Entry point arquitectónico. |
| `providers.tf` | Provider AWS + `default_tags` (Project, Environment, ManagedBy, Repository). |
| `variables.tf` | Variables de entrada (`stack_name`, `aws_region`, `bucket_name`, CIDRs, runtimes, etc.). |
| `versions.tf` | Pin de Terraform (`~> 1.9`), pin del AWS provider (`~> 6.0`) y backend S3. |
| `locals.tf` | Catálogos: `lambda_sources`, `lambda_configs`, `lambda_permissions`, `lambda_async_dlq_arns`, `api_integrations`, `api_routes`. Centraliza todo lo que se itera con `for_each`. |
| `lambdas.tf` | `aws_lambda_function` con `for_each` sobre `lambda_configs`, permissions, event source mappings, y CloudWatch Event Rule del cron mensual de `portfolio-updater`. |
| `alarms.tf` | `aws_cloudwatch_metric_alarm` sobre la profundidad del DLQ y sobre el contador `Errors` de las Lambdas async/event-driven críticas (`simulations-engine`, `simulations-handler`, `fintech-post-confirmation`, `portfolio-updater`). |
| `api-gateway.tf` | `aws_apigatewayv2_api` (HTTP API), stage, JWT authorizer Cognito, integrations y routes. |
| `auth.tf` | Cognito User Pool + hosted UI domain + App Client + secret en Secrets Manager (consumido por la Lambda `auth-callback`). |
| `frontend.tf` | S3 bucket público del frontend (SSE AES256, website hosting, bucket policy `s3:GetObject` público) + `terraform_data` que dispara el build/deploy del frontend. |
| `outputs.tf` | Outputs consolidados (`api_endpoint`, `auth_*`, `bucket_name`, `website_endpoint`). |
| `modules/network/` | Módulo interno de VPC + subnets + IGW + NAT + RTs + SGs + VPC endpoints. Ver su [`README.md`](modules/network/README.md). |

---

## Variables de entrada

Todas con defaults razonables — solo `bucket_name` es estrictamente requerida (única globalmente en S3).

| Variable | Default | Propósito |
|---|---|---|
| `stack_name` | `cloud-presti` | Prefijo de **todos** los nombres de recursos y tags. Cada integrante del equipo usa su propio valor (ej `cloud-presti`) para que deploys paralelos no choquen. |
| `aws_region` | `us-east-1` | Región. El lab solo permite `us-east-1` y `us-west-2`. |
| `bucket_name` | — (requerida) | Nombre globalmente único del bucket S3 del frontend. Convención: `${stack_name}-frontend-bucket`. |
| `environment` | `lab` | Valor del tag `Environment`. |
| `cognito_domain_suffix` | `""` | Sufijo opcional para el Cognito hosted UI domain si `stack_name` choca globalmente. |
| `vpc_cidr_block` | `10.0.0.0/16` | CIDR de la VPC. |
| `public_subnet_cidrs` | `["10.0.1.0/24", "10.0.4.0/24"]` | CIDRs de las dos subnets públicas (NAT + IGW route). |
| `private_subnet_cidrs` | `["10.0.2.0/24", "10.0.5.0/24"]` | CIDRs de las dos subnets privadas (donde las Lambdas atachan sus ENIs). |
| `lambda_node_runtime` | `nodejs20.x` | Runtime para las 13 Lambdas Node. |
| `lambda_python_runtime` | `python3.12` | Runtime para la Lambda `simulations-engine` (TFLite). |
| `dynamodb_billing_mode` | `PAY_PER_REQUEST` | Billing mode de las 5 tablas. |
| `sqs_visibility_timeout_seconds` | `300` | Visibility timeout del queue de simulaciones. |

---

## Outputs

| Output | Consumido por |
|---|---|
| `api_endpoint` | Frontend (`VITE_SIMULATIONS_API_URL`, `VITE_API_GATEWAY_CALLBACK_URL`) y Cognito (callback URL) |
| `auth_user_pool_id` | (referencia, no se consume en CI hoy) |
| `auth_client_id` | Frontend (`VITE_COGNITO_CLIENT_ID`) |
| `auth_cognito_domain` | Frontend (`VITE_COGNITO_DOMAIN`) |
| `bucket_name` | `aws s3 sync` del frontend al bucket S3 |
| `website_endpoint` | URL final del dashboard servido desde S3 (HTTP) |

---

## Cómo invocarlo

Estos archivos no se invocan directamente con `terraform init/plan/apply` a mano — se ejecutan vía los scripts del repo, que ya configuran el backend y las variables necesarias.

**Local** (después de exportar `STACK_NAME` y las credenciales AWS del lab):

```bash
bash scripts/deploy.sh        # apply completo + build/upload del frontend
bash scripts/destroy.sh       # destroy de toda la infra (preserva el state bucket)
```

**CI**: ver `.github/workflows/terraform-apply.yml` y `terraform-destroy.yml` (trigger manual desde la pestaña Actions).

> **Prerequisito**: el state bucket y la tabla de lock deben existir. Si no, correr primero `bash scripts/bootstrap.sh` (ver [`../terraform-bootstrap/README.md`](../terraform-bootstrap/README.md)).

---

## Deudas técnicas asumidas

### Cognito client secret en el state

El `aws_cognito_user_pool_client.main` se crea con `generate_secret = true`, y su valor se copia a Secrets Manager via `aws_secretsmanager_secret_version` para que la Lambda `auth-callback` lo lea en runtime. Esto evita que el secret esté en env vars de la Lambda — pero como Terraform necesita leer el `client_secret` para escribirlo en Secrets Manager, **el valor también queda guardado en el state file** (`terraform.tfstate` en el bucket S3 de state).

**Mitigaciones que ya están en lugar** (ver [`../terraform-bootstrap/README.md`](../terraform-bootstrap/README.md)):

- State bucket con SSE AES256 y `block_public_acls = true`.
- Bucket policy implícita: solo principals con `s3:GetObject` (LabRole) pueden leerlo.

**Para una migración productiva**: dropear `generate_secret = true`, migrar el frontend y `auth-callback` al flow OAuth 2.0 *authorization code with PKCE* (sin client secret). Elimina toda la dependencia con Secrets Manager y el problema del secret en state.

---

## Convenciones

- **Naming**: `${var.stack_name}-<resource>` para todos los recursos con nombre globally/account-unique (DynamoDB tables, Lambdas, API, SQS, Cognito user pool, secret).
- **Tags**: heredados vía `default_tags` del provider. Cada recurso con tag-support recibe `Project`, `Environment`, `ManagedBy`, `Repository`.
- **Singletons** se llaman `main` (ej `aws_apigatewayv2_api.main`, `aws_sqs_queue.main`, `aws_cognito_user_pool.main`).
- **Lambdas**: 14 en total. 13 se declaran vía `for_each` sobre `local.lambda_configs` para un único patrón sin casos especiales; `auth-callback` se declara standalone en `auth.tf` porque depende de outputs de Cognito que generarían un ciclo si se metiera en el `for_each`.
