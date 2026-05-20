module "vpc" {
  source = "./modules/network"

  vpc_config = {
    name       = "${var.stack_name}-vpc"
    cidr_block = var.vpc_cidr_block
    region     = var.aws_region
  }

  subnets_config = [
    {
      name              = "public-az-a"
      cidr_block        = var.public_subnet_cidrs[0]
      availability_zone = "${var.aws_region}a"
      nat_gateway       = true
    },
    {
      name              = "private-az-a-1"
      cidr_block        = var.private_subnet_cidrs[0]
      availability_zone = "${var.aws_region}a"
    },
    {
      name              = "public-az-b"
      cidr_block        = var.public_subnet_cidrs[1]
      availability_zone = "${var.aws_region}b"
      nat_gateway       = true
    },
    {
      name              = "private-az-b-1"
      cidr_block        = var.private_subnet_cidrs[1]
      availability_zone = "${var.aws_region}b"
    },
  ]

  route_tables_config = [
    {
      name    = "public-rt-az-a"
      subnets = ["public-az-a"]
      routes = [{
        cidr_block = "0.0.0.0/0"
        target     = "igw"
      }]
    },
    {
      name    = "public-rt-az-b"
      subnets = ["public-az-b"]
      routes = [{
        cidr_block = "0.0.0.0/0"
        target     = "igw"
      }]
    },
    {
      name    = "private-rt-az-a"
      subnets = ["private-az-a-1"]
      routes = [{
        cidr_block = "0.0.0.0/0"
        target     = "nat"
      }]
    },
    {
      name    = "private-rt-az-b"
      subnets = ["private-az-b-1"]
      routes = [{
        cidr_block = "0.0.0.0/0"
        target     = "nat"
      }]
    },
  ]

  security_groups_config = [
    {
      name    = "lambda-sg"
      inbound = []
      outbound = [
        {
          protocol           = "tcp"
          from_port          = 443
          to_port            = 443
          security_group_ref = "interface-endpoints-sg"
          description        = "HTTPS to VPC interface endpoints (SQS, Secrets Manager)"
        },
        {
          protocol    = "tcp"
          from_port   = 443
          to_port     = 443
          cidr_blocks = ["0.0.0.0/0"]
          description = "HTTPS to internet via NAT (BCRA API, Cognito, KMS, public S3)"
        },
        {
          protocol    = "udp"
          from_port   = 53
          to_port     = 53
          cidr_blocks = [var.vpc_cidr_block]
          description = "DNS resolution against the VPC resolver"
        },
      ]
    },
    {
      name = "interface-endpoints-sg"
      inbound = [
        {
          protocol           = "tcp"
          from_port          = 443
          to_port            = 443
          security_group_ref = "lambda-sg"
          description        = "HTTPS from Lambdas to the SQS interface endpoint"
        },
      ]
      outbound = []
    },
  ]

  vpc_endpoints_config = [
    {
      name         = "dynamodb"
      service      = "com.amazonaws.${var.aws_region}.dynamodb"
      type         = "Gateway"
      route_tables = ["private-rt-az-a", "private-rt-az-b"]
    },
    {
      name                = "sqs"
      service             = "com.amazonaws.${var.aws_region}.sqs"
      type                = "Interface"
      subnets             = var.private_subnet_cidrs
      security_group_refs = ["interface-endpoints-sg"]
      private_dns_enabled = true
    },
  ]
}

# Las 5 tablas DynamoDB se materializan a través del módulo externo
# terraform-aws-modules/dynamodb-table/aws v5.5.0 (cumple el requisito del
# TP3 sobre uso de al menos un módulo del registry público). El módulo
# expone una API declarativa para hash/range key, attributes y GSIs.
#
# Nota: el módulo internamente sigue usando hash_key/range_key dentro del
# bloque global_secondary_index, que el AWS provider 6.x marca como
# deprecated en favor de key_schema. Es solo un warning (no error) y la
# funcionalidad sigue intacta hasta que el módulo migre.

