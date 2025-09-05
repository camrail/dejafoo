output "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  value       = aws_route53_zone.dejafoo.zone_id
}

output "name_servers" {
  description = "Route53 name servers for domain delegation"
  value       = aws_route53_zone.dejafoo.name_servers
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = length(aws_cloudfront_distribution.dejafoo) > 0 ? aws_cloudfront_distribution.dejafoo[0].id : ""
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = length(aws_cloudfront_distribution.dejafoo) > 0 ? aws_cloudfront_distribution.dejafoo[0].domain_name : ""
}

output "ssl_certificate_arn" {
  description = "SSL certificate ARN"
  value       = aws_acm_certificate_validation.dejafoo_wildcard.certificate_arn
}
