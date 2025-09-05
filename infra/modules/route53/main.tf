# Provider configuration moved to main.tf

# Required providers for Route53 module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

# Route53 hosted zone for dejafoo domain
resource "aws_route53_zone" "dejafoo" {
  name = var.domain_name

  tags = var.tags
}

# SSL Certificate for wildcard domain (must be in us-east-1 for EDGE endpoints)
resource "aws_acm_certificate" "dejafoo_wildcard" {
  provider = aws.us_east_1
  
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
  provider = aws.us_east_1
  
  certificate_arn         = aws_acm_certificate.dejafoo_wildcard.arn
  validation_record_fqdns = [for record in aws_route53_record.dejafoo_cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# Wildcard subdomain CNAME record (points to API Gateway CloudFront)
resource "aws_route53_record" "dejafoo_wildcard" {
  zone_id = aws_route53_zone.dejafoo.zone_id
  name    = "*.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.api_gateway_domain_name]
}

# Apex domain A record (points to API Gateway CloudFront)
resource "aws_route53_record" "dejafoo_main" {
  zone_id = aws_route53_zone.dejafoo.zone_id
  name    = var.domain_name
  type    = "A"
  
  alias {
    name                   = var.api_gateway_domain_name
    zone_id                = var.api_gateway_zone_id
    evaluate_target_health = false
  }
}

# CloudFront distribution removed - using API Gateway with custom domain
