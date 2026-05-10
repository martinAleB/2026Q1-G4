module "vpc" {
  source = "./modules/network"

  vpc_config = {
    name       = "cloud-presti-vpc"
    cidr_block = "10.0.0.0/16"
    region     = "us-east-1"
  }

  subnets_config = [
    # AZ a
    {
      name              = "public-az-a"
      cidr_block        = "10.0.1.0/24"
      availability_zone = "us-east-1a"
    },
    {
      name              = "private-az-a-1"
      cidr_block        = "10.0.2.0/24"
      availability_zone = "us-east-1a"
    },
    {
      name              = "private-az-a-2"
      cidr_block        = "10.0.3.0/24"
      availability_zone = "us-east-1a"
    },
    # AZ b
    {
      name              = "public-az-b"
      cidr_block        = "10.0.4.0/24"
      availability_zone = "us-east-1b"
    },
    {
      name              = "private-az-b-1"
      cidr_block        = "10.0.5.0/24"
      availability_zone = "us-east-1b"
    },
    {
      name              = "private-az-b-2"
      cidr_block        = "10.0.6.0/24"
      availability_zone = "us-east-1b"
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
      subnets = ["private-az-a-1", "private-az-a-2"]
      routes  = []
    },
    {
      name    = "private-rt-az-b"
      subnets = ["private-az-b-1", "private-az-b-2"]
      routes  = []
    },
  ]

  security_groups_config = [
    {
      name    = "lambda-sg"
      inbound = []
      outbound = [
        {
          protocol           = "tcp"
          from_port          = 5432
          to_port            = 5432
          cidr_blocks        = []
          security_group_ref = "rds-proxy-sg"
        },
        {
          protocol           = "tcp"
          from_port          = 443
          to_port            = 443
          cidr_blocks        = []
          security_group_ref = "secretsmanager-endpoint-sg"
        },
      ]
    },
    {
      name = "rds-proxy-sg"
      inbound = [{
        protocol           = "tcp"
        from_port          = 5432
        to_port            = 5432
        cidr_blocks        = []
        security_group_ref = "lambda-sg"
      }]
      outbound = [{
        protocol           = "tcp"
        from_port          = 5432
        to_port            = 5432
        cidr_blocks        = []
        security_group_ref = "rds-sg"
      }]
    },
    {
      name = "rds-sg"
      inbound = [{
        protocol           = "tcp"
        from_port          = 5432
        to_port            = 5432
        cidr_blocks        = []
        security_group_ref = "rds-proxy-sg"
      }]
      outbound = []
    },
    {
      name = "secretsmanager-endpoint-sg"
      inbound = [{
        protocol           = "tcp"
        from_port          = 443
        to_port            = 443
        cidr_blocks        = []
        security_group_ref = "lambda-sg"
      }]
      outbound = []
    },
  ]
}

# LabRole pre-existente en AWS Academy (no se pueden crear IAM roles)
data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier        = "cloud-presti-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  db_name           = "cloudpresti"
  username          = "postgres"
  port              = 5432

  manage_master_user_password = true

  multi_az = true

  create_db_subnet_group = true
  subnet_ids = [
    module.vpc.subnet_ids["10.0.3.0/24"],
    module.vpc.subnet_ids["10.0.6.0/24"],
  ]

  vpc_security_group_ids = [module.vpc.security_group_ids["rds-sg"]]

  backup_retention_period = 7
  skip_final_snapshot     = true
  deletion_protection     = false

  family               = "postgres16"
  major_engine_version = "16"
}

resource "aws_db_proxy" "main" {
  name          = "cloud-presti-proxy"
  engine_family = "POSTGRESQL"
  role_arn      = data.aws_iam_role.lab_role.arn
  vpc_subnet_ids = [
    module.vpc.subnet_ids["10.0.3.0/24"],
    module.vpc.subnet_ids["10.0.6.0/24"],
  ]
  vpc_security_group_ids = [module.vpc.security_group_ids["rds-proxy-sg"]]

  auth {
    auth_scheme = "SECRETS"
    secret_arn  = module.rds.db_instance_master_user_secret_arn
    iam_auth    = "DISABLED"
  }
}

resource "aws_db_proxy_default_target_group" "main" {
  db_proxy_name = aws_db_proxy.main.name
}

resource "aws_db_proxy_target" "main" {
  db_proxy_name          = aws_db_proxy.main.name
  target_group_name      = aws_db_proxy_default_target_group.main.name
  db_instance_identifier = module.rds.db_instance_identifier
}

module "auth" {
  source = "./modules/auth"

  project_name = "cloud-presti"
  region       = "us-east-1"
  frontend_url = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}

# Output (@TODO ver si hay que moverlo o hacer otra cosa)
output "auth_user_pool_id" {
  value = module.auth.user_pool_id
}

output "auth_client_id" {
  value = module.auth.client_id
}

output "auth_cognito_domain" {
  value = module.auth.cognito_domain
}

output "auth_api_gateway_endpoint" {
  value = module.auth.api_gateway_endpoint
}

output "rds_proxy_endpoint" {
  value = aws_db_proxy.main.endpoint
}
