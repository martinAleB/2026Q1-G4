variable "bucket_name" {
  description = "Nombre del bucket S3 para el frontend estático"
  type        = string
}

resource "aws_s3_bucket" "frontend" {
  bucket = var.bucket_name
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


output "bucket_name" {
  description = "Nombre del bucket S3"
  value       = aws_s3_bucket.frontend.bucket
}

output "website_endpoint" {
  description = "URL HTTP del sitio web estático"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}
