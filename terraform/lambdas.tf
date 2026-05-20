data "archive_file" "lambdas" {
  for_each    = local.lambda_sources
  type        = "zip"
  source_dir  = each.value
  output_path = "${path.root}/.terraform/archives/${each.key}.zip"
}

locals {
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

resource "aws_lambda_permission" "permissions" {
  for_each      = local.lambda_permissions_flat
  statement_id  = "Allow-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.lambda_key == "auth-callback" ? aws_lambda_function.auth_callback.function_name : aws_lambda_function.lambdas[each.value.lambda_key].function_name
  principal     = each.value.principal
  source_arn    = each.value.source_arn
}

resource "aws_lambda_event_source_mapping" "simulations_engine" {
  event_source_arn = aws_sqs_queue.main.arn
  function_name    = aws_lambda_function.lambdas["simulations-engine"].arn
  batch_size       = 1
}

# Explicit log groups for every Lambda function so we can pin a retention
# policy. Without this resource, AWS Lambda lazy-creates the log group on
# first invocation with retention "never expire", which bleeds the lab
# budget over time.

resource "aws_cloudwatch_log_group" "lambdas" {
  for_each = toset(concat(keys(local.lambda_configs), ["auth-callback"]))

  name              = "/aws/lambda/${var.stack_name}-${each.key}"
  retention_in_days = var.lambda_log_retention_days
}


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

  # Dead letter target for async invocations (EventBridge, SNS, etc.). Opt-in
  # per Lambda via local.lambda_async_dlq_arns. Sync invokers (API Gateway,
  # Cognito triggers, SQS pollers) ignore this — they have their own retry /
  # DLQ paths.
  dynamic "dead_letter_config" {
    for_each = lookup(local.lambda_async_dlq_arns, each.key, null) != null ? [1] : []
    content {
      target_arn = local.lambda_async_dlq_arns[each.key]
    }
  }

  environment {
    variables = each.value.env_vars
  }

  # Ensure the log group with retention exists before the Lambda runs, so the
  # first invocation reuses our pre-created log group instead of AWS lazily
  # creating one with retention "never expire".
  depends_on = [aws_cloudwatch_log_group.lambdas]
}

resource "aws_cloudwatch_event_rule" "portfolio_updater" {
  name                = "${var.stack_name}-portfolio-updater-cron"
  description         = "Executes portfolio-updater monthly"
  schedule_expression = "cron(0 10 1 * ? *)" # First of each month at 10:00 UTC

  tags = {
    Name = "${var.stack_name}-portfolio-updater-cron"
  }
}

resource "aws_cloudwatch_event_target" "portfolio_updater_target" {
  rule      = aws_cloudwatch_event_rule.portfolio_updater.name
  target_id = "portfolio_updater"
  arn       = aws_lambda_function.lambdas["portfolio-updater"].arn

  # If EventBridge cannot deliver the event to the Lambda (e.g. Lambda is
  # throttled by the lab's 10-concurrent cap, briefly missing during a
  # redeploy, or transient AWS issues), retry for up to an hour and then
  # drop the event into the shared DLQ. This is independent from the Lambda
  # async DLQ (local.lambda_async_dlq_arns) which catches failures *during*
  # Lambda execution — both layers together cover the full failure surface.
  retry_policy {
    maximum_retry_attempts       = 3
    maximum_event_age_in_seconds = 3600
  }

  dead_letter_config {
    arn = aws_sqs_queue.main_dlq.arn
  }
}
