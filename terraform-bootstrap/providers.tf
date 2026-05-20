provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.stack_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "cloud-presti"
    }
  }
}
