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

output "certificate_arn" {
  description = "SSL certificate ARN"
  value       = aws_acm_certificate_validation.dejafoo_wildcard.certificate_arn
}
