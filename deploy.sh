#!/bin/bash

# Deploy documentation to GitHub Pages
# This script builds and deploys the documentation to GitHub Pages

set -e

echo "Deploying Dejafoo documentation to GitHub Pages..."

# Check if we're in the docs directory
if [ ! -f "mkdocs.yml" ]; then
    echo "Error: mkdocs.yml not found. Please run this script from the docs directory."
    exit 1
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "Error: Not in a git repository. Please run this script from the project root."
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Deploy to GitHub Pages
echo "Deploying to GitHub Pages..."
mkdocs gh-deploy --force

echo "Documentation deployed successfully!"
echo "Check your GitHub Pages settings to see the live documentation."
