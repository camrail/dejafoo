variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# lambda_zip_path hardcoded to dejafoo-lambda.zip

# No upstream_base_url needed for managed service

variable "s3_bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}
