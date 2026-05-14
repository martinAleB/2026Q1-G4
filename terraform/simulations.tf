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

data "archive_file" "simulations_handler_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/simulations/handler"
  output_path = "${path.root}/.terraform/archives/simulations_handler.zip"
}

data "archive_file" "simulations_results_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/simulations/results"
  output_path = "${path.root}/.terraform/archives/simulations_results.zip"
}

resource "aws_lambda_function" "simulations_handler" {
  function_name    = "cloud-presti-simulations-handler"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.simulations_handler_zip.output_path
  source_code_hash = data.archive_file.simulations_handler_zip.output_base64sha256

  environment {
    variables = {
      SQS_QUEUE_URL       = aws_sqs_queue.simulations.url
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.simulations.name
    }
  }
}

resource "aws_lambda_function" "simulations_results" {
  function_name    = "cloud-presti-simulations-results"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.simulations_results_zip.output_path
  source_code_hash = data.archive_file.simulations_results_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.simulations.name
    }
  }
}

resource "aws_lambda_function" "simulations_engine" {
  function_name    = "cloud-presti-simulations-engine"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  filename         = "${path.root}/../simulations_engine.zip"
  source_code_hash = fileexists("${path.root}/../simulations_engine.zip") ? filebase64sha256("${path.root}/../simulations_engine.zip") : null
  timeout          = 60
  memory_size      = 1024

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.simulations.name
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs_to_engine" {
  event_source_arn = aws_sqs_queue.simulations.arn
  function_name    = aws_lambda_function.simulations_engine.arn
  batch_size       = 1
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
  integration_uri        = aws_lambda_function.simulations_handler.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "results_integration" {
  api_id           = aws_apigatewayv2_api.simulations_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.simulations_results.invoke_arn
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

resource "aws_lambda_permission" "api_gw_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.simulations_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_results" {
  statement_id  = "AllowExecutionFromAPIGatewayResults"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.simulations_results.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

output "simulations_api_endpoint" {
  value = aws_apigatewayv2_api.simulations_api.api_endpoint
}
