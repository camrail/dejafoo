# Lambda function for dejafoo proxy
resource "aws_lambda_function" "dejafoo_proxy" {
  function_name = "${var.project_name}-proxy-${var.environment}"
  role         = aws_iam_role.lambda_role.arn
  handler      = "index.handler"
  runtime      = "nodejs18.x"
  filename     = "dejafoo-lambda.zip"
  source_code_hash = filebase64sha256("dejafoo-lambda.zip")
  
  timeout = 30
  memory_size = 512
  
  # Ignore changes to code since deployment script manages it
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
  
  environment {
    variables = {
      NODE_ENV = "production"
      S3_BUCKET_NAME = var.s3_bucket_name
      UPSTREAM_BASE_URL = "https://httpbin.org"  # Default for testing
      CACHE_TTL_SECONDS = "3600"  # 1 hour cache TTL
    }
  }
  
  tags = var.tags
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.tags
}

# IAM policy for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      }
    ]
  })
}

# Lambda function URL removed - using API Gateway instead

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.dejafoo_proxy.function_name}"
  retention_in_days = 14
  
  tags = var.tags
}
