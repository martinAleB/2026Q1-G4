# cloud-presti

Plataforma fintech que sugiere potenciales clientes a entidades financieras mediante un motor de scoring crediticio basado en datos del BCRA. Proyecto académico para la materia Cloud Computing (ITBA).

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS (us-east-1)                      │
│                                                             │
│   S3 (frontend estático)      VPC 10.0.0.0/16              │
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

## Estructura del repositorio

```
cloud-presti/
├── frontend/        # SPA React + Vite (dashboard para entidades financieras)
├── engine/          # Motor de scoring crediticio en Python
├── terraform/       # Infraestructura AWS con Terraform
│   └── modules/
│       └── network/ # Módulo reutilizable de VPC
├── backend/         # (en desarrollo)
└── .github/
    └── workflows/
        └── terraform.yml  # CI/CD de infraestructura
```

## Cómo funciona el scoring

1. **Fuente de datos**: archivos del BCRA (`deudores.txt` + `24DSF.txt`)
2. **Features**: ~23 variables por CUIT — situación actual, días de atraso, ratios de cobertura, tendencia a 24 meses, etc.
3. **Modelo**: MLP (TensorFlow/Keras) → `Input → Dense(16, relu) → Dense(1, sigmoid)`
4. **Score**: valor continuo entre `0.0` (irrecuperable) y `1.0` (excelente)
5. **Recomendación**: el dashboard muestra productos financieros elegibles según el score de cada cliente

Ver [`engine/README.md`](engine/README.md) para documentación detallada del pipeline.

---

## Infraestructura (Terraform)

La infraestructura vive en `terraform/` y se despliega sobre AWS con Terraform >= 1.9.

### Recursos actuales

| Recurso | Descripción |
|---|---|
| `aws_s3_bucket` | Hosting estático del frontend |
| VPC module | VPC con subnets públicas/privadas, NAT Gateways, Internet Gateway y Security Groups |

### Getting started (local)

#### Requisitos

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.9
- [AWS CLI](https://aws.amazon.com/cli/) configurado con credenciales válidas
- Node.js 20+ (para el build del frontend)

#### 1. Crear el bucket de Terraform state (una sola vez)

```bash
aws s3api create-bucket \
  --bucket <tu-bucket-de-state> \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket <tu-bucket-de-state> \
  --versioning-configuration Status=Enabled
```

#### 2. Construir el frontend

```bash
cd frontend
npm ci
npm run build
cd ..
```

#### 3. Inicializar Terraform con tu bucket de state

```bash
cd terraform
terraform init \
  -backend-config="bucket=<tu-bucket-de-state>" \
  -backend-config="key=terraform.tfstate" \
  -backend-config="region=us-east-1"
```

#### 4. Aplicar

```bash
terraform plan -var="bucket_name=<tu-bucket-de-frontend>"
terraform apply -var="bucket_name=<tu-bucket-de-frontend>"
```

---

## CI/CD (GitHub Actions)

El workflow `.github/workflows/terraform.yml` automatiza el despliegue de infraestructura.

### Comportamiento

| Evento | Acción |
|---|---|
| Push a `main` (cambios en `terraform/` o `frontend/`) | Build frontend → `terraform plan` → `terraform apply` |
| PR a `main` (cambios en `terraform/` o `frontend/`) | Build frontend → `terraform plan` (solo muestra cambios, no aplica) |

### Cómo correr el pipeline desde cero

Estos pasos se hacen una sola vez al configurar el repo. Cada integrante usa sus propias credenciales y buckets.

#### 1. Crear el bucket de Terraform state

El state de Terraform se guarda en S3 para que sea compartido entre máquinas y runs del pipeline. Este bucket hay que crearlo **manualmente antes** de correr el pipeline por primera vez (Terraform no puede crearse su propio backend).

Con las credenciales del lab configuradas localmente:

```bash
aws s3api create-bucket \
  --bucket <nombre-unico-para-tu-state> \
  --region us-east-1
```

> Los nombres de buckets son globales en AWS. Usá algo único, por ejemplo `cloud-presti-tfstate-tuapellido`.

#### 2. Configurar Secrets y Variables en GitHub

En tu repositorio: **Settings → Secrets and variables → Actions**

**Secrets** (pestaña "Secrets") — se renuevan con cada sesión del lab:

| Secret | Dónde conseguirlo |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS Academy → Start Lab → "AWS Details" → "AWS CLI" |
| `AWS_SECRET_ACCESS_KEY` | ídem |
| `AWS_SESSION_TOKEN` | ídem |

**Variables** (pestaña "Variables") — se configuran una sola vez:

| Variable | Valor |
|---|---|
| `TF_STATE_BUCKET` | El nombre del bucket que creaste en el paso 1 |
| `TF_FRONTEND_BUCKET_NAME` | Nombre del bucket donde se va a hostear el frontend (también debe ser único, ej: `cloud-presti-frontend-tuapellido`) |

#### 3. Triggerear el pipeline

Cualquier push a `main` que toque archivos en `terraform/` o `frontend/` dispara el pipeline. Si no tenés cambios pendientes:

```bash
git commit --allow-empty -m "ci: trigger pipeline"
git push origin main
```

El progreso se ve en **Actions** del repositorio. Al finalizar, el step **Terraform Apply** muestra el output `website_endpoint` con la URL del frontend.

#### Credenciales vencidas

Las credenciales de AWS Academy vencen cada 4–12 horas. Si el pipeline falla con error de autenticación, actualizá los tres Secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) con los valores nuevos de la consola del lab y volvé a correr el pipeline.

#### Destruir la infraestructura

Para no generar costos cuando no se usa:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...

cd terraform

terraform init \
  -backend-config="bucket=<tu-bucket-de-state>" \
  -backend-config="key=terraform.tfstate" \
  -backend-config="region=us-east-1"

terraform destroy
```

Después eliminar el bucket de state (Terraform no se destruye a sí mismo):

```bash
aws s3 rb s3://<tu-bucket-de-state> --force
```

---

## Módulo de red (network)

Módulo Terraform reutilizable que crea una VPC completa. Ver [`terraform/modules/network/README.md`](terraform/modules/network/README.md) para documentación de variables, outputs y ejemplos de uso.

## Engine de scoring

Pipeline de preprocessing y entrenamiento del modelo crediticio. Ver [`engine/README.md`](engine/README.md).
