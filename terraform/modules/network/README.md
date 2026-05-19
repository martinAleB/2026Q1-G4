# Modulo de Red (network)

Modulo de Terraform para configurar una VPC completa en AWS, incluyendo subnets, internet gateway, NAT gateways, route tables y security groups.

Requiere Terraform >= 1.3 y AWS provider ~> 6.42.

---

## Recursos que crea

| Recurso | Descripcion |
|---|---|
| `aws_vpc` | VPC principal |
| `aws_subnet` | Una subnet por cada elemento en `subnets_config` |
| `aws_internet_gateway` | Un IGW por VPC |
| `aws_eip` + `aws_nat_gateway` | Un NAT GW por cada subnet con `nat_gateway = true` |
| `aws_route_table` | Una route table por cada elemento en `route_tables_config` |
| `aws_route` | Una ruta por cada entrada en `routes`, mas rutas implicitas al IGW |
| `aws_route_table_association` | Asociacion entre subnets y route tables |
| `aws_security_group` + `aws_security_group_rule` | Un SG con sus reglas por cada elemento en `security_groups_config` |
| `aws_vpc_endpoint` | Un endpoint (Gateway o Interface) por cada elemento en `vpc_endpoints_config` |

---

## Variables

### `vpc_config` (requerido)

Configuracion basica de la VPC.

| Campo | Tipo | Descripcion |
|---|---|---|
| `name` | `string` | Nombre de la VPC. Se usa como prefijo en todos los recursos. |
| `cidr_block` | `string` | CIDR block de la VPC (ej: `"10.0.0.0/16"`) |
| `region` | `string` | Region de AWS (ej: `"us-east-1"`) |

---

### `subnets_config` (requerido)

Lista de subnets a crear dentro de la VPC.

| Campo | Tipo | Default | Descripcion |
|---|---|---|---|
| `name` | `string` | — | Nombre de la subnet. Se usa para referenciarla en `route_tables_config`. El nombre efectivo en AWS sera `<vpc_name>-<name>`. |
| `cidr_block` | `string` | — | CIDR block de la subnet (ej: `"10.0.1.0/24"`) |
| `availability_zone` | `string` | — | AZ donde se crea la subnet (ej: `"us-east-1a"`) |
| `nat_gateway` | `bool` | `false` | Si es `true`, se crea un NAT Gateway en esta subnet. |

---

### `route_tables_config` (opcional, default: `[]`)

Lista de route tables a crear y asociar a subnets.

| Campo | Tipo | Descripcion |
|---|---|---|
| `name` | `string` | Nombre de la route table |
| `subnets` | `list(string)` | Lista de nombres de subnets a asociar |
| `routes` | `list(object)` | Lista de rutas. Ver detalle abajo. |

#### Rutas (`routes`)

| Campo | Tipo | Descripcion |
|---|---|---|
| `cidr_block` | `string` | CIDR de destino (ej: `"0.0.0.0/0"`) |
| `target` | `string` | Target de la ruta. Ver valores posibles abajo. |

**Valores posibles para `target`:**

| Valor | Descripcion |
|---|---|
| `"igw"` | Enruta hacia el Internet Gateway |
| `"nat"` | Enruta hacia el NAT Gateway de la AZ de las subnets asociadas a esta route table. Todas las subnets deben estar en la misma AZ. Falla si no existe un NAT Gateway en esa AZ. |

---

### `security_groups_config` (opcional, default: `[]`)

Lista de security groups a crear.

| Campo | Tipo | Descripcion |
|---|---|---|
| `name` | `string` | Nombre del security group. El nombre efectivo en AWS sera `<vpc_name>-<name>`. |
| `inbound` | `list(object)` | Reglas de trafico entrante |
| `outbound` | `list(object)` | Reglas de trafico saliente |

#### Reglas (`inbound` / `outbound`)

| Campo | Tipo | Default | Descripcion |
|---|---|---|---|
| `protocol` | `string` | — | Protocolo: `"tcp"`, `"udp"`, `"icmp"`, `"-1"` (todos) |
| `from_port` | `number` | — | Puerto inicial del rango |
| `to_port` | `number` | — | Puerto final del rango |
| `cidr_blocks` | `list(string)` | `[]` | Lista de CIDRs de origen/destino |
| `security_group_ref` | `string` | `null` | Nombre de otro SG definido en este modulo, o ID de un SG externo |

`cidr_blocks` y `security_group_ref` son mutuamente excluyentes. Definir ambos en la misma regla produce un error de AWS.

---

### `vpc_endpoints_config` (opcional, default: `[]`)

Lista de VPC endpoints a crear y asociar a la VPC. Soporta los dos tipos: Gateway (DynamoDB, S3) e Interface (SQS, Secrets Manager, etc).

