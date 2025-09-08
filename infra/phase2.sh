#!/bin/bash

# Phase 2: Deploy DNS Infrastructure
echo "🌐 Phase 2: Deploying DNS Infrastructure..."

# Set AWS profile
export AWS_PROFILE=dejafoo

# Change to phase2 directory
cd phase2

# Get Phase 1 outputs automatically
echo "📋 Getting Phase 1 outputs..."
cd ../phase1
LAMBDA_FUNCTION_NAME=$(terraform output -raw lambda_function_name)
LAMBDA_INVOKE_ARN=$(terraform output -raw lambda_invoke_arn)
HOSTED_ZONE_ID=$(terraform output -raw hosted_zone_id)
API_GATEWAY_ID=$(terraform output -raw api_gateway_id)
cd ../phase2

# Create dns.tfvars with Phase 1 outputs
echo "📝 Creating dns.tfvars with Phase 1 outputs..."
cat > dns.tfvars << EOF
# DNS Phase Variables
environment = "prod"
aws_region = "eu-west-3"
domain_name = "dejafoo.io"

# Phase 1 outputs
lambda_function_name = "$LAMBDA_FUNCTION_NAME"
lambda_invoke_arn = "$LAMBDA_INVOKE_ARN"
hosted_zone_id = "$HOSTED_ZONE_ID"
api_gateway_id = "$API_GATEWAY_ID"
EOF

echo "✅ dns.tfvars updated with Phase 1 outputs"

# Initialize Terraform for DNS infrastructure
terraform init

# Deploy DNS infrastructure
terraform apply -var-file="dns.tfvars" -auto-approve

# Show nameservers
echo "📋 Phase 2 Complete! Update your domain's nameservers to:"
terraform output nameservers

echo ""
echo "✅ Phase 2 Complete! After updating nameservers, your domain will be ready."
