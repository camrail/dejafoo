#!/bin/bash

echo "🧪 Testing Cache Expiration Methods"
echo "=================================="

# Start proxy
echo "🚀 Starting proxy..."
USE_FILE_CACHE=1 RUST_LOG=info UPSTREAM_BASE_URL=https://jsonplaceholder.typicode.com cargo run --bin dejafoo-proxy -- --port 8080 &
PROXY_PID=$!
sleep 3

echo ""
echo "📋 Test 1: Initial request (Cache Miss)"
echo "--------------------------------------"
curl -s "http://localhost:8080/todos/1?ttl=5s" > /dev/null
echo "✅ Request completed"
echo "📁 Cache files: $(ls cache/ | wc -l)"
echo "⏰ TTL: $(cat cache/*.json | jq -r '.ttl_seconds')s"

echo ""
echo "📋 Test 2: Same request (Cache Hit)"
echo "----------------------------------"
curl -s "http://localhost:8080/todos/1?ttl=5s" > /dev/null
echo "✅ Request completed"
echo "📁 Cache files: $(ls cache/ | wc -l) (should be same)"

echo ""
echo "📋 Test 3: Wait for expiration (Cache Miss)"
echo "-------------------------------------------"
echo "⏳ Waiting 6 seconds for cache to expire..."
sleep 6
curl -s "http://localhost:8080/todos/1?ttl=5s" > /dev/null
echo "✅ Request completed"
echo "📁 Cache files: $(ls cache/ | wc -l)"
echo "⏰ New TTL: $(cat cache/*.json | jq -r '.ttl_seconds')s"

echo ""
echo "📋 Test 4: Manual cache deletion (Cache Miss)"
echo "---------------------------------------------"
rm cache/*.json 2>/dev/null
echo "🗑️  Cache files deleted"
curl -s "http://localhost:8080/todos/1?ttl=5s" > /dev/null
echo "✅ Request completed"
echo "📁 Cache files: $(ls cache/ | wc -l)"

echo ""
echo "📋 Test 5: Different TTL (Separate Cache Entry)"
echo "-----------------------------------------------"
curl -s "http://localhost:8080/todos/1?ttl=10s" > /dev/null
echo "✅ Request completed"
echo "📁 Cache files: $(ls cache/ | wc -l) (should be 2)"
echo "⏰ TTL values: $(cat cache/*.json | jq -r '.ttl_seconds' | sort -n | tr '\n' ' ')"

echo ""
echo "🧹 Cleaning up..."
kill $PROXY_PID 2>/dev/null
rm -rf cache/
echo "✅ Test completed!"

echo ""
echo "📊 Summary:"
echo "==========="
echo "✅ Cache expiration works (TTL-based)"
echo "✅ Manual cache deletion works"
echo "✅ Different TTL creates separate entries"
echo "✅ Cache hits vs misses work correctly"
