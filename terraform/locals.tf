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
        SQS_QUEUE_URL            = aws_sqs_queue.main.url
        DYNAMODB_TABLE_NAME      = module.dynamodb_simulations.dynamodb_table_id
        DYNAMODB_USER_TABLE      = module.dynamodb_user.dynamodb_table_id
        DYNAMODB_PORTFOLIO_TABLE = module.dynamodb_portfolio.dynamodb_table_id
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
        DYNAMODB_PORTFOLIO_TABLE = module.dynamodb_portfolio.dynamodb_table_id
      }
    }
    "portfolio-updater" = {
      handler     = "index.handler"
      runtime     = var.lambda_node_runtime
      timeout     = 300
      memory_size = 256
      in_vpc      = true
      env_vars = {
        DYNAMODB_PORTFOLIO_TABLE = module.dynamodb_portfolio.dynamodb_table_id
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
  }

  api_routes = {
    "callback"            = { route_key = "GET /callback", integration = "auth-callback", auth = false }
    "fintech-get"         = { route_key = "GET /fintech", integration = "fintech-get", auth = true }
    "fintech-put"         = { route_key = "PUT /fintech", integration = "fintech-update", auth = true }
    "product-get"         = { route_key = "GET /product", integration = "product-get", auth = true }
    "product-post"        = { route_key = "POST /product", integration = "product-create", auth = true }
    "product-put"         = { route_key = "PUT /product/{id}", integration = "product-update", auth = true }
    "product-delete"      = { route_key = "DELETE /product/{id}", integration = "product-delete", auth = true }
    "simulations-post"    = { route_key = "POST /simulations", integration = "simulations-handler", auth = true }
    "simulations-get"     = { route_key = "GET /simulations", integration = "simulations-results", auth = true }
    "recommendations-get" = { route_key = "GET /recommendations", integration = "recommendations-get", auth = true }
    "portfolio-get"       = { route_key = "GET /portfolio", integration = "portfolio-get", auth = true }
    "portfolio-refresh"   = { route_key = "POST /portfolio/refresh", integration = "portfolio-updater", auth = true }
  }
}
