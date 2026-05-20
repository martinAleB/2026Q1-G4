data "archive_file" "lambdas" {
  for_each    = local.lambda_sources
  type        = "zip"
  source_dir  = each.value
  output_path = "${path.root}/.terraform/archives/${each.key}.zip"
}

locals {
  lambda_event_sources_flat = {
    for entry in flatten([
      for lambda_key, sources in local.lambda_event_sources : [
        for i, source in sources : {
          key              = "${lambda_key}-${i}"
          lambda_key       = lambda_key
          event_source_arn = source.event_source_arn
          batch_size       = source.batch_size
        }
      ]
    ]) : entry.key => entry
  }

  lambda_permissions_flat = {
    for entry in flatten([
      for lambda_key, perms in local.lambda_permissions : [
        for i, perm in perms : {
          key        = "${lambda_key}-${i}"
          lambda_key = lambda_key
          principal  = perm.principal
          source_arn = perm.source_arn
        }
      ]
    ]) : entry.key => entry
  }
}

# --- Lambda permissions ---

resource "aws_lambda_permission" "permissions" {
  for_each      = local.lambda_permissions_flat
  statement_id  = "Allow-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.lambda_key == "auth-callback" ? aws_lambda_function.auth_callback.function_name : aws_lambda_function.lambdas[each.value.lambda_key].function_name
  principal     = each.value.principal
  source_arn    = each.value.source_arn
}

resource "aws_lambda_event_source_mapping" "mappings" {
  for_each         = local.lambda_event_sources_flat
  event_source_arn = each.value.event_source_arn
  function_name    = aws_lambda_function.lambdas[each.value.lambda_key].arn
  batch_size       = each.value.batch_size
}

# --- Lambda functions ---

resource "aws_lambda_function" "lambdas" {
  for_each         = local.lambda_configs
  function_name    = "${var.stack_name}-${each.key}"
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
      subnet_ids         = [for cidr in var.private_subnet_cidrs : module.vpc.subnet_ids[cidr]]
      security_group_ids = [module.vpc.security_group_ids["lambda-sg"]]
    }
  }

  environment {
    variables = each.value.env_vars
  }
}

resource "aws_cloudwatch_event_rule" "portfolio_updater" {
  name                = "${var.stack_name}-portfolio-updater-cron"
  description         = "Executes portfolio-updater monthly"
  schedule_expression = "cron(0 10 1 * ? *)" # El dia 1 de cada mes a las 10:00 UTC
}

resource "aws_cloudwatch_event_target" "portfolio_updater_target" {
  rule      = aws_cloudwatch_event_rule.portfolio_updater.name
  target_id = "portfolio_updater"
  arn       = aws_lambda_function.lambdas["portfolio-updater"].arn
}
