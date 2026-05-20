locals {
  # Lambdas async / disparadas por eventos. Si fallan, el usuario final no
  # se entera (no hay un 5xx que devolver), por eso necesitan alarma
  # propia. Las Lambdas síncronas detrás de API Gateway ya propagan error
  # al cliente, que es quien las "monitorea".
  critical_lambdas = toset([
    "simulations-engine",        # SQS consumer (scoring ML)
    "simulations-handler",       # entrypoint de POST /simulations
    "fintech-post-confirmation", # trigger async de Cognito
    "portfolio-updater",         # cron mensual EventBridge
  ])
}

# Alarma "algo se rompió y cayó al DLQ". Cualquier mensaje en el DLQ
# significa que se agotaron los reintentos del flujo correspondiente
# (SQS redrive con maxReceiveCount, Lambda async retries, o EventBridge
# retry_policy). period=300s con notBreaching para no oscilar cuando un
# mensaje entra y es procesado rápido.
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

# Una alarma de errores por Lambda crítica. La métrica AWS/Lambda Errors
# no se puede combinar fácil sin metric math, y tenerlas separadas hace
# obvio cuál servicio se rompió cuando una se prende. Threshold > 0 con
# Sum en 5min: cualquier error en la ventana la prende. Es sensible a
# propósito; si genera ruido el threshold se sube después.
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
