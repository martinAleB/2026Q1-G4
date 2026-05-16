# --- Lambda permissions ---



# --- Integration ---

resource "aws_apigatewayv2_integration" "fintech_get" {
  api_id                 = aws_apigatewayv2_api.simulations_api.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.lambdas["fintech-get"].invoke_arn
  payload_format_version = "2.0"
}

# --- Route ---

resource "aws_apigatewayv2_route" "get_fintech" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "GET /fintech"
  target             = "integrations/${aws_apigatewayv2_integration.fintech_get.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}