module "dynamodb_simulations" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name         = "${var.stack_name}-simulations"
  hash_key     = "sub"
  range_key    = "sk"
  billing_mode = var.dynamodb_billing_mode

  attributes = [
    { name = "sub", type = "S" },
    { name = "sk", type = "S" },
    { name = "task_id", type = "S" },
  ]

  # GSI para lookup directo por task_id (recommendations-get y
  # simulations-results cuando se filtra por task_id). El sort key `sub`
  # mantiene el aislamiento por tenant en la propia KeyCondition: una
  # fintech sólo puede leer simulaciones de su propio sub aunque conozca
  # el task_id de otra. Reemplaza el patrón anterior de Query por sub +
  # FilterExpression task_id, que cobraba RCUs por todas las simulaciones
  # de la fintech antes de filtrar.
  global_secondary_indexes = [
    {
      name            = "task-id-sub-index"
      hash_key        = "task_id"
      range_key       = "sub"
      projection_type = "ALL"
    }
  ]
}

module "dynamodb_fintech" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name         = "${var.stack_name}-fintech"
  hash_key     = "sub"
  billing_mode = var.dynamodb_billing_mode

  attributes = [
    { name = "sub", type = "S" },
  ]
}

module "dynamodb_product" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name         = "${var.stack_name}-product"
  hash_key     = "sub"
  range_key    = "product_id"
  billing_mode = var.dynamodb_billing_mode

  attributes = [
    { name = "sub", type = "S" },
    { name = "product_id", type = "S" },
  ]
}

module "dynamodb_user" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name         = "${var.stack_name}-user"
  hash_key     = "sub"
  range_key    = "cuit"
  billing_mode = var.dynamodb_billing_mode

  attributes = [
    { name = "sub", type = "S" },
    { name = "cuit", type = "S" },
  ]
}

module "dynamodb_portfolio" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name         = "${var.stack_name}-portfolio"
  hash_key     = "pk"
  range_key    = "sk"
  billing_mode = var.dynamodb_billing_mode

  attributes = [
    { name = "pk", type = "S" },
    { name = "sk", type = "S" },
    { name = "gsi1_pk", type = "S" },
    { name = "gsi1_sk", type = "S" },
    { name = "record_type", type = "S" },
  ]

  # gsi1: relación inversa fintech -> cuit. Lo escribe simulations-handler
  # en cada fila FINTECH#<sub>. Lo lee portfolio-get para listar los CUITs
  # trackeados por una fintech.
  #
  # record-type-pk-index: sparse GSI usado por portfolio-updater para
  # iterar SOLO los items INFO (uno por CUIT) sin tener que hacer Scan +
  # FilterExpression sobre toda la tabla (que también incluye filas
  # FINTECH#<sub> que no nos interesan en el cron). Sparse porque las filas
  # FINTECH#<sub> no tienen el atributo record_type, así que ni aparecen
  # en el índice. Hot partition asumida: el hash es siempre "INFO". Para
  # el volumen del proyecto (cientos/miles de CUITs) está dentro de los
  # 3000 RCU por partición.
  global_secondary_indexes = [
    {
      name            = "gsi1"
      hash_key        = "gsi1_pk"
      range_key       = "gsi1_sk"
      projection_type = "ALL"
    },
    {
      name            = "record-type-pk-index"
      hash_key        = "record_type"
      range_key       = "pk"
      projection_type = "ALL"
    }
  ]
}


# Pre-existing LabRole in AWS Academy (IAM roles cannot be created)
data "aws_iam_role" "lab_role" {
  name = "LabRole"
}


resource "aws_sqs_queue" "main_dlq" {
  name                      = "${var.stack_name}-simulations-queue-dlq"
  message_retention_seconds = 1209600 # 14 days, the SQS maximum.
}

resource "aws_sqs_queue" "main" {
  name                       = "${var.stack_name}-simulations-queue"
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds

  # After `sqs_max_receive_count` failed delivery attempts, SQS moves the
  # message to the DLQ instead of dropping it. Lets us inspect what failed
  # (which CUIT, which task_id, what timestamp) without losing the payload.
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.main_dlq.arn
    maxReceiveCount     = var.sqs_max_receive_count
  })
}
