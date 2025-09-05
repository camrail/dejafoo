variable "domain_name" {
  description = "Domain name for dejafoo (e.g., dejafoo.io)"
  type        = string
}

variable "api_gateway_domain_name" {
  description = "API Gateway CloudFront domain name"
  type        = string
}

variable "api_gateway_zone_id" {
  description = "API Gateway CloudFront hosted zone ID"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
