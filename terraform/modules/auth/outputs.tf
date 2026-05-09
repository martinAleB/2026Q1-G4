output "user_pool_id" {
  description = "ID del User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "client_id" {
  description = "ID del Client App"
  value       = aws_cognito_user_pool_client.main.id
}

output "client_secret" {
  description = "Client Secret (marcado como sensible)"
  value       = aws_cognito_user_pool_client.main.client_secret
  sensitive   = true
}

output "cognito_domain" {
  description = "Prefijo del dominio de la Hosted UI"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "api_gateway_endpoint" {
  description = "URL del API Gateway para el callback de auth"
  value       = aws_apigatewayv2_api.main.api_endpoint
}
