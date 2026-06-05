module "dynamodb_api_clients" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.4.0"

  name         = "${var.stack_name}-api-clients"
  hash_key     = "api_key_id"
  billing_mode = var.dynamodb_billing_mode

  server_side_encryption_enabled = true
  point_in_time_recovery_enabled = true

  attributes = [
    { name = "api_key_id",   type = "S" },
    { name = "fintech_sub",  type = "S" },
  ]

  global_secondary_indexes = [
    {
      name            = "fintech-sub-index"
      hash_key        = "fintech_sub"
      projection_type = "ALL"
    }
  ]
}

resource "aws_apigatewayv2_authorizer" "b2b_lambda" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "REQUEST"
  authorizer_uri   = aws_lambda_function.lambdas["b2b-authorizer"].invoke_arn
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.stack_name}-b2b-lambda-authorizer"

  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  authorizer_result_ttl_in_seconds  = 0
}
