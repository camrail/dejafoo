#!/bin/bash

# Setup script for dejafoo deployment
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up dejafoo deployment environment...${NC}"

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${GREEN}📱 Detected macOS${NC}"
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}🍺 Installing Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # Install AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${GREEN}☁️  Installing AWS CLI...${NC}"
        brew install awscli
    else
        echo -e "${GREEN}✅ AWS CLI already installed${NC}"
    fi
    
    # Install Terraform
    if ! command -v terraform &> /dev/null; then
        echo -e "${GREEN}🏗️  Installing Terraform...${NC}"
        brew install terraform
    else
        echo -e "${GREEN}✅ Terraform already installed${NC}"
    fi
    
    # Install musl-cross for cross-compilation
    if ! command -v x86_64-linux-musl-gcc &> /dev/null; then
        echo -e "${GREEN}🔨 Installing musl-cross for cross-compilation...${NC}"
        brew install FiloSottile/musl-cross/musl-cross
    else
        echo -e "${GREEN}✅ musl-cross already installed${NC}"
    fi
    
else
    echo -e "${YELLOW}⚠️  Non-macOS detected. Please install the following manually:${NC}"
    echo -e "${YELLOW}   - AWS CLI: https://aws.amazon.com/cli/${NC}"
    echo -e "${YELLOW}   - Terraform: https://www.terraform.io/downloads.html${NC}"
    echo -e "${YELLOW}   - Rust cross-compilation target: rustup target add x86_64-unknown-linux-gnu${NC}"
fi

# Add Rust target for Lambda
echo -e "${GREEN}🦀 Adding Rust target for Lambda...${NC}"
rustup target add x86_64-unknown-linux-gnu

# Check AWS CLI configuration
echo -e "${GREEN}☁️  Checking AWS CLI configuration...${NC}"
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${GREEN}✅ AWS CLI configured${NC}"
    aws sts get-caller-identity
else
    echo -e "${YELLOW}⚠️  AWS CLI not configured. Please run:${NC}"
    echo -e "${YELLOW}   aws configure${NC}"
    echo -e "${YELLOW}   Enter your AWS Access Key ID, Secret Access Key, and region${NC}"
fi

# Test Rust cross-compilation
echo -e "${GREEN}🦀 Testing Rust cross-compilation...${NC}"
if cargo build --release --target x86_64-unknown-linux-gnu > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Rust cross-compilation working${NC}"
else
    echo -e "${RED}❌ Rust cross-compilation failed${NC}"
    echo -e "${YELLOW}   Make sure you have the Linux target installed:${NC}"
    echo -e "${YELLOW}   rustup target add x86_64-unknown-linux-gnu${NC}"
fi

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "${BLUE}1. Configure AWS CLI: aws configure${NC}"
echo -e "${BLUE}2. Deploy: ./scripts/deploy.sh dev us-east-1${NC}"
