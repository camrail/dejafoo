# Route53 hosted zone for dejafoo domain
resource "aws_route53_zone" "dejafoo" {
  name = var.domain_name

  tags = var.tags
}

# SSL Certificate for wildcard domain
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

# Wildcard subdomain CNAME record (points to Lambda Function URL)
# We'll add the DNS records manually after Lambda is created
# since Terraform can't handle the dependency properly
resource "aws_route53_record" "dejafoo_wildcard" {
  zone_id = aws_route53_zone.dejafoo.zone_id
  name    = "*.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.lambda_function_url_domain]
}

# CloudFront distribution for HTTPS and better performance
resource "aws_cloudfront_distribution" "dejafoo" {
  count = 0
  
  origin {
    domain_name = var.lambda_function_url_domain
    origin_id   = "dejafoo-lambda"

    custom_origin_config {
      http_port              = 443
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = ""

  aliases = [var.domain_name, "*.${var.domain_name}"]

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "dejafoo-lambda"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Authorization", "Content-Type", "X-Forwarded-For", "X-Forwarded-Proto"]
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # Cache behavior for API calls (no caching)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "dejafoo-lambda"

    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.dejafoo_wildcard.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = var.tags
}

# Update Route53 records to point to CloudFront
# CloudFront-specific A records removed - using Lambda Function URLs directly
