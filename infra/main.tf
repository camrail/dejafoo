# Simplified Terraform configuration for dejafoo infrastructure
# JavaScript Lambda with direct deployment - no CodeBuild needed

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
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

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment package"
  type        = string
  default     = "dejafoo-lambda.zip"
}

variable "domain_name" {
  description = "Domain name for dejafoo (e.g., dejafoo.io)"
  type        = string
  default     = ""
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}


# Include modules
module "s3" {
  source = "./modules/s3"
  
  project_name = local.project_name
  environment  = var.environment
  tags         = local.common_tags
}

module "lambda" {
  source = "./modules/lambda"
  
  project_name = local.project_name
  environment  = var.environment
  tags         = local.common_tags
  
  s3_bucket_name      = module.s3.bucket_name
  lambda_zip_path     = var.lambda_zip_path
}

# API Gateway module
module "apigateway" {
  source = "./modules/apigateway"
  
  project_name        = local.project_name
  environment         = var.environment
  tags                = local.common_tags
  
  lambda_function_name = module.lambda.function_name
  lambda_invoke_arn    = module.lambda.invoke_arn
  domain_name          = var.domain_name
  certificate_arn      = var.domain_name != "" ? module.route53[0].certificate_arn : ""
}

# Route53 module (only if domain_name is provided)
module "route53" {
  count  = var.domain_name != "" ? 1 : 0
  source = "./modules/route53"
  
  domain_name                = var.domain_name
  api_gateway_domain_name    = module.apigateway.regional_domain_name
  api_gateway_zone_id        = module.apigateway.regional_zone_id
  tags                       = local.common_tags
}

# Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.s3.bucket_name
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = module.apigateway.api_gateway_url
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = module.lambda.function_name
}


output "domain_name" {
  description = "Domain name (if configured)"
  value       = var.domain_name != "" ? var.domain_name : "Not configured"
}

output "route53_name_servers" {
  description = "Route53 name servers (if domain configured)"
  value       = var.domain_name != "" ? module.route53[0].name_servers : []
}

