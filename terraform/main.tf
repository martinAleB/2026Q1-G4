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
          description = "HTTPS to internet via NAT (BCRA API, Cognito, KMS)"
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
      name         = "s3"
      service      = "com.amazonaws.${var.aws_region}.s3"
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
    {
      name                = "logs"
      service             = "com.amazonaws.${var.aws_region}.logs"
      type                = "Interface"
      subnets             = var.private_subnet_cidrs
      security_group_refs = ["interface-endpoints-sg"]
      private_dns_enabled = true
    },
  ]
}

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

data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

resource "aws_sqs_queue" "main_dlq" {
  name                      = "${var.stack_name}-simulations-queue-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "main" {
  name                       = "${var.stack_name}-simulations-queue"
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.main_dlq.arn
    maxReceiveCount     = var.sqs_max_receive_count
  })
}
