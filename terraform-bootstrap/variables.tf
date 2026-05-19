variable "region" {
  description = "AWS region where the Terraform state bucket and lock table are created"
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name where the Terraform state file is stored"
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name used for Terraform state locking (legacy mechanism, see Terraform >= 1.10 use_lockfile alternative)"
  type        = string
}
