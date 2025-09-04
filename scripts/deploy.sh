#!/bin/bash

# Deploy script for dejafoo Lambda function
set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env file"
    export $(grep -v '^#' .env | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - can be overridden by environment variables
PROJECT_NAME=${DEJAFOO_PROJECT_NAME:-dejafoo}
ENVIRONMENT=${DEJAFOO_ENVIRONMENT:-${1:-dev}}
AWS_REGION=${AWS_DEFAULT_REGION:-${2:-eu-west-3}}
AWS_PROFILE=${AWS_PROFILE:-dejafoo}
LAMBDA_ZIP="lambda-deployment.zip"

echo -e "${GREEN}🚀 Deploying dejafoo to AWS Lambda${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Region: ${AWS_REGION}${NC}"

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
    echo -e "${RED}❌ Terraform not installed. Please install Terraform first.${NC}"
    exit 1
fi

# Build the Lambda function
echo -e "${GREEN}📦 Building Lambda function...${NC}"
cargo build --release --target x86_64-unknown-linux-gnu

# Create deployment package
echo -e "${GREEN}📦 Creating deployment package...${NC}"
mkdir -p target/lambda
cp target/x86_64-unknown-linux-gnu/release/dejafoo-lambda target/lambda/bootstrap
cd target/lambda
zip -r ../../${LAMBDA_ZIP} bootstrap
cd ../..

# Deploy infrastructure with Terraform
echo -e "${GREEN}🏗️  Deploying infrastructure...${NC}"
cd infra

# Initialize Terraform
echo -e "${GREEN}🏗️  Initializing Terraform...${NC}"
if ! terraform init; then
    echo -e "${RED}❌ Terraform initialization failed${NC}"
    exit 1
fi

# Plan deployment
echo -e "${GREEN}📋 Planning deployment...${NC}"
if ! terraform plan \
    -var="aws_region=${AWS_REGION}" \
    -var="aws_profile=${AWS_PROFILE}" \
    -var="environment=${ENVIRONMENT}" \
    -var="lambda_zip_path=../${LAMBDA_ZIP}" \
    -out=tfplan; then
    echo -e "${RED}❌ Terraform plan failed${NC}"
    exit 1
fi

# Apply deployment
echo -e "${GREEN}🚀 Applying deployment...${NC}"
if ! terraform apply -auto-approve tfplan; then
    echo -e "${RED}❌ Terraform apply failed${NC}"
    exit 1
fi

# Get outputs
echo -e "${GREEN}📋 Deployment outputs:${NC}"
terraform output

cd ..

# Clean up
rm -f ${LAMBDA_ZIP}
rm -rf target/lambda

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${YELLOW}Your Lambda function URL is available in the Terraform outputs above.${NC}"
