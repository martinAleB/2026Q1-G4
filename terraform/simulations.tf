resource "aws_dynamodb_table" "simulations" {
  name           = "cloud-presti-simulations"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }
}

resource "aws_sqs_queue" "simulations" {
  name                       = "cloud-presti-simulations-queue"
  visibility_timeout_seconds = 300 # 5 minutos para darle tiempo al worker ML
}


resource "aws_apigatewayv2_api" "simulations_api" {
  name          = "cloud-presti-simulations-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }
}

resource "aws_apigatewayv2_stage" "simulations_stage" {
  api_id      = aws_apigatewayv2_api.simulations_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "handler_integration" {
  api_id           = aws_apigatewayv2_api.simulations_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.lambdas["simulations-handler"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "results_integration" {
  api_id           = aws_apigatewayv2_api.simulations_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.lambdas["simulations-results"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_simulations" {
  api_id    = aws_apigatewayv2_api.simulations_api.id
  route_key = "POST /simulations"
  target    = "integrations/${aws_apigatewayv2_integration.handler_integration.id}"
}

resource "aws_apigatewayv2_route" "get_simulations" {
  api_id    = aws_apigatewayv2_api.simulations_api.id
  route_key = "GET /simulations"
  target    = "integrations/${aws_apigatewayv2_integration.results_integration.id}"
}


output "simulations_api_endpoint" {
  value = aws_apigatewayv2_api.simulations_api.api_endpoint
}
