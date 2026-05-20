locals {
  model_artifact_files = toset([
    "modelo_crediticio.tflite",
    "scaler_params.json",
    "feature_columns.json",
    "feature_fill_values.json",
  ])
}

resource "aws_s3_bucket" "model_artifacts" {
  bucket        = "${var.stack_name}-model-artifacts"
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_ownership_controls" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_object" "model_artifacts" {
  for_each = local.model_artifact_files

  bucket = aws_s3_bucket.model_artifacts.id
  key    = "v1/${each.value}"
  source = "${path.root}/../engine/artifacts/${each.value}"
  etag   = filemd5("${path.root}/../engine/artifacts/${each.value}")
}
