# CodeBuild project for dejafoo
resource "aws_codebuild_project" "dejafoo" {
  name          = "${var.project_name}-${var.environment}-build"
  description   = "Build and deploy dejafoo Lambda function"
  service_role  = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_MEDIUM"
    image                      = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                       = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode            = true

    environment_variable {
      name  = "PROJECT_NAME"
      value = var.project_name
    }

    environment_variable {
      name  = "ENVIRONMENT"
      value = var.environment
    }

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "SECRETS_MANAGER_SECRET_NAME"
      value = data.aws_secretsmanager_secret.dejafoo_secrets.name
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repo_url
    git_clone_depth = 1
    buildspec       = "buildspec.yml"

    git_submodules_config {
      fetch_submodules = false
    }
  }

  source_version = var.branch_name

  tags = var.tags
}

# IAM role for CodeBuild
resource "aws_iam_role" "codebuild_role" {
  name = "${var.project_name}-${var.environment}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM policy for CodeBuild
resource "aws_iam_role_policy" "codebuild_policy" {
  name = "${var.project_name}-${var.environment}-codebuild-policy"
  role = aws_iam_role.codebuild_role.id

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
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/codebuild/${var.project_name}-${var.environment}-build"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          data.aws_secretsmanager_secret.dejafoo_secrets.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:*",
          "iam:*",
          "dynamodb:*",
          "s3:*",
          "terraform:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Secrets Manager secret is now defined in the root module

# CloudWatch Log Group for CodeBuild
resource "aws_cloudwatch_log_group" "codebuild_logs" {
  name              = "/aws/codebuild/${var.project_name}-${var.environment}-build"
  retention_in_days = 14

  tags = var.tags
}
