#!/bin/bash

# Simple curl-based test for JSONPlaceholder API
# This demonstrates the expected behavior without needing the proxy running

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="https://jsonplaceholder.typicode.com"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test function
test_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_status="${3:-200}"
    
    print_status "Testing $description: $endpoint"
    
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$API_URL$endpoint")
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

# Performance test
test_performance() {
    local endpoint="$1"
    local description="$2"
    
    print_status "Testing performance for $description"
    
    # First request
    local start_time=$(date +%s%N)
    curl -s "$API_URL$endpoint" > /dev/null
    local first_time=$(($(date +%s%N) - start_time))
    
    # Second request
    start_time=$(date +%s%N)
    curl -s "$API_URL$endpoint" > /dev/null
    local second_time=$(($(date +%s%N) - start_time))
    
    local first_ms=$((first_time / 1000000))
    local second_ms=$((second_time / 1000000))
    
    print_status "First request: ${first_ms}ms"
    print_status "Second request: ${second_ms}ms"
    echo ""
}

echo "=========================================="
echo "Testing JSONPlaceholder API directly"
echo "=========================================="
echo ""

# Test the specific endpoint you mentioned
test_endpoint "/todos/1" "Single todo item (the one you requested)" "200"

# Test other endpoints
test_endpoint "/todos" "All todos" "200"
test_endpoint "/posts/1" "Single post" "200"
test_endpoint "/users/1" "Single user" "200"
test_endpoint "/todos/999" "Non-existent todo" "404"

# Performance tests
test_performance "/todos/1" "Single todo item"
test_performance "/posts/1" "Single post"

echo ""
print_success "Direct API tests completed!"
echo ""
print_status "Expected response from /todos/1:"
curl -s "$API_URL/todos/1" | jq . 2>/dev/null || curl -s "$API_URL/todos/1"
echo ""
print_status "This is what the dejafoo proxy should return when caching this endpoint."
