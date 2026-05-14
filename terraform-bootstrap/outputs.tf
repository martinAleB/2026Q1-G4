output "state_bucket_name" {
  description = "Nombre del bucket S3 para el estado de Terraform"
  value       = aws_s3_bucket.tf_state.bucket
}

output "lock_table_name" {
  description = "Nombre de la tabla DynamoDB para el lock de estado"
  value       = aws_dynamodb_table.tf_lock.name
}
