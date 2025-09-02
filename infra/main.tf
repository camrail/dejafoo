# Main Terraform configuration for dejafoo infrastructure
# This file defines the core infrastructure components

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

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

# No upstream_base_url needed for managed service - customers provide their own URLs

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment package"
  type        = string
  default     = "lambda-deployment.zip"
}

variable "github_repo_url" {
  description = "GitHub repository URL for CodeBuild"
  type        = string
  default     = "https://github.com/yourusername/dejafoo.git"
}

variable "branch_name" {
  description = "GitHub branch to build from"
  type        = string
  default     = "main"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  project_name = "dejafoo"
  common_tags = {
    Project     = local.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Include modules
module "dynamodb" {
  source = "./modules/dynamodb"
  
  project_name = local.project_name
  environment  = var.environment
  tags         = local.common_tags
}

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
  
  dynamodb_table_name = module.dynamodb.table_name
  s3_bucket_name      = module.s3.bucket_name
  lambda_zip_path     = var.lambda_zip_path
}

module "codebuild" {
  source = "./modules/codebuild"
  
  project_name     = local.project_name
  environment      = var.environment
  aws_region       = var.aws_region
  github_repo_url  = var.github_repo_url
  branch_name      = var.branch_name
  tags            = local.common_tags
}

# Outputs
output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = module.dynamodb.table_name
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.s3.bucket_name
}

output "lambda_function_url" {
  description = "Lambda function URL"
  value       = module.lambda.function_url
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = module.lambda.function_name
}

output "codebuild_project_name" {
  description = "CodeBuild project name"
  value       = module.codebuild.codebuild_project_name
}

output "secrets_manager_secret_name" {
  description = "Secrets Manager secret name"
  value       = module.codebuild.secrets_manager_secret_name
}
