resource "aws_cognito_user_pool" "main" {
  name = "${var.stack_name}-user-pool"

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
  domain       = var.cognito_domain_suffix != "" ? "${var.stack_name}-auth-domain-${var.cognito_domain_suffix}" : "${var.stack_name}-auth-domain"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.stack_name}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = ["${aws_apigatewayv2_api.main.api_endpoint}/callback"]

  supported_identity_providers = ["COGNITO"]
}

resource "aws_secretsmanager_secret" "cognito_client_secret" {
  name                    = "${var.stack_name}/cognito/client-secret"
  description             = "Cognito User Pool App Client secret, consumed by the auth-callback Lambda at runtime"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "cognito_client_secret" {
  secret_id     = aws_secretsmanager_secret.cognito_client_secret.id
  secret_string = aws_cognito_user_pool_client.main.client_secret
}

resource "aws_lambda_function" "auth_callback" {
  filename         = data.archive_file.lambdas["auth-callback"].output_path
  function_name    = "${var.stack_name}-auth-callback"
  role             = local.lambda_defaults.role
  handler          = local.lambda_defaults.handler
  runtime          = local.lambda_defaults.runtime
  timeout          = local.lambda_defaults.timeout
  memory_size      = local.lambda_defaults.memory_size
  source_code_hash = data.archive_file.lambdas["auth-callback"].output_base64sha256

  environment {
    variables = {
      COGNITO_CLIENT_ID        = aws_cognito_user_pool_client.main.id
      COGNITO_CLIENT_SECRET_ID = aws_secretsmanager_secret.cognito_client_secret.id
      COGNITO_DOMAIN           = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
      FRONTEND_URL             = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
      CALLBACK_URL             = "${aws_apigatewayv2_api.main.api_endpoint}/callback"
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambdas]
}

