# Core Infrastructure - Phase 1
# This can be deployed before nameserver changes

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

variable "lambda_zip_path" {
  description = "Path to Lambda deployment package"
  type        = string
}

variable "domain_name" {
  description = "Domain name for custom domain"
  type        = string
  default     = ""
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

# S3 Bucket for caching
module "s3" {
  source = "./modules/s3"
  
  project_name = local.project_name
  environment  = var.environment
  tags         = local.common_tags
}

# Lambda Function
module "lambda" {
  source = "./modules/lambda"
  
  project_name = local.project_name
  environment  = var.environment
  tags         = local.common_tags
  
  s3_bucket_name      = module.s3.bucket_name
  lambda_zip_path     = var.lambda_zip_path
}

# API Gateway (without custom domain)
module "apigateway" {
  source = "./modules/apigateway"
  
  project_name = local.project_name
  environment  = var.environment
  tags         = local.common_tags
  
  # Don't pass domain_name here - we'll add it in phase 2
  domain_name = ""
  
  lambda_function_name = module.lambda.function_name
  lambda_invoke_arn    = module.lambda.invoke_arn
}

# Route53 Hosted Zone (Phase 1 - creates nameservers)
module "route53" {
  count  = var.domain_name != "" ? 1 : 0
  source = "./modules/route53"
  
  domain_name                = var.domain_name
  # Don't pass API Gateway domain info yet - that's Phase 2
  api_gateway_domain_name    = ""
  api_gateway_zone_id        = ""
  tags                       = local.common_tags
}

# Outputs for Phase 2
output "lambda_function_name" {
  value = module.lambda.function_name
}

output "lambda_invoke_arn" {
  value = module.lambda.invoke_arn
}

output "api_gateway_id" {
  value = module.apigateway.api_gateway_id
}

output "api_gateway_url" {
  value = module.apigateway.api_gateway_url
}

output "s3_bucket_name" {
  value = module.s3.bucket_name
}

output "s3_bucket_arn" {
  value = module.s3.bucket_arn
}

output "nameservers" {
  value = var.domain_name != "" ? module.route53[0].name_servers : []
  description = "Update your domain's nameservers to these values"
}

output "hosted_zone_id" {
  value = var.domain_name != "" ? module.route53[0].hosted_zone_id : ""
  description = "Route53 hosted zone ID for Phase 2"
}

