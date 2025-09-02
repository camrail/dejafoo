#!/bin/bash

# Deploy script for dejafoo Lambda function
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="dejafoo"
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
LAMBDA_ZIP="lambda-deployment.zip"

echo -e "${GREEN}🚀 Deploying dejafoo to AWS Lambda${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Region: ${AWS_REGION}${NC}"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

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
terraform init

# Plan deployment
terraform plan \
    -var="aws_region=${AWS_REGION}" \
    -var="environment=${ENVIRONMENT}" \
    -var="lambda_zip_path=../${LAMBDA_ZIP}" \
    -out=tfplan

# Apply deployment
echo -e "${GREEN}🚀 Applying deployment...${NC}"
terraform apply tfplan

# Get outputs
echo -e "${GREEN}📋 Deployment outputs:${NC}"
terraform output

cd ..

# Clean up
rm -f ${LAMBDA_ZIP}
rm -rf target/lambda

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${YELLOW}Your Lambda function URL is available in the Terraform outputs above.${NC}"
