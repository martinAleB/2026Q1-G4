resource "aws_cognito_user_pool" "main" {
  name = "cloud-presti-user-pool"

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
    post_confirmation = aws_lambda_function.fintech_post_confirmation.arn
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "cloud-presti-auth-domain"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "cloud-presti-client-2"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = ["${aws_apigatewayv2_api.simulations_api.api_endpoint}/callback"]

  supported_identity_providers = ["COGNITO"]
}

data "archive_file" "auth_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/auth"
  output_path = "${path.root}/.terraform/tmp/user-auth-lambda.zip"
}

resource "aws_lambda_function" "auth_callback" {
  filename         = data.archive_file.auth_lambda_zip.output_path
  function_name    = "cloud-presti-auth-callback"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.auth_lambda_zip.output_base64sha256
  runtime          = "nodejs20.x"

  environment {
    variables = {
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.main.id
      COGNITO_CLIENT_SECRET = aws_cognito_user_pool_client.main.client_secret
      COGNITO_DOMAIN        = "https://${aws_cognito_user_pool_domain.main.domain}.auth.us-east-1.amazoncognito.com"
      FRONTEND_URL          = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
    }
  }
}

resource "aws_apigatewayv2_integration" "auth_callback" {
  api_id           = aws_apigatewayv2_api.simulations_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  description            = "Auth callback Lambda integration"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.auth_callback.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "callback" {
  api_id    = aws_apigatewayv2_api.simulations_api.id
  route_key = "GET /callback"
  target    = "integrations/${aws_apigatewayv2_integration.auth_callback.id}"
}

resource "aws_lambda_permission" "api_gw_auth" {
  statement_id  = "AllowExecutionFromAPIGatewayAuth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_callback.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}
