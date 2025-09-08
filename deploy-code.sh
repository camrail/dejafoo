#!/bin/bash

# Simple deployment script for JavaScript Lambda
# No CodeBuild needed - deploy directly from local machine

set -e

echo "🚀 Deploying Dejafoo JavaScript Lambda..."

# Check if function exists
FUNCTION_NAME="dejafoo-proxy-prod"
if aws lambda get-function --function-name $FUNCTION_NAME >/dev/null 2>&1; then
    echo "✅ Lambda function exists, updating code..."
    
    # Create deployment package
    echo "📦 Creating deployment package..."
    zip -r dejafoo-lambda.zip index.js package.json node_modules/
    
    # Update function code
    echo "🔄 Updating Lambda function code..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://dejafoo-lambda.zip
    
    echo "⏳ Waiting for function update to complete..."
    aws lambda wait function-updated --function-name $FUNCTION_NAME
    
    echo "✅ Deployment completed successfully!"
    
    # Get function URL
    FUNCTION_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --query 'FunctionUrl' --output text 2>/dev/null || echo "No function URL configured")
    echo "🌐 Function URL: $FUNCTION_URL"
    
    # Clean up
    rm dejafoo-lambda.zip
    
else
    echo "❌ Lambda function not found. Please run 'terraform apply' first to create the infrastructure."
    exit 1
fi
