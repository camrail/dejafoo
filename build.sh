#!/bin/bash

# Build documentation using MkDocs
# This script builds the documentation and can be used for local development or CI/CD

set -e

echo "Building Dejafoo documentation..."

# Check if we're in the docs directory
if [ ! -f "mkdocs.yml" ]; then
    echo "Error: mkdocs.yml not found. Please run this script from the docs directory."
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Build the documentation
echo "Building documentation with MkDocs..."
mkdocs build

echo "Documentation built successfully!"
echo "Output directory: site/"
echo ""
echo "To serve locally, run: mkdocs serve"
echo "To deploy, run: mkdocs gh-deploy"
