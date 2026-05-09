variable "project_name" {
  description = "Nombre del proyecto para usar como prefijo en los recursos"
  type        = string
  default     = "cloud-presti"
}

variable "frontend_url" {
  description = "URL del frontend (S3) a donde redirigir después del login"
  type        = string
}

variable "region" {
  description = "Región de AWS"
  type        = string
  default     = "us-east-1"
}
