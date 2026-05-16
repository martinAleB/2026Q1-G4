locals {
  lambda_sources = {
    "fintech-post-confirmation" = "${path.root}/../backend/fintech-post-confirmation"
    "fintech-get"               = "${path.root}/../backend/fintech-get"
    "auth-callback"             = "${path.root}/../backend/auth"
    "product-get"               = "${path.root}/../backend/product-get"
    "product-create"            = "${path.root}/../backend/product-create"
    "product-update"            = "${path.root}/../backend/product-update"
    "product-delete"            = "${path.root}/../backend/product-delete"
    "simulations-handler"       = "${path.root}/../backend/simulations/handler"
    "simulations-results"       = "${path.root}/../backend/simulations/results"
    "simulations-engine"        = "${path.root}/../backend/simulations/engine-dist"
  }

  lambda_configs = {
    "fintech-post-confirmation" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_FINTECH_TABLE = module.dynamodb_fintech.dynamodb_table_id
      }
    }
    "fintech-get" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_FINTECH_TABLE = module.dynamodb_fintech.dynamodb_table_id
      }
    }
    "product-get" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCTO_TABLE = module.dynamodb_producto.dynamodb_table_id
      }
    }
    "product-create" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCTO_TABLE = module.dynamodb_producto.dynamodb_table_id
      }
    }
    "product-update" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCTO_TABLE = module.dynamodb_producto.dynamodb_table_id
      }
    }
    "product-delete" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCTO_TABLE = module.dynamodb_producto.dynamodb_table_id
      }
    }
    "simulations-handler" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        SQS_QUEUE_URL       = aws_sqs_queue.simulations.url
        DYNAMODB_TABLE_NAME = aws_dynamodb_table.simulations.name
      }
    }
    "simulations-results" = {
      handler     = "index.handler"
      runtime     = "nodejs20.x"
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_TABLE_NAME = aws_dynamodb_table.simulations.name
      }
    }
    "simulations-engine" = {
      handler     = "lambda_function.lambda_handler"
      runtime     = "python3.12"
      timeout     = 60
      memory_size = 1024
      in_vpc      = true
      env_vars = {
        DYNAMODB_TABLE_NAME = aws_dynamodb_table.simulations.name
      }
    }
  }
}

data "archive_file" "lambdas" {
  for_each    = local.lambda_sources
  type        = "zip"
  source_dir  = each.value
  output_path = "${path.root}/.terraform/archives/${each.key}.zip"
}
