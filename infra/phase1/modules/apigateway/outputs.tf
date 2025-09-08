output "api_gateway_url" {
  description = "API Gateway URL"
  value       = aws_api_gateway_deployment.dejafoo_deployment.invoke_url
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_api_gateway_rest_api.dejafoo_api.id
}

output "domain_name" {
  description = "Custom domain name (if configured)"
  value       = var.domain_name != "" ? aws_api_gateway_domain_name.dejafoo_domain[0].domain_name : ""
}

output "regional_domain_name" {
  description = "Regional domain name for custom domain"
  value       = var.domain_name != "" ? aws_api_gateway_domain_name.dejafoo_domain[0].domain_name : ""
}

output "regional_zone_id" {
  description = "Regional hosted zone ID for custom domain"
  value       = var.domain_name != "" ? aws_api_gateway_domain_name.dejafoo_domain[0].cloudfront_zone_id : ""
}
