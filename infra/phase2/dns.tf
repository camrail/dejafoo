# DNS Infrastructure - Phase 2
# This requires nameservers to be updated first

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.67"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

 

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Domain name for custom domain"
  type        = string
}

variable "lambda_function_name" {
  description = "Lambda function name from Phase 1"
  type        = string
}

variable "lambda_invoke_arn" {
  description = "Lambda invoke ARN from Phase 1"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID from Phase 1"
  type        = string
}


# Local values
locals {
  project_name = "dejafoo"
  common_tags = {
    Project     = local.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# SSL Certificate for wildcard domain (REGIONAL - same region as API Gateway)
resource "aws_acm_certificate" "dejafoo_wildcard" {
  count             = var.domain_name != "" ? 1 : 0
  domain_name       = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

# Certificate validation records
resource "aws_route53_record" "dejafoo_cert_validation" {
  for_each = var.domain_name != "" ? {
    for dvo in aws_acm_certificate.dejafoo_wildcard[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.hosted_zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "dejafoo_wildcard" {
  count           = var.domain_name != "" ? 1 : 0
  certificate_arn = aws_acm_certificate.dejafoo_wildcard[0].arn
  validation_record_fqdns = [for record in aws_route53_record.dejafoo_cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# Route53 A records (hosted zone already exists from Phase 1)
# We'll create the A records that point to the API Gateway custom domain
// Apex record intentionally not created here; apex (dejafoo.io) points to marketing site outside this module

resource "aws_route53_record" "dejafoo_wildcard" {
  count   = var.domain_name != "" ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = "*.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = aws_api_gateway_domain_name.dejafoo_domain[0].regional_domain_name
    zone_id                = aws_api_gateway_domain_name.dejafoo_domain[0].regional_zone_id
    evaluate_target_health = false
  }
}

# API Gateway custom domain (using existing API Gateway from Phase 1)
# Using the specific API Gateway ID from Phase 1
variable "api_gateway_id" {
  description = "API Gateway ID from Phase 1"
  type        = string
}

# Custom domain for the existing API Gateway
resource "aws_api_gateway_domain_name" "dejafoo_domain" {
  count       = var.domain_name != "" ? 1 : 0
  domain_name = "*.${var.domain_name}"
  
  regional_certificate_arn = aws_acm_certificate_validation.dejafoo_wildcard[0].certificate_arn
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  
  tags = local.common_tags
}

# Base path mapping for the custom domain
resource "aws_api_gateway_base_path_mapping" "dejafoo_mapping" {
  count       = var.domain_name != "" ? 1 : 0
  api_id      = var.api_gateway_id
  domain_name = aws_api_gateway_domain_name.dejafoo_domain[0].domain_name
  stage_name  = "prod"
}

# Outputs

output "api_gateway_url" {
  value = "https://${var.api_gateway_id}.execute-api.eu-west-3.amazonaws.com/prod"
}

output "wildcard_domain_example" {
  value = var.domain_name != "" ? "https://{subdomain}.${var.domain_name}" : "N/A"
}
