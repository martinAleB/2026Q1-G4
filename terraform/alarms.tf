locals {
  critical_lambdas = toset([
    "simulations-engine",
    "simulations-handler",
    "fintech-post-confirmation",
    "portfolio-updater",
  ])
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages_visible" {
  alarm_name          = "${var.stack_name}-dlq-messages-visible"
  alarm_description   = "Hay mensajes en el DLQ de simulaciones — algo falló persistentemente."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.main_dlq.name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = local.critical_lambdas

  alarm_name          = "${var.stack_name}-${each.key}-errors"
  alarm_description   = "Errores en Lambda ${each.key} en los últimos 5 minutos."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.lambdas[each.key].function_name
  }
}
