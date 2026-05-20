output "api_endpoint" {
  description = "Base URL of the HTTP API Gateway (consumed by the frontend as VITE_SIMULATIONS_API_URL and by Cognito as the OAuth callback host)"
  value       = aws_apigatewayv2_api.main.api_endpoint
}


output "auth_user_pool_id" {
  description = "Cognito User Pool ID (used to build the JWT issuer URL: https://cognito-idp.<region>.amazonaws.com/<id>)"
  value       = aws_cognito_user_pool.main.id
}

output "auth_client_id" {
  description = "Cognito User Pool App Client ID (used as JWT audience and as VITE_COGNITO_CLIENT_ID in the frontend)"
  value       = aws_cognito_user_pool_client.main.id
}

output "auth_cognito_domain" {
  description = "Cognito hosted UI domain prefix (resolves to <prefix>.auth.<region>.amazoncognito.com)"
  value       = aws_cognito_user_pool_domain.main.domain
}


output "bucket_name" {
  description = "S3 bucket name hosting the static frontend (target of aws s3 sync in build-frontend.sh)"
  value       = aws_s3_bucket.frontend.bucket
}

output "website_endpoint" {
  description = "HTTP URL of the static website served by the S3 bucket (lab cannot serve HTTPS without ACM + custom domain)"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}
