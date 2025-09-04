# Lambda function for dejafoo proxy
resource "aws_lambda_function" "dejafoo_proxy" {
  function_name = "${var.project_name}-proxy-${var.environment}"
  role         = aws_iam_role.lambda_role.arn
  handler      = "bootstrap"
  runtime      = "provided.al2"
  filename     = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  
  timeout = 30
  memory_size = 512
  
  environment {
    variables = {
      RUST_LOG = "info"
      DYNAMODB_TABLE_NAME = var.dynamodb_table_name
      S3_BUCKET_NAME = var.s3_bucket_name
      # No UPSTREAM_BASE_URL - customers provide their own URLs
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
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/${var.dynamodb_table_name}"
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

# Lambda function URL
resource "aws_lambda_function_url" "dejafoo_proxy_url" {
  function_name      = aws_lambda_function.dejafoo_proxy.function_name
  authorization_type = "NONE"
  
  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age          = 86400
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.dejafoo_proxy.function_name}"
  retention_in_days = 14
  
  tags = var.tags
}
