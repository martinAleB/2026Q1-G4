# `terraform-bootstrap/` — Backend del state de Terraform

Crea los **dos recursos pre-requisito** del flujo principal: el bucket S3 donde vive el `terraform.tfstate` y la tabla DynamoDB que usa Terraform para hacer state locking.

Está separado del root (`../terraform/`) porque el backend S3 del root **necesita que estos recursos existan antes de su primer `init`**. No se puede pedirle a Terraform que se cree su propio backend en el mismo apply.

---

## Cuándo correrlo

**Solo una vez por lab session** (o por integrante del equipo). El state bucket y la lock table son recursos persistentes que sobreviven entre deploys / destroys del root.

- **Primera vez** que un integrante deploya en el lab → correr bootstrap.
- **AWS Academy reseteó el lab** (todo borrado) → correr bootstrap de nuevo.
- Si solo necesitás un nuevo apply del root (no reset) → **NO** tocar bootstrap.

Para teardown total: `bash scripts/destroy-bootstrap.sh` (después de haber destruido la infra del root con `destroy.sh`).

---

## Estructura

| Archivo | Contenido |
|---|---|
| `main.tf` | `aws_s3_bucket` del state (versioning + SSE AES256 + public access block) + `aws_dynamodb_table` para el lock (`LockID` hash key, `PAY_PER_REQUEST`). |
| `providers.tf` | Provider AWS + `default_tags` heredados. |
| `variables.tf` | `region`, `stack_name`, `environment`, `state_bucket_name`, `lock_table_name`. |
| `versions.tf` | Pin de Terraform (`~> 1.9`) y AWS provider (`~> 6.0`). |
| `outputs.tf` | `state_bucket_name` y `lock_table_name` (informativos). |

> **Nota**: este directorio **no tiene backend remoto**. El state queda local (`terraform.tfstate`) — está OK porque solo crea 2 recursos baratos que casi nunca cambian. Si alguna vez se quiere remote backend para esto también, hay que bootstrappear con un bucket pre-existente.

---

## Variables de entrada

| Variable | Default | Propósito |
|---|---|---|
| `region` | `us-east-1` | Región donde se crean los recursos. Tiene que coincidir con la región del root. |
| `stack_name` | `cloud-presti` | Prefijo usado en los tags (Project). Cada integrante usa su propio valor. |
| `environment` | `lab` | Valor del tag Environment. |
| `state_bucket_name` | — (requerida) | Nombre globalmente único del bucket S3. Convención: `${stack_name}-state-bucket`. |
| `lock_table_name` | — (requerida) | Nombre de la tabla DynamoDB para el state lock. Convención: `${stack_name}-lock-table`. |

Los scripts del repo (`scripts/env.sh`) derivan `state_bucket_name`, `lock_table_name` y `TF_VAR_stack_name` automáticamente a partir de `STACK_NAME` — no hace falta exportarlos a mano.

---

## Cómo invocarlo

**Local** (después de exportar `STACK_NAME` y credenciales AWS):

```bash
bash scripts/bootstrap.sh           # apply del bootstrap
bash scripts/destroy-bootstrap.sh   # teardown del bucket + tabla (usar al final del semestre)
```

**CI**: workflow manual `bootstrap-apply.yml` desde la pestaña Actions de GitHub.

---

## Cómo verificar si ya se corrió

```bash
aws s3 ls | grep state-bucket
aws dynamodb list-tables --query 'TableNames' --output text | tr '\t' '\n' | grep lock-table
```

Si ambos aparecen → bootstrap completo, ir directo a `bash scripts/deploy.sh`.

Si no → falta bootstrap o el lab se reseteó.
