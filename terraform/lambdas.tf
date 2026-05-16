# --- Triggers y permisos específicos por lambda ---

resource "aws_lambda_permission" "api_gw_fintech_get" {
  statement_id  = "AllowExecutionFromAPIGatewayFintechGet"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["fintech-get"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_product_get" {
  statement_id  = "AllowExecutionFromAPIGatewayProductGet"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["product-get"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_product_create" {
  statement_id  = "AllowExecutionFromAPIGatewayProductCreate"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["product-create"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_product_update" {
  statement_id  = "AllowExecutionFromAPIGatewayProductUpdate"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["product-update"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_product_delete" {
  statement_id  = "AllowExecutionFromAPIGatewayProductDelete"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["product-delete"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_handler" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["simulations-handler"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_results" {
  statement_id  = "AllowExecutionFromAPIGatewayResults"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["simulations-results"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_auth" {
  statement_id  = "AllowExecutionFromAPIGatewayAuth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_callback.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.simulations_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "cognito_fintech" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambdas["fintech-post-confirmation"].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_event_source_mapping" "sqs_to_engine" {
  event_source_arn = aws_sqs_queue.simulations.arn
  function_name    = aws_lambda_function.lambdas["simulations-engine"].arn
  batch_size       = 1
}

# --- Lambda functions ---

resource "aws_lambda_function" "lambdas" {
  for_each         = local.lambda_configs
  function_name    = "cloud-presti-${each.key}"
  role             = data.aws_iam_role.lab_role.arn
  handler          = each.value.handler
  runtime          = each.value.runtime
  timeout          = each.value.timeout
  memory_size      = each.value.memory_size
  filename         = data.archive_file.lambdas[each.key].output_path
  source_code_hash = data.archive_file.lambdas[each.key].output_base64sha256

  dynamic "vpc_config" {
    for_each = each.value.in_vpc ? [1] : []
    content {
      subnet_ids         = [module.vpc.subnet_ids["10.0.2.0/24"], module.vpc.subnet_ids["10.0.5.0/24"]]
      security_group_ids = [module.vpc.security_group_ids["lambda-sg"]]
    }
  }

  environment {
    variables = each.value.env_vars
  }
}
