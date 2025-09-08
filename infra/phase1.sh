#!/bin/bash

# Phase 1: Deploy Core Infrastructure
echo "🚀 Phase 1: Deploying Core Infrastructure..."

# Set AWS profile
export AWS_PROFILE=dejafoo

# Change to phase1 directory
cd phase1

# Initialize Terraform for core infrastructure
terraform init

# Deploy core infrastructure
terraform apply -var-file="terraform.tfvars" -auto-approve

# Get outputs for Phase 2
echo "📋 Phase 1 Complete! Here are the outputs for Phase 2:"
echo ""
echo "Lambda Function Name:"
terraform output lambda_function_name

echo ""
echo "Lambda Invoke ARN:"
terraform output lambda_invoke_arn

echo ""
echo "API Gateway ID:"
terraform output api_gateway_id

echo ""
echo "S3 Bucket Name:"
terraform output s3_bucket_name

echo ""
echo "Nameservers (update your domain's nameservers to these):"
terraform output nameservers

echo ""
echo "Hosted Zone ID:"
terraform output hosted_zone_id

echo ""
echo "✅ Phase 1 Complete! Update your domain's nameservers, then update ../phase2/dns.tfvars with the hosted_zone_id, then run ../phase2.sh"
