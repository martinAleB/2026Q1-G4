variable "region" {
  description = "AWS region where the Terraform state bucket and lock table are created"
  type        = string
  default     = "us-east-1"
}

variable "stack_name" {
  description = "Unique prefix that namespaces the state bucket / lock table tags. Each developer of the team uses their own value (e.g. tincho-presti) so resources are attributable per-deployment in Cost Explorer / Resource Groups."
  type        = string
  default     = "cloud-presti"
}

variable "environment" {
  description = "Environment identifier used in the default_tags propagated to the state bucket and lock table (e.g. lab, dev, prod)"
  type        = string
  default     = "lab"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name where the Terraform state file is stored"
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name used for Terraform state locking (legacy mechanism, see Terraform >= 1.10 use_lockfile alternative)"
  type        = string
}
