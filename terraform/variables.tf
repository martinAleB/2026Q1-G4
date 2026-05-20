variable "aws_region" {
  description = "AWS region where all project resources are created (lab is restricted to us-east-1 and us-west-2)"
  type        = string
  default     = "us-east-1"
}

variable "stack_name" {
  description = "Unique prefix that namespaces every AWS resource and tag for this deployment. Each developer of the team uses their own value (e.g. tincho-presti, josefina-presti) so that parallel deploys to the same AWS account do not collide on globally-unique names (S3 buckets, DynamoDB tables, Lambda function names, etc)."
  type        = string
  default     = "cloud-presti"
}

variable "cognito_domain_suffix" {
  description = "Optional suffix appended to the Cognito hosted UI domain. Cognito domains must be globally unique across all AWS accounts, so if stack_name alone collides, set this to a random short string."
  type        = string
  default     = ""
}

variable "cors_additional_origins" {
  description = "Extra origins allowed by the API Gateway CORS configuration, on top of the frontend S3 bucket URL which is always included. Defaults to the Vite dev server so local `npm run dev` can hit the deployed API without redeploy."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "api_throttling_rate_limit" {
  description = "Steady-state requests-per-second allowed by the API Gateway stage. Defaults align with the lab's 10-concurrent-Lambdas cap (~20 RPS sustained leaves headroom for fast handlers)."
  type        = number
  default     = 20
}

variable "api_throttling_burst_limit" {
  description = "Burst capacity (parallel requests) allowed by the API Gateway stage before throttling kicks in."
  type        = number
  default     = 50
}

variable "bucket_name" {
  description = "S3 bucket name for the static frontend (must be globally unique)"
  type        = string
}

variable "environment" {
  description = "Environment identifier used in the default_tags propagated to every resource (e.g. lab, dev, prod)"
  type        = string
  default     = "lab"
}


variable "vpc_cidr_block" {
  description = "CIDR block of the project VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks of the public subnets, one per AZ (used for NAT gateways and the IGW route)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.4.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks of the private subnets, one per AZ (where Lambdas attach their ENIs)"
  type        = list(string)
  default     = ["10.0.2.0/24", "10.0.5.0/24"]
}


variable "lambda_node_runtime" {
  description = "Node.js runtime applied to all Node Lambdas (auth-callback, fintech-*, product-*, recommendations-get, simulations handler/results)"
  type        = string
  default     = "nodejs20.x"
}

variable "lambda_python_runtime" {
  description = "Python runtime applied to the simulations engine Lambda (TFLite inference)"
  type        = string
  default     = "python3.12"
}


variable "dynamodb_billing_mode" {
  description = "Billing mode used by all DynamoDB tables in the project"
  type        = string
  default     = "PAY_PER_REQUEST"
}


variable "sqs_visibility_timeout_seconds" {
  description = "Visibility timeout for the simulations SQS queue. Must be at least as long as the engine Lambda timeout"
  type        = number
  default     = 300
}

variable "sqs_max_receive_count" {
  description = "Number of delivery attempts before a message is moved from the main SQS queue to the dead-letter queue. Default 3 is a common compromise between transient retries and not retrying forever."
  type        = number
  default     = 3
}

variable "lambda_log_retention_days" {
  description = "CloudWatch retention applied to every Lambda log group. Without this, AWS keeps logs forever and the lab budget bleeds slowly. 7 days is enough for daily debugging in a POC."
  type        = number
  default     = 7
}
