locals {
  lambda_defaults = {
    role        = data.aws_iam_role.lab_role.arn
    handler     = "index.handler"
    runtime     = var.lambda_node_runtime
    timeout     = 30
    memory_size = 256
  }

  lambda_sources = {
    "fintech-post-confirmation" = "${path.root}/../backend/fintech-post-confirmation"
    "fintech-get"               = "${path.root}/../backend/fintech-get"
    "fintech-update"            = "${path.root}/../backend/fintech-update"
    "auth-callback"             = "${path.root}/../backend/auth"
    "product-get"               = "${path.root}/../backend/product-get"
    "product-create"            = "${path.root}/../backend/product-create"
    "product-update"            = "${path.root}/../backend/product-update"
    "product-delete"            = "${path.root}/../backend/product-delete"
    "simulations-handler"       = "${path.root}/../backend/simulations/handler"
    "simulations-results"       = "${path.root}/../backend/simulations/results"
    "simulations-engine"        = "${path.root}/../backend/simulations/engine-dist"
    "recommendations-get"       = "${path.root}/../backend/recommendations-get"
    "portfolio-get"             = "${path.root}/../backend/portfolio-get"
    "portfolio-updater"         = "${path.root}/../backend/portfolio-updater"
    "b2b-authorizer"            = "${path.root}/../backend/b2b-authorizer"
    "b2b-evaluations-post"      = "${path.root}/../backend/b2b-evaluations-post"
    "b2b-evaluations-get"       = "${path.root}/../backend/b2b-evaluations-get"
    "api-credentials"           = "${path.root}/../backend/api-credentials"
    "db-migrations"             = "${path.root}/../backend/db"
    "simulate-config"           = "${path.root}/../backend/simulate-config"
  }

  lambda_configs = {
    "fintech-post-confirmation" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_FINTECH_TABLE = module.dynamodb_fintech.dynamodb_table_id
      }
    }
    "fintech-get" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_FINTECH_TABLE = module.dynamodb_fintech.dynamodb_table_id
      }
    }
    "fintech-update" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_FINTECH_TABLE = module.dynamodb_fintech.dynamodb_table_id
      }
    }
    "product-get" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCT_TABLE = module.dynamodb_product.dynamodb_table_id
      }
    }
    "product-create" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCT_TABLE = module.dynamodb_product.dynamodb_table_id
      }
    }
    "product-update" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCT_TABLE = module.dynamodb_product.dynamodb_table_id
      }
    }
    "product-delete" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PRODUCT_TABLE = module.dynamodb_product.dynamodb_table_id
      }
    }
    "simulations-handler" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        SQS_QUEUE_URL       = aws_sqs_queue.main.url
        DYNAMODB_TABLE_NAME = module.dynamodb_simulations.dynamodb_table_id
        DYNAMODB_USER_TABLE = module.dynamodb_user.dynamodb_table_id
      }
    }
    "simulations-results" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_TABLE_NAME = module.dynamodb_simulations.dynamodb_table_id
      }
    }
    "simulations-engine" = {
      handler     = "lambda_function.lambda_handler"
      runtime     = var.lambda_python_runtime
      timeout     = 60
      memory_size = 1024
      in_vpc      = true
      env_vars = {
        DYNAMODB_TABLE_NAME    = module.dynamodb_simulations.dynamodb_table_id
        DYNAMODB_FINTECH_TABLE = module.dynamodb_fintech.dynamodb_table_id
        SQS_QUEUE_URL          = aws_sqs_queue.main.url
        MODEL_ARTIFACTS_BUCKET = aws_s3_bucket.model_artifacts.id
        MODEL_ARTIFACTS_PREFIX = "v1/"
        DB_HOST                = aws_db_proxy.portfolio.endpoint
        DB_PORT                = tostring(aws_db_instance.portfolio.port)
        DB_NAME                = "portfolio"
        DB_SECRET_ARN          = aws_secretsmanager_secret.db_credentials.arn
      }
    }
    "recommendations-get" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_TABLE_NAME    = module.dynamodb_simulations.dynamodb_table_id
        DYNAMODB_PRODUCT_TABLE = module.dynamodb_product.dynamodb_table_id
      }
    }
    "portfolio-get" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DB_HOST       = aws_db_proxy.portfolio.endpoint
        DB_PORT       = tostring(aws_db_instance.portfolio.port)
        DB_NAME       = "portfolio"
        DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      }
    }
    "portfolio-updater" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 300
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DB_HOST       = aws_db_proxy.portfolio.endpoint
        DB_PORT       = tostring(aws_db_instance.portfolio.port)
        DB_NAME       = "portfolio"
        DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      }
    }
    "db-migrations" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 300
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DB_HOST    = aws_db_instance.portfolio.address
        DB_PORT    = tostring(aws_db_instance.portfolio.port)
        DB_NAME    = aws_db_instance.portfolio.db_name
        SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      }
    }
    "simulate-config" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DB_HOST       = aws_db_proxy.portfolio.endpoint
        DB_PORT       = tostring(aws_db_instance.portfolio.port)
        DB_NAME       = "portfolio"
        DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      }
    }
    "b2b-authorizer" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 10
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_API_CLIENTS_TABLE = module.dynamodb_api_clients.dynamodb_table_id
      }
    }
    "b2b-evaluations-post" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        SQS_QUEUE_URL       = aws_sqs_queue.main.url
        DYNAMODB_TABLE_NAME = module.dynamodb_simulations.dynamodb_table_id
        DYNAMODB_USER_TABLE = module.dynamodb_user.dynamodb_table_id
      }
    }
    "b2b-evaluations-get" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_TABLE_NAME    = module.dynamodb_simulations.dynamodb_table_id
        DYNAMODB_PRODUCT_TABLE = module.dynamodb_product.dynamodb_table_id
      }
    }
    "api-credentials" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 30
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_API_CLIENTS_TABLE = module.dynamodb_api_clients.dynamodb_table_id
      }
    }
  }

  lambda_permissions = {
    "auth-callback" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "fintech-get" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "fintech-update" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "fintech-post-confirmation" = [
      { principal = "cognito-idp.amazonaws.com", source_arn = aws_cognito_user_pool.main.arn }
    ]
    "product-get" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "product-create" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "product-update" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "product-delete" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "simulations-handler" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "simulations-results" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "recommendations-get" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "portfolio-get" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "portfolio-updater" = [
      { principal = "events.amazonaws.com", source_arn = aws_cloudwatch_event_rule.portfolio_updater.arn },
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" },
    ]
    "b2b-authorizer" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "b2b-evaluations-post" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "b2b-evaluations-get" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "api-credentials" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
    "simulate-config" = [
      { principal = "apigateway.amazonaws.com", source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*" }
    ]
  }

  lambda_async_dlq_arns = {
    "portfolio-updater"         = aws_sqs_queue.main_dlq.arn
    "fintech-post-confirmation" = aws_sqs_queue.main_dlq.arn
  }

  api_integrations = {
    "auth-callback"       = aws_lambda_function.auth_callback.invoke_arn
    "fintech-get"         = aws_lambda_function.lambdas["fintech-get"].invoke_arn
    "fintech-update"      = aws_lambda_function.lambdas["fintech-update"].invoke_arn
    "product-get"         = aws_lambda_function.lambdas["product-get"].invoke_arn
    "product-create"      = aws_lambda_function.lambdas["product-create"].invoke_arn
    "product-update"      = aws_lambda_function.lambdas["product-update"].invoke_arn
    "product-delete"      = aws_lambda_function.lambdas["product-delete"].invoke_arn
    "simulations-handler" = aws_lambda_function.lambdas["simulations-handler"].invoke_arn
    "simulations-results" = aws_lambda_function.lambdas["simulations-results"].invoke_arn
    "recommendations-get" = aws_lambda_function.lambdas["recommendations-get"].invoke_arn
    "portfolio-get"       = aws_lambda_function.lambdas["portfolio-get"].invoke_arn
    "portfolio-updater"   = aws_lambda_function.lambdas["portfolio-updater"].invoke_arn
    "b2b-evaluations-post" = aws_lambda_function.lambdas["b2b-evaluations-post"].invoke_arn
    "b2b-evaluations-get" = aws_lambda_function.lambdas["b2b-evaluations-get"].invoke_arn
    "api-credentials"     = aws_lambda_function.lambdas["api-credentials"].invoke_arn
    "simulate-config"     = aws_lambda_function.lambdas["simulate-config"].invoke_arn
  }

  api_routes = {
    "callback"            = { route_key = "GET /callback", integration = "auth-callback", auth_type = "NONE" }
    "fintech-get"         = { route_key = "GET /fintech", integration = "fintech-get", auth_type = "JWT" }
    "fintech-patch"       = { route_key = "PATCH /fintech", integration = "fintech-update", auth_type = "JWT" }
    "product-get"         = { route_key = "GET /product", integration = "product-get", auth_type = "JWT" }
    "product-post"        = { route_key = "POST /product", integration = "product-create", auth_type = "JWT" }
    "product-put"         = { route_key = "PUT /product/{id}", integration = "product-update", auth_type = "JWT" }
    "product-delete"      = { route_key = "DELETE /product/{id}", integration = "product-delete", auth_type = "JWT" }
    "simulations-post"    = { route_key = "POST /simulations", integration = "simulations-handler", auth_type = "JWT" }
    "simulations-get"     = { route_key = "GET /simulations", integration = "simulations-results", auth_type = "JWT" }
    "recommendations-get" = { route_key = "GET /recommendations", integration = "recommendations-get", auth_type = "JWT" }
    "portfolio-get"       = { route_key = "GET /portfolio", integration = "portfolio-get", auth_type = "JWT" }
    "portfolio-refresh"   = { route_key = "POST /portfolio/refresh", integration = "portfolio-updater", auth_type = "JWT" }
    "simulate-config-get" = { route_key = "GET /simulations/simulate-config", integration = "simulate-config", auth_type = "JWT" }
    "v1-evaluations-post" = { route_key = "POST /v1/evaluations", integration = "b2b-evaluations-post", auth_type = "CUSTOM" }
    "v1-evaluations-get"  = { route_key = "GET /v1/evaluations", integration = "b2b-evaluations-get", auth_type = "CUSTOM" }
    "api-credentials-get"  = { route_key = "GET /integrations/credentials",  integration = "api-credentials", auth_type = "JWT" }
    "api-credentials-post" = { route_key = "POST /integrations/credentials", integration = "api-credentials", auth_type = "JWT" }
  }
}
