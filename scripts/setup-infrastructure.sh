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
AWS_PROFILE=${AWS_PROFILE:-dejafoo}
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

# Check if AWS CLI is configured
echo -e "${YELLOW}🔍 Checking AWS credentials (profile: ${AWS_PROFILE})...${NC}"
if ! aws sts get-caller-identity --profile ${AWS_PROFILE} > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured or credentials are invalid.${NC}"
    echo -e "${YELLOW}Please run 'aws configure' and provide valid credentials.${NC}"
    echo -e "${YELLOW}You can also set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.${NC}"
    exit 1
fi

# Show current AWS identity
AWS_IDENTITY=$(aws sts get-caller-identity --profile ${AWS_PROFILE} --query 'Account' --output text)
echo -e "${GREEN}✅ AWS credentials valid (Account: ${AWS_IDENTITY}, Profile: ${AWS_PROFILE})${NC}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found. Please install it first.${NC}"
    exit 1
fi

# Initialize and apply Terraform
echo -e "${YELLOW}🏗️ Initializing Terraform...${NC}"
cd infra
if ! terraform init; then
    echo -e "${RED}❌ Terraform initialization failed${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Planning infrastructure...${NC}"
if ! terraform plan \
    -var="aws_region=$AWS_REGION" \
    -var="aws_profile=$AWS_PROFILE" \
    -var="environment=$ENVIRONMENT" \
    -var="github_repo_url=$GITHUB_REPO_URL" \
    -var="lambda_zip_path=placeholder.zip"; then
    echo -e "${RED}❌ Terraform plan failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🚀 Creating infrastructure...${NC}"
if ! terraform apply \
    -var="aws_region=$AWS_REGION" \
    -var="aws_profile=$AWS_PROFILE" \
    -var="environment=$ENVIRONMENT" \
    -var="github_repo_url=$GITHUB_REPO_URL" \
    -var="lambda_zip_path=placeholder.zip" \
    -auto-approve; then
    echo -e "${RED}❌ Terraform apply failed${NC}"
    exit 1
fi

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
