module "dynamodb_simulations" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name      = "${var.project_name}-simulations"
  hash_key  = "sub"
  range_key = "sk"

  attributes = [
    { name = "sub", type = "S" },
    { name = "sk", type = "S" },
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = var.project_name }
}

module "dynamodb_fintech" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name     = "${var.project_name}-fintech"
  hash_key = "sub"

  attributes = [
    { name = "sub", type = "S" },
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = var.project_name }
}

module "dynamodb_product" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name      = "${var.project_name}-product"
  hash_key  = "sub"
  range_key = "product_id"

  attributes = [
    { name = "sub", type = "S" },
    { name = "product_id", type = "S" },
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = var.project_name }
}

module "dynamodb_user" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name      = "${var.project_name}-user"
  hash_key  = "sub"
  range_key = "cuit"

  attributes = [
    { name = "sub", type = "S" },
    { name = "cuit", type = "S" },
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = var.project_name }
}

module "dynamodb_portfolio" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name      = "${var.project_name}-portfolio"
  hash_key  = "pk"
  range_key = "sk"

  attributes = [
    { name = "pk", type = "S" },
    { name = "sk", type = "S" },
    { name = "gsi1_pk", type = "S" },
    { name = "gsi1_sk", type = "S" },
  ]

  global_secondary_indexes = [
    {
      name               = "gsi1"
      hash_key           = "gsi1_pk"
      range_key          = "gsi1_sk"
      projection_type    = "ALL"
    }
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = var.project_name }
}
