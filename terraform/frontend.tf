variable "bucket_name" {
  description = "Nombre del bucket S3 para el frontend estático"
  type        = string
}

resource "aws_s3_bucket" "frontend" {
  bucket        = var.bucket_name
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Disabled"
  }
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  depends_on = [aws_s3_bucket_ownership_controls.frontend]
  bucket     = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_policy" "frontend_public_read" {
  depends_on = [aws_s3_bucket_public_access_block.frontend]
  bucket     = aws_s3_bucket.frontend.id
  policy     = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "PublicReadGetObject",
        Effect    = "Allow",
        Principal = "*",
        Action    = ["s3:GetObject"],
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

resource "terraform_data" "build_frontend" {
  triggers_replace = {
    cognito_domain = aws_cognito_user_pool_domain.main.domain
    client_id      = aws_cognito_user_pool_client.main.id
    api_endpoint   = aws_apigatewayv2_api.simulations_api.api_endpoint
    bucket_name    = aws_s3_bucket.frontend.id
    script_hash    = filemd5("${path.module}/build-frontend.sh")
  }

  provisioner "local-exec" {
    command     = "${path.module}/build-frontend.sh '${self.triggers_replace.cognito_domain}' '${self.triggers_replace.client_id}' '${self.triggers_replace.api_endpoint}' '${self.triggers_replace.api_endpoint}' '${path.module}/../frontend' '${self.triggers_replace.bucket_name}'"
    working_dir = path.module
  }

  depends_on = [
    aws_cognito_user_pool_domain.main,
    aws_cognito_user_pool_client.main,
    aws_apigatewayv2_api.simulations_api,
    aws_apigatewayv2_stage.simulations_stage,
    aws_apigatewayv2_route.callback,
    aws_apigatewayv2_route.post_simulations,
    aws_apigatewayv2_route.get_simulations,
    aws_s3_bucket.frontend
  ]
}

output "bucket_name" {
  description = "Nombre del bucket S3"
  value       = aws_s3_bucket.frontend.bucket
}

output "website_endpoint" {
  description = "URL HTTP del sitio web estático"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}
