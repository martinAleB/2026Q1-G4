data "archive_file" "fintech_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/fintech"
  output_path = "${path.root}/.terraform/archives/fintech.zip"
}

resource "aws_lambda_function" "fintech" {
  function_name    = "cloud-presti-fintech"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.fintech_zip.output_path
  source_code_hash = data.archive_file.fintech_zip.output_base64sha256
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

resource "aws_lambda_permission" "cognito_fintech" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fintech.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "api_gw_fintech" {
  statement_id  = "AllowExecutionFromAPIGatewayFintech"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fintech.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "fintech" {
  api_id                 = aws_apigatewayv2_api.simulations_api.id
  integration_type       = "AWS_PROXY"
  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.fintech.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_fintech" {
  api_id             = aws_apigatewayv2_api.simulations_api.id
  route_key          = "GET /fintech"
  target             = "integrations/${aws_apigatewayv2_integration.fintech.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}
