resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  lambda_config {
    post_confirmation = aws_lambda_function.lambdas["fintech-post-confirmation"].arn
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-auth-domain"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-client-2"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = ["${aws_apigatewayv2_api.simulations_api.api_endpoint}/callback"]

  supported_identity_providers = ["COGNITO"]
}

resource "aws_lambda_function" "auth_callback" {
  filename         = data.archive_file.lambdas["auth-callback"].output_path
  function_name    = "${var.project_name}-auth-callback"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambdas["auth-callback"].output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.main.id
      COGNITO_CLIENT_SECRET = aws_cognito_user_pool_client.main.client_secret
      COGNITO_DOMAIN        = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
      FRONTEND_URL          = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
    }
  }
}

output "auth_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "auth_client_id" {
  value = aws_cognito_user_pool_client.main.id
}

output "auth_cognito_domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "auth_api_gateway_endpoint" {
  value = aws_apigatewayv2_api.simulations_api.api_endpoint
}
