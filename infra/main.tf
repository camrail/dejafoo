# Main Terraform configuration for dejafoo infrastructure
# This file defines the core infrastructure components

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
  # Only use profile if aws_profile is explicitly set and not empty
  # In CodeBuild, this will be empty and use environment variables instead
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "aws_profile" {
  description = "AWS profile to use"
  type        = string
  default     = "dejafoo"
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

variable "domain_name" {
  description = "Domain name for dejafoo (e.g., dejafoo.io)"
  type        = string
  default     = ""
}

variable "github_token" {
  description = "GitHub Personal Access Token for private repository access"
  type        = string
  sensitive   = true
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# CodeBuild source credential for GitHub
resource "aws_codebuild_source_credential" "github" {
  auth_type   = "PERSONAL_ACCESS_TOKEN"
  server_type = "GITHUB"
  token       = var.github_token
}

# Secrets Manager secret for deployment credentials
resource "aws_secretsmanager_secret" "dejafoo_secrets" {
  name                    = "${local.project_name}-${var.environment}-secrets"
  description             = "Deployment secrets for dejafoo ${var.environment}"
  recovery_window_in_days = 7

  tags = local.common_tags
}

# Secret version with placeholder values
resource "aws_secretsmanager_secret_version" "dejafoo_secrets" {
  secret_id = aws_secretsmanager_secret.dejafoo_secrets.id
  secret_string = jsonencode({
    # These will be updated manually in AWS Console
    github_token      = "your_github_personal_access_token_here"
    aws_access_key_id = "your_aws_access_key_here"
    aws_secret_key    = "your_aws_secret_key_here"
    domain_name       = var.domain_name
  })

  tags = local.common_tags
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
  count = fileexists(var.lambda_zip_path) ? 1 : 0
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

# Route53 module (only if domain_name is provided)
module "route53" {
  count  = var.domain_name != "" ? 1 : 0
  source = "./modules/route53"
  
  domain_name                  = var.domain_name
  lambda_function_url_domain   = length(module.lambda) > 0 ? module.lambda[0].function_url_domain : ""
  lambda_function_url_zone_id  = length(module.lambda) > 0 ? module.lambda[0].function_url_zone_id : ""
  tags                        = local.common_tags
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
  value       = length(module.lambda) > 0 ? module.lambda[0].function_url : "Lambda not deployed yet"
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = length(module.lambda) > 0 ? module.lambda[0].function_name : "Lambda not deployed yet"
}

output "codebuild_project_name" {
  description = "CodeBuild project name"
  value       = module.codebuild.codebuild_project_name
}

output "secrets_manager_secret_name" {
  description = "Secrets Manager secret name"
  value       = aws_secretsmanager_secret.dejafoo_secrets.name
}

output "domain_name" {
  description = "Domain name (if configured)"
  value       = var.domain_name != "" ? var.domain_name : "Not configured"
}

output "route53_name_servers" {
  description = "Route53 name servers (if domain configured)"
  value       = var.domain_name != "" ? module.route53[0].name_servers : []
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (if domain configured)"
  value       = var.domain_name != "" ? module.route53[0].cloudfront_domain_name : "Not configured"
}
