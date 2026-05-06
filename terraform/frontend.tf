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

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend" {
  depends_on = [aws_s3_bucket_public_access_block.frontend]
  bucket     = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

locals {
  mime_types = {
    "html"  = "text/html"
    "css"   = "text/css"
    "js"    = "application/javascript"
    "json"  = "application/json"
    "png"   = "image/png"
    "jpg"   = "image/jpeg"
    "jpeg"  = "image/jpeg"
    "gif"   = "image/gif"
    "svg"   = "image/svg+xml"
    "ico"   = "image/x-icon"
    "txt"   = "text/plain"
    "woff"  = "font/woff"
    "woff2" = "font/woff2"
  }
}

resource "aws_s3_object" "frontend_files" {
  for_each = fileset("${path.module}/../frontend/dist", "**")

  bucket       = aws_s3_bucket.frontend.bucket
  key          = each.value
  source       = "${path.module}/../frontend/dist/${each.value}"
  etag         = filemd5("${path.module}/../frontend/dist/${each.value}")
  content_type = lookup(local.mime_types, reverse(split(".", each.value))[0], "application/octet-stream")

  depends_on = [
    aws_s3_bucket_policy.frontend,
    aws_s3_bucket_website_configuration.frontend,
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
