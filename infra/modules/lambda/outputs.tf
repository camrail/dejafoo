output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.dejafoo_proxy.function_name
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.dejafoo_proxy.arn
}

output "function_url" {
  description = "URL of the Lambda function"
  value       = aws_lambda_function_url.dejafoo_proxy_url.function_url
}

output "role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

output "function_url_domain" {
  description = "Domain name of the Lambda Function URL"
  value       = replace(replace(aws_lambda_function_url.dejafoo_proxy_url.function_url, "https://", ""), "/", "")
}

output "function_url_zone_id" {
  description = "Hosted zone ID for Lambda Function URL"
  value       = "Z2FDTNDATAQYW2"  # This is the standard Lambda Function URL zone ID
}
