#!/bin/bash

# Serve documentation locally using MkDocs
# This script starts a local development server for the documentation

set -e

echo "Starting Dejafoo documentation server..."

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

# Start the development server
echo "Starting MkDocs development server..."
echo "Documentation will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""

mkdocs serve
