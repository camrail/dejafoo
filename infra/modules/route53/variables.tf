variable "domain_name" {
  description = "Domain name for dejafoo (e.g., dejafoo.io)"
  type        = string
}

variable "lambda_function_url_domain" {
  description = "Lambda Function URL domain name"
  type        = string
}

variable "lambda_function_url_zone_id" {
  description = "Lambda Function URL hosted zone ID"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
