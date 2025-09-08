# Core Infrastructure - Phase 1
# This can be deployed before nameserver changes

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

# Outputs for Phase 2
output "lambda_function_name" {
  value = module.lambda.function_name
}

output "lambda_invoke_arn" {
  value = module.lambda.invoke_arn
}

output "api_gateway_id" {
  value = module.apigateway.api_id
}

output "api_gateway_execution_arn" {
  value = module.apigateway.execution_arn
}

output "s3_bucket_name" {
  value = module.s3.bucket_name
}

output "s3_bucket_arn" {
  value = module.s3.bucket_arn
}
