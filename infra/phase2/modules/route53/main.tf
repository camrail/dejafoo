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

# SSL Certificate for wildcard domain (regional endpoint - same region as API Gateway)
resource "aws_acm_certificate" "dejafoo_wildcard" {
  domain_name       = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = var.tags
}

# Certificate validation records
resource "aws_route53_record" "dejafoo_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.dejafoo_wildcard.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.dejafoo.zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "dejafoo_wildcard" {
  certificate_arn         = aws_acm_certificate.dejafoo_wildcard.arn
  validation_record_fqdns = [for record in aws_route53_record.dejafoo_cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# A records are now handled in Phase 2
# This module only handles hosted zone and certificate