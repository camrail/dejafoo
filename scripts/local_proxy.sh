#!/bin/bash

# Local proxy test script
# Runs the dejafoo proxy locally for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PORT=8080
UPSTREAM_URL=""
LOG_LEVEL="INFO"
CONFIG_DIR="./config"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --port PORT          Port to run the proxy on (default: 8080)"
    echo "  -u, --upstream URL       Upstream URL to proxy to (required)"
    echo "  -l, --log-level LEVEL    Log level (TRACE, DEBUG, INFO, WARN, ERROR) (default: INFO)"
    echo "  -c, --config-dir DIR     Configuration directory (default: ./config)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -u https://api.example.com"
    echo "  $0 -p 3000 -u https://api.example.com -l DEBUG"
    echo "  $0 --upstream https://api.example.com --config-dir /opt/config"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -u|--upstream)
            UPSTREAM_URL="$2"
            shift 2
            ;;
        -l|--log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        -c|--config-dir)
            CONFIG_DIR="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$UPSTREAM_URL" ]]; then
    print_error "Upstream URL is required"
    show_usage
    exit 1
fi

# Validate log level
case "$LOG_LEVEL" in
    TRACE|DEBUG|INFO|WARN|ERROR)
        ;;
    *)
        print_error "Invalid log level: $LOG_LEVEL"
        print_error "Valid levels: TRACE, DEBUG, INFO, WARN, ERROR"
        exit 1
        ;;
esac

# Check if config directory exists
if [[ ! -d "$CONFIG_DIR" ]]; then
    print_warning "Config directory does not exist: $CONFIG_DIR"
    print_warning "Creating default config files..."
    mkdir -p "$CONFIG_DIR"
    
    # Create default config files
    cat > "$CONFIG_DIR/policies.yaml" << EOF
default_ttl: 3600
max_body_size: 10485760
headers_to_vary:
  - authorization
  - x-api-key
  - x-user-id

endpoint_policies:
  "GET /api/users":
    ttl: 300
    max_body_size: 1048576
    headers_to_vary:
      - authorization
    cacheable: true
    methods:
      - GET
  
  "POST *":
    cacheable: false
    methods:
      - POST
EOF

    cat > "$CONFIG_DIR/allowlist.yaml" << EOF
allowed_hosts:
  - api.example.com
  - api.staging.example.com
  - localhost
  - 127.0.0.1

allowed_schemes:
  - https
  - http

blocked_paths:
  - /admin/*
  - /internal/*
  - /debug/*
EOF

    cat > "$CONFIG_DIR/env.sample" << EOF
# Environment variables for dejafoo
UPSTREAM_BASE_URL=$UPSTREAM_URL
LOG_LEVEL=$LOG_LEVEL
DYNAMODB_TABLE_NAME=dejafoo-cache
S3_BUCKET_NAME=dejafoo-cache-storage
MAX_BODY_SIZE=10485760
CACHE_POLICY_CONFIG=$CONFIG_DIR/policies.yaml
ALLOWLIST_CONFIG=$CONFIG_DIR/allowlist.yaml
EOF

    print_success "Created default config files in $CONFIG_DIR"
fi

# Set environment variables
export UPSTREAM_BASE_URL="$UPSTREAM_URL"
export LOG_LEVEL="$LOG_LEVEL"
export CONFIG_DIR="$CONFIG_DIR"

# Check if we're in a Rust project
if [[ -f "Cargo.toml" ]]; then
    print_status "Detected Rust project"
    
    # Check if cargo is installed
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo is not installed. Please install Rust first."
        exit 1
    fi
    
    # Build the project
    print_status "Building the project..."
    cargo build --release
    
    if [[ $? -ne 0 ]]; then
        print_error "Build failed"
        exit 1
    fi
    
    print_success "Build completed"
    
    # Run the proxy
    print_status "Starting dejafoo proxy on port $PORT..."
    print_status "Upstream URL: $UPSTREAM_URL"
    print_status "Log level: $LOG_LEVEL"
    print_status "Config directory: $CONFIG_DIR"
    print_status ""
    print_status "Test the proxy with:"
    print_status "  curl -X GET http://localhost:$PORT/api/users"
    print_status "  curl -X POST http://localhost:$PORT/api/users -H 'Content-Type: application/json' -d '{\"name\": \"test\"}'"
    print_status ""
    print_status "Press Ctrl+C to stop the proxy"
    print_status ""
    
    # Run the proxy
    cargo run --release --bin dejafoo-proxy -- --port $PORT
    
else
    print_error "Cargo.toml not found"
    print_error "Please run this script from the project root directory"
    exit 1
fi
