variable "region" {
  type    = string
  default = "us-east-1"
}

variable "state_bucket_name" {
  type    = string
  default = "cloud-presti-tf-state"
}

variable "lock_table_name" {
  type    = string
  default = "cloud-presti-tf-lock"
}