| Campo | Tipo | Default | Descripcion |
|---|---|---|---|
| `name` | `string` | — | Nombre logico del endpoint (se usa como tag y como key en el output `vpc_endpoint_ids`). |
| `service` | `string` | — | Nombre completo del servicio AWS (ej: `"com.amazonaws.us-east-1.sqs"`). |
| `type` | `string` | — | `"Gateway"` o `"Interface"`. |
| `route_tables` | `list(string)` | `[]` | **Solo Gateway**. Lista de nombres de route tables (de `route_tables_config`) a las que se agrega la ruta al endpoint. Requerido para Gateway. |
| `subnets` | `list(string)` | `[]` | **Solo Interface**. Lista de CIDRs (de `subnets_config`) donde se crean las ENIs. Requerido para Interface. |
| `security_group_refs` | `list(string)` | `[]` | **Solo Interface**. Lista de nombres de SGs (de `security_groups_config`) que se aplican a las ENIs. |
| `private_dns_enabled` | `bool` | `false` | **Solo Interface**. Si es `true`, el endpoint registra el DNS privado del servicio. |

Validaciones (preconditions):
- `type` debe ser exactamente `"Gateway"` o `"Interface"`.
- Si `type = "Gateway"`, `route_tables` no puede estar vacio.
- Si `type = "Interface"`, `subnets` no puede estar vacio.

Ejemplo:

```hcl
vpc_endpoints_config = [
  {
    name         = "dynamodb"
    service      = "com.amazonaws.us-east-1.dynamodb"
    type         = "Gateway"
    route_tables = ["private-rt-1a", "private-rt-1b"]
  },
  {
    name                = "sqs"
    service             = "com.amazonaws.us-east-1.sqs"
    type                = "Interface"
    subnets             = ["10.0.3.0/24", "10.0.4.0/24"]
    security_group_refs = ["interface-endpoints-sg"]
    private_dns_enabled = true
  },
]
```

---

## Outputs

| Output | Tipo | Descripcion |
|---|---|---|
| `vpc_id` | `string` | ID de la VPC |
| `subnet_ids` | `map(string)` | Mapa de `cidr_block => subnet_id` |
| `nat_gateway_ids` | `map(string)` | Mapa de `cidr_block => nat_gateway_id` |
| `route_table_ids` | `map(string)` | Mapa de `name => route_table_id` |
| `security_group_ids` | `map(string)` | Mapa de `name => security_group_id` |
| `vpc_endpoint_ids` | `map(string)` | Mapa de `name => vpc_endpoint_id` |

---

## Ejemplo de uso

```hcl
module "vpc" {
  source = "./modules/network"

  vpc_config = {
    name       = "my-vpc"
    cidr_block = "10.0.0.0/16"
    region     = "us-east-1"
  }

  subnets_config = [
    {
      name              = "public-1a"
      cidr_block        = "10.0.1.0/24"
      availability_zone = "us-east-1a"
      nat_gateway       = true
    },
    {
      name              = "public-1b"
      cidr_block        = "10.0.2.0/24"
      availability_zone = "us-east-1b"
      nat_gateway       = true
    },
    {
      name              = "private-1a"
      cidr_block        = "10.0.3.0/24"
      availability_zone = "us-east-1a"
    },
    {
      name              = "private-1b"
      cidr_block        = "10.0.4.0/24"
      availability_zone = "us-east-1b"
    }
  ]

  route_tables_config = [
    {
      name    = "public-rt-1a"
      subnets = ["public-1a"]
      routes  = [
        { cidr_block = "0.0.0.0/0", target = "igw" }
      ]
    },
    {
      name    = "public-rt-1b"
      subnets = ["public-1b"]
      routes  = [
        { cidr_block = "0.0.0.0/0", target = "igw" }
      ]
    },
    {
      name    = "private-rt-1a"
      subnets = ["private-1a"]
      routes  = [
        { cidr_block = "0.0.0.0/0", target = "nat" }
      ]
    },
    {
      name    = "private-rt-1b"
      subnets = ["private-1b"]
      routes  = [
        { cidr_block = "0.0.0.0/0", target = "nat" }
      ]
    }
  ]

  security_groups_config = [
    {
      name = "app-sg"
      inbound = [
        {
          protocol    = "tcp"
          from_port   = 443
          to_port     = 443
          cidr_blocks = ["0.0.0.0/0"]
        }
      ]
      outbound = [
        {
          protocol    = "tcp"
          from_port   = 5432
          to_port     = 5432
          security_group_ref = "db-sg"
        }
      ]
    },
    {
      name = "db-sg"
      inbound = [
        {
          protocol           = "tcp"
          from_port          = 5432
          to_port            = 5432
          security_group_ref = "app-sg"
        }
      ]
      outbound = []
    }
  ]
}
```

### Referenciar outputs en otros modulos

```hcl
module "compute" {
  source = "./modules/compute"

  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.subnet_ids
  security_group_ids = module.vpc.security_group_ids
}
```
