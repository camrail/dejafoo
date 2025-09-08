# DNS Infrastructure - Phase 2
# This requires nameservers to be updated first

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

# Route53 Hosted Zone
module "route53" {
  count  = var.domain_name != "" ? 1 : 0
  source = "./modules/route53"
  
  domain_name                = var.domain_name
  api_gateway_domain_name    = module.apigateway.regional_domain_name
  api_gateway_zone_id        = module.apigateway.regional_zone_id
  tags                       = local.common_tags
}

# API Gateway with custom domain
module "apigateway" {
  source = "./modules/apigateway"
  
  project_name = local.project_name
  environment  = var.environment
  tags         = local.common_tags
  
  domain_name = var.domain_name
  
  lambda_function_name = var.lambda_function_name
  lambda_invoke_arn    = var.lambda_invoke_arn
}

# Outputs
output "nameservers" {
  value = var.domain_name != "" ? module.route53[0].nameservers : []
  description = "Update your domain's nameservers to these values"
}

output "api_gateway_url" {
  value = module.apigateway.api_url
}

output "custom_domain_url" {
  value = var.domain_name != "" ? "https://${var.domain_name}" : "N/A"
}
