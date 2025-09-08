# Provider configuration moved to main.tf

# Required providers for Route53 module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Route53 hosted zone for dejafoo domain
resource "aws_route53_zone" "dejafoo" {
  name = var.domain_name

  tags = var.tags
}

# Certificate creation moved to Phase 2

# A records are now handled in Phase 2
# This module only handles hosted zone and certificate