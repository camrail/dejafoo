#!/bin/bash

# Troubleshooting script for Terraform issues
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Terraform Troubleshooting Script${NC}"
echo "=================================="

# Check if we're in the right directory
if [ ! -d "infra" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Check AWS CLI
echo -e "${YELLOW}🔍 Checking AWS CLI...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI found${NC}"

# Check AWS credentials
AWS_PROFILE=${AWS_PROFILE:-dejafoo}
echo -e "${YELLOW}🔍 Checking AWS credentials (profile: ${AWS_PROFILE})...${NC}"
if ! aws sts get-caller-identity --profile ${AWS_PROFILE} > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS credentials are invalid or not configured${NC}"
    echo -e "${YELLOW}Please run 'aws configure' or set environment variables:${NC}"
    echo -e "${YELLOW}  export AWS_ACCESS_KEY_ID=your_access_key${NC}"
    echo -e "${YELLOW}  export AWS_SECRET_ACCESS_KEY=your_secret_key${NC}"
    echo -e "${YELLOW}  export AWS_DEFAULT_REGION=your_region${NC}"
    exit 1
fi

AWS_IDENTITY=$(aws sts get-caller-identity --profile ${AWS_PROFILE} --query 'Account' --output text)
echo -e "${GREEN}✅ AWS credentials valid (Account: ${AWS_IDENTITY}, Profile: ${AWS_PROFILE})${NC}"

# Check Terraform
echo -e "${YELLOW}🔍 Checking Terraform...${NC}"
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found. Please install it first.${NC}"
    exit 1
fi

TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
echo -e "${GREEN}✅ Terraform found (version: ${TERRAFORM_VERSION})${NC}"

# Check for state lock issues
echo -e "${YELLOW}🔍 Checking for Terraform state lock issues...${NC}"
cd infra

if [ -f ".terraform.tfstate.lock.info" ]; then
    echo -e "${RED}❌ Terraform state lock file found${NC}"
    echo -e "${YELLOW}This usually means a previous terraform operation was interrupted.${NC}"
    echo -e "${YELLOW}Removing lock file...${NC}"
    rm -f .terraform.tfstate.lock.info
    echo -e "${GREEN}✅ Lock file removed${NC}"
else
    echo -e "${GREEN}✅ No state lock issues found${NC}"
fi

# Check terraform state
if [ -f "terraform.tfstate" ]; then
    STATE_SIZE=$(wc -c < terraform.tfstate)
    if [ "$STATE_SIZE" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Terraform state file is empty (${STATE_SIZE} bytes)${NC}"
        echo -e "${YELLOW}This might indicate a previous failed operation.${NC}"
    else
        echo -e "${GREEN}✅ Terraform state file exists (${STATE_SIZE} bytes)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No terraform state file found${NC}"
fi

# Test terraform init
echo -e "${YELLOW}🔍 Testing terraform init...${NC}"
if terraform init > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Terraform init successful${NC}"
else
    echo -e "${RED}❌ Terraform init failed${NC}"
    echo -e "${YELLOW}Running terraform init with verbose output:${NC}"
    terraform init
    exit 1
fi

# Test terraform plan (dry run)
echo -e "${YELLOW}🔍 Testing terraform plan (dry run)...${NC}"
if timeout 30 terraform plan -var="aws_region=eu-west-3" -var="aws_profile=${AWS_PROFILE}" -var="environment=dev" -var="github_repo_url=https://github.com/yourusername/dejafoo.git" -var="lambda_zip_path=placeholder.zip" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Terraform plan successful${NC}"
else
    echo -e "${RED}❌ Terraform plan failed or timed out${NC}"
    echo -e "${YELLOW}This might indicate AWS permission issues or network problems.${NC}"
    echo -e "${YELLOW}Running terraform plan with verbose output:${NC}"
    terraform plan -var="aws_region=eu-west-3" -var="aws_profile=${AWS_PROFILE}" -var="environment=dev" -var="github_repo_url=https://github.com/yourusername/dejafoo.git" -var="lambda_zip_path=placeholder.zip"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All checks passed! Terraform should work correctly now.${NC}"
echo -e "${BLUE}You can now run your deployment scripts:${NC}"
echo -e "${BLUE}  ./scripts/setup-infrastructure.sh${NC}"
echo -e "${BLUE}  ./scripts/deploy.sh${NC}"
