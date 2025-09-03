#!/bin/bash

# Setup script for dejafoo infrastructure
# This creates the initial infrastructure including CodeBuild and Secrets Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - can be overridden by environment variables or command line args
PROJECT_NAME=${1:-dejafoo}
ENVIRONMENT=${2:-dev}
AWS_REGION=${3:-eu-west-3}
GITHUB_REPO_URL=${4:-"https://github.com/yourusername/dejafoo.git"}

echo "Usage: $0 [project_name] [environment] [aws_region] [github_repo_url]"
echo "Example: $0 dejafoo-prod prod eu-west-3 https://github.com/yourusername/dejafoo.git"

echo -e "${GREEN}🚀 Setting up dejafoo infrastructure${NC}"
echo "Project: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "GitHub Repo: $GITHUB_REPO_URL"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found. Please install it first.${NC}"
    exit 1
fi

# Initialize and apply Terraform
echo -e "${YELLOW}🏗️ Initializing Terraform...${NC}"
cd infra
terraform init

echo -e "${YELLOW}📋 Planning infrastructure...${NC}"
terraform plan \
    -var="aws_region=$AWS_REGION" \
    -var="environment=$ENVIRONMENT" \
    -var="github_repo_url=$GITHUB_REPO_URL" \
    -var="lambda_zip_path=placeholder.zip"

echo -e "${YELLOW}🚀 Creating infrastructure...${NC}"
terraform apply \
    -var="aws_region=$AWS_REGION" \
    -var="environment=$ENVIRONMENT" \
    -var="github_repo_url=$GITHUB_REPO_URL" \
    -var="lambda_zip_path=placeholder.zip" \
    -auto-approve

# Get outputs
CODEBUILD_PROJECT=$(terraform output -raw codebuild_project_name)
SECRETS_NAME=$(terraform output -raw secrets_manager_secret_name)

echo ""
echo -e "${GREEN}✅ Infrastructure created successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Update secrets in AWS Secrets Manager:"
echo "   Secret name: $SECRETS_NAME"
echo "   Required values:"
echo "   - github_token: Your GitHub personal access token"
echo "   - aws_access_key_id: Your AWS access key"
echo "   - aws_secret_access_key: Your AWS secret key"
echo ""
echo "2. Start a build:"
echo "   aws codebuild start-build --project-name $CODEBUILD_PROJECT"
echo ""
echo "3. Or trigger builds automatically by pushing to your GitHub repo"
echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
