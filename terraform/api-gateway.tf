resource "aws_apigatewayv2_api" "main" {
  name          = "${var.stack_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = concat(
      ["http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"],
      var.cors_additional_origins,
    )
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = var.api_throttling_rate_limit
    throttling_burst_limit = var.api_throttling_burst_limit
  }
}


resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.stack_name}-cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}


resource "aws_apigatewayv2_integration" "lambdas" {
  for_each               = local.api_integrations
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = each.value
  payload_format_version = "2.0"
}


resource "aws_apigatewayv2_route" "routes" {
  for_each           = local.api_routes
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = each.value.route_key
  target             = "integrations/${aws_apigatewayv2_integration.lambdas[each.value.integration].id}"
  authorization_type = each.value.auth ? "JWT" : "NONE"
  authorizer_id      = each.value.auth ? aws_apigatewayv2_authorizer.cognito_jwt.id : null
}
