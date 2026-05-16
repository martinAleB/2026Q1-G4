# --- API Gateway JWT authorizer ---

resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  api_id           = aws_apigatewayv2_api.simulations_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# --- Integrations ---

resource "aws_apigatewayv2_integration" "product_get" {
  api_id                 = aws_apigatewayv2_api.simulations_api.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.lambdas["product-get"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "product_create" {
  api_id                 = aws_apigatewayv2_api.simulations_api.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.lambdas["product-create"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "product_update" {
  api_id                 = aws_apigatewayv2_api.simulations_api.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.lambdas["product-update"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "product_delete" {
  api_id                 = aws_apigatewayv2_api.simulations_api.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.lambdas["product-delete"].invoke_arn
  payload_format_version = "2.0"
}

# --- Routes ---

resource "aws_apigatewayv2_route" "get_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "GET /producto"
  target             = "integrations/${aws_apigatewayv2_integration.product_get.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "post_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "POST /producto"
  target             = "integrations/${aws_apigatewayv2_integration.product_create.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "put_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "PUT /producto/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.product_update.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "delete_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "DELETE /producto/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.product_delete.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}
