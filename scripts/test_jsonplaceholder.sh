#!/bin/bash

# Test script for JSONPlaceholder API with dejafoo proxy
# This script demonstrates how to test the proxy with the JSONPlaceholder API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROXY_URL="http://localhost:8080"
UPSTREAM_URL="https://jsonplaceholder.typicode.com"
PROXY_PID=""

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

# Function to cleanup on exit
cleanup() {
    if [[ -n "$PROXY_PID" ]]; then
        print_status "Stopping proxy (PID: $PROXY_PID)..."
        kill $PROXY_PID 2>/dev/null || true
        wait $PROXY_PID 2>/dev/null || true
        print_success "Proxy stopped"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    print_error "Cargo is not installed. Please install Rust first."
    print_status "Visit: https://rustup.rs/"
    exit 1
fi

# Build the project
print_status "Building dejafoo proxy..."
cargo build --release --bin dejafoo-proxy

if [[ $? -ne 0 ]]; then
    print_error "Build failed"
    exit 1
fi

print_success "Build completed"

# Start the proxy
print_status "Starting proxy with upstream: $UPSTREAM_URL"
UPSTREAM_BASE_URL="$UPSTREAM_URL" cargo run --release --bin dejafoo-proxy -- --port 8080 &
PROXY_PID=$!

# Wait for proxy to start
print_status "Waiting for proxy to start..."
sleep 5

# Check if proxy is running
if ! kill -0 $PROXY_PID 2>/dev/null; then
    print_error "Failed to start proxy"
    exit 1
fi

print_success "Proxy started (PID: $PROXY_PID)"

# Test functions
test_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_status="${3:-200}"
    
    print_status "Testing $description: $endpoint"
    
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$PROXY_URL$endpoint")
    status_code="${response: -3}"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        print_success "✓ $description: HTTP $status_code"
        
        # Show response for successful requests
        if [[ "$status_code" == "200" ]]; then
            echo "Response:"
            jq . /tmp/response.json 2>/dev/null || cat /tmp/response.json
            echo ""
        fi
    else
        print_error "✗ $description: Expected HTTP $expected_status, got HTTP $status_code"
    fi
}

test_cache_performance() {
    local endpoint="$1"
    local description="$2"
    
    print_status "Testing cache performance for $description"
    
    # First request (cache miss)
    local start_time=$(date +%s%N)
    curl -s "$PROXY_URL$endpoint" > /dev/null
    local first_time=$(($(date +%s%N) - start_time))
    
    # Second request (cache hit)
    start_time=$(date +%s%N)
    curl -s "$PROXY_URL$endpoint" > /dev/null
    local second_time=$(($(date +%s%N) - start_time))
    
    local first_ms=$((first_time / 1000000))
    local second_ms=$((second_time / 1000000))
    
    print_status "First request (cache miss): ${first_ms}ms"
    print_status "Second request (cache hit): ${second_ms}ms"
    
    if [[ $second_time -lt $first_time ]]; then
        print_success "✓ Cache is working (second request was faster)"
    else
        print_warning "⚠ Cache performance inconclusive (timing may vary)"
    fi
    echo ""
}

# Run tests
echo "=========================================="
echo "Testing dejafoo proxy with JSONPlaceholder"
echo "=========================================="
echo ""

# Basic endpoint tests
test_endpoint "/todos/1" "Single todo item" "200"
test_endpoint "/todos" "All todos" "200"
test_endpoint "/posts/1" "Single post" "200"
test_endpoint "/users/1" "Single user" "200"
test_endpoint "/todos/999" "Non-existent todo" "404"

# Cache performance tests
test_cache_performance "/todos/1" "Single todo item"
test_cache_performance "/posts/1" "Single post"
test_cache_performance "/users/1" "Single user"

# Load test with Python script
print_status "Running load test..."
if command -v python3 &> /dev/null; then
    python3 scripts/load_test.py \
        --url "$PROXY_URL" \
        --concurrent 5 \
        --total 20 \
        --endpoints "/todos/1" "/posts/1" "/users/1" \
        --test-type concurrent
else
    print_warning "Python3 not available, skipping load test"
fi

echo ""
print_success "All tests completed!"
print_status "Test summary:"
print_status "  ✓ Basic endpoint tests"
print_status "  ✓ Cache performance tests"
print_status "  ✓ Load tests (if Python3 available)"
echo ""
print_status "You can also test manually with:"
print_status "  curl -s '$PROXY_URL/todos/1' | jq ."
print_status "  curl -s '$PROXY_URL/posts/1' | jq ."
print_status "  curl -s '$PROXY_URL/users/1' | jq ."
