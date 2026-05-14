data "archive_file" "producto_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/producto"
  output_path = "${path.root}/.terraform/archives/producto.zip"
}

resource "aws_lambda_function" "producto" {
  function_name    = "cloud-presti-producto"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.producto_zip.output_path
  source_code_hash = data.archive_file.producto_zip.output_base64sha256
  timeout          = 30
  memory_size      = 256

  vpc_config {
    subnet_ids = [
      module.vpc.subnet_ids["10.0.2.0/24"],
      module.vpc.subnet_ids["10.0.5.0/24"],
    ]
    security_group_ids = [module.vpc.security_group_ids["lambda-sg"]]
  }

  environment {
    variables = {
      DB_HOST    = aws_db_proxy.main.endpoint
      DB_PORT    = "5432"
      DB_NAME    = "cloudpresti"
      SECRET_ARN = module.rds.db_instance_master_user_secret_arn
    }
  }
}

resource "aws_lambda_permission" "api_gw_producto" {
  statement_id  = "AllowExecutionFromAPIGatewayProducto"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.producto.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

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

resource "aws_apigatewayv2_integration" "producto" {
  api_id                 = aws_apigatewayv2_api.simulations_api.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.producto.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "GET /producto"
  target             = "integrations/${aws_apigatewayv2_integration.producto.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "post_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "POST /producto"
  target             = "integrations/${aws_apigatewayv2_integration.producto.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "put_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "PUT /producto/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.producto.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "delete_producto" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "DELETE /producto/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.producto.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}
