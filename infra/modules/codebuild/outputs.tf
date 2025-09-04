output "codebuild_project_name" {
  description = "Name of the CodeBuild project"
  value       = aws_codebuild_project.dejafoo.name
}

output "codebuild_project_arn" {
  description = "ARN of the CodeBuild project"
  value       = aws_codebuild_project.dejafoo.arn
}

# Secrets Manager outputs are now handled by the root module
