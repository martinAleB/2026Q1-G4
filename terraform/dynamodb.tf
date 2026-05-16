module "dynamodb_fintech" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name     = "cloud-presti-fintech"
  hash_key = "sub"

  attributes = [
    { name = "sub", type = "S" },
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = "cloud-presti" }
}

module "dynamodb_producto" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name      = "cloud-presti-producto"
  hash_key  = "sub"
  range_key = "producto_id"

  attributes = [
    { name = "sub",         type = "S" },
    { name = "producto_id", type = "S" },
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = "cloud-presti" }
}

module "dynamodb_usuario" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name      = "cloud-presti-usuario"
  hash_key  = "sub"
  range_key = "cuit"

  attributes = [
    { name = "sub",  type = "S" },
    { name = "cuit", type = "S" },
  ]

  billing_mode = "PAY_PER_REQUEST"
  tags         = { Project = "cloud-presti" }
}
