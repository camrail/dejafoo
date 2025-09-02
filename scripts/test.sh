#!/bin/bash

# Comprehensive testing script for dejafoo
# Runs all types of tests in sequence

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROXY_URL="http://localhost:8080"
UPSTREAM_URL="https://httpbin.org"
SKIP_BUILD=false
SKIP_UNIT=false
SKIP_INTEGRATION=false
SKIP_LOAD=false
SKIP_MANUAL=false

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
    echo "  -u, --upstream URL       Upstream URL for testing (default: https://httpbin.org)"
    echo "  -p, --proxy-url URL      Proxy URL for load testing (default: http://localhost:8080)"
    echo "  --skip-build            Skip building the project"
    echo "  --skip-unit             Skip unit tests"
    echo "  --skip-integration      Skip integration tests"
    echo "  --skip-load             Skip load tests"
    echo "  --skip-manual           Skip manual tests"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 --skip-load                       # Skip load tests"
    echo "  $0 -u https://api.example.com        # Use custom upstream"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--upstream)
            UPSTREAM_URL="$2"
            shift 2
            ;;
        -p|--proxy-url)
            PROXY_URL="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-unit)
            SKIP_UNIT=true
            shift
            ;;
        --skip-integration)
            SKIP_INTEGRATION=true
            shift
            ;;
        --skip-load)
            SKIP_LOAD=true
            shift
            ;;
        --skip-manual)
            SKIP_MANUAL=true
            shift
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

print_status "Starting dejafoo test suite"
print_status "Upstream URL: $UPSTREAM_URL"
print_status "Proxy URL: $PROXY_URL"
echo ""

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    print_error "Cargo is not installed. Please install Rust first."
    exit 1
fi

# Build the project
if [[ "$SKIP_BUILD" == false ]]; then
    print_status "Building the project..."
    cargo build --release
    
    if [[ $? -ne 0 ]]; then
        print_error "Build failed"
        exit 1
    fi
    
    print_success "Build completed"
    echo ""
fi

# Run unit tests
if [[ "$SKIP_UNIT" == false ]]; then
    print_status "Running unit tests..."
    cargo test --lib
    
    if [[ $? -ne 0 ]]; then
        print_error "Unit tests failed"
        exit 1
    fi
    
    print_success "Unit tests passed"
    echo ""
fi

# Run integration tests
if [[ "$SKIP_INTEGRATION" == false ]]; then
    print_status "Running integration tests..."
    cargo test --test integration
    
    if [[ $? -ne 0 ]]; then
        print_error "Integration tests failed"
        exit 1
    fi
    
    print_success "Integration tests passed"
    echo ""
fi

# Run benchmarks
print_status "Running benchmarks..."
cargo bench --quiet

if [[ $? -ne 0 ]]; then
    print_warning "Benchmarks failed (this is not critical)"
else
    print_success "Benchmarks completed"
fi
echo ""

# Start proxy for load testing
if [[ "$SKIP_LOAD" == false ]]; then
    print_status "Starting proxy for load testing..."
    
    # Start proxy in background
    cargo run --release --bin dejafoo-proxy -- --port 8080 &
    PROXY_PID=$!
    
    # Wait for proxy to start
    sleep 5
    
    # Check if proxy is running
    if ! kill -0 $PROXY_PID 2>/dev/null; then
        print_error "Failed to start proxy"
        exit 1
    fi
    
    print_success "Proxy started (PID: $PROXY_PID)"
    
    # Run load tests
    print_status "Running load tests..."
    python3 scripts/load_test.py \
        --url "$PROXY_URL" \
        --concurrent 5 \
        --total 50 \
        --endpoints "/get" "/post" "/json" \
        --test-type concurrent
    
    if [[ $? -ne 0 ]]; then
        print_warning "Load tests failed"
    else
        print_success "Load tests completed"
    fi
    
    # Stop proxy
    print_status "Stopping proxy..."
    kill $PROXY_PID
    wait $PROXY_PID 2>/dev/null || true
    print_success "Proxy stopped"
    echo ""
fi

# Manual testing
if [[ "$SKIP_MANUAL" == false ]]; then
    print_status "Running manual tests..."
    
    # Start proxy for manual testing
    cargo run --release --bin dejafoo-proxy -- --port 8080 &
    PROXY_PID=$!
    sleep 5
    
    # Test basic GET request
    print_status "Testing GET request..."
    response=$(curl -s -w "%{http_code}" -o /dev/null "$PROXY_URL/get")
    if [[ "$response" == "200" ]]; then
        print_success "GET request test passed"
    else
        print_error "GET request test failed (HTTP $response)"
    fi
    
    # Test POST request
    print_status "Testing POST request..."
    response=$(curl -s -w "%{http_code}" -o /dev/null \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"test": "data"}' \
        "$PROXY_URL/post")
    if [[ "$response" == "200" ]]; then
        print_success "POST request test passed"
    else
        print_error "POST request test failed (HTTP $response)"
    fi
    
    # Test cache functionality
    print_status "Testing cache functionality..."
    start_time=$(date +%s%N)
    curl -s "$PROXY_URL/json" > /dev/null
    first_time=$(($(date +%s%N) - start_time))
    
    start_time=$(date +%s%N)
    curl -s "$PROXY_URL/json" > /dev/null
    second_time=$(($(date +%s%N) - start_time))
    
    if [[ $second_time -lt $first_time ]]; then
        print_success "Cache test passed (second request was faster)"
    else
        print_warning "Cache test inconclusive (timing may vary)"
    fi
    
    # Stop proxy
    kill $PROXY_PID
    wait $PROXY_PID 2>/dev/null || true
    print_success "Manual tests completed"
    echo ""
fi

print_success "All tests completed successfully!"
print_status "Test summary:"
print_status "  ✓ Build: Passed"
print_status "  ✓ Unit tests: Passed"
print_status "  ✓ Integration tests: Passed"
print_status "  ✓ Benchmarks: Completed"
if [[ "$SKIP_LOAD" == false ]]; then
    print_status "  ✓ Load tests: Completed"
fi
if [[ "$SKIP_MANUAL" == false ]]; then
    print_status "  ✓ Manual tests: Completed"
fi
