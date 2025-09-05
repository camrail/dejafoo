// Lambda entrypoint for dejafoo proxy service
// This is the main handler that processes incoming requests

use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::Value;
use std::collections::HashMap;

use dejafoo::cache::{CacheStore, CachePolicy};
use dejafoo::proxy::{fetch_upstream, normalize_request, normalize_response};
use dejafoo::utils::{setup_logging, AppError, AppResult};

#[tokio::main]
async fn main() -> Result<(), Error> {
    log::info!("🚀 Starting Lambda function initialization...");
    
    setup_logging().map_err(|e| AppError::Generic(e.to_string()))?;
    log::info!("✅ Logging setup complete");
    
    log::info!("📦 Initializing cache store...");
    let cache_store = CacheStore::new().await?;
    log::info!("✅ Cache store initialized");
    
    log::info!("📋 Loading cache policy...");
    let cache_policy = CachePolicy::load_from_config().await?;
    log::info!("✅ Cache policy loaded");
    
    log::info!("🔧 Setting up Lambda handler...");
    let func = service_fn(|event: LambdaEvent<Value>| {
        handler(event, &cache_store, &cache_policy)
    });
    
    log::info!("✅ Lambda function ready to process requests");
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(
    event: LambdaEvent<Value>,
    cache_store: &CacheStore,
    cache_policy: &CachePolicy,
) -> AppResult<Value> {
    log::info!("📨 Processing new request");
    
    let request = event.payload;
    log::debug!("Request payload: {:?}", request);
    
    // Extract request details
    let method = request["httpMethod"].as_str().unwrap_or("GET");
    let path = request["path"].as_str().unwrap_or("/");
    let headers = extract_headers(&request);
    let body = request["body"].as_str().unwrap_or("");
    
    log::info!("🔍 Request: {} {}", method, path);
    
    // Generate cache key
    log::info!("🔑 Generating cache key...");
    let cache_key = cache_store.generate_key(method, path, &headers, body)?;
    log::info!("Cache key: {:?}", cache_key);
    
    // Check cache first
    log::info!("🔍 Checking cache...");
    if let Some(cached_response) = cache_store.get(&cache_key).await? {
        log::info!("✅ Cache hit for key: {:?}", cache_key);
        return Ok(cached_response);
    }
    
    // Cache miss - fetch from upstream
    log::info!("❌ Cache miss for key: {:?}", cache_key);
    
    log::info!("🌐 Fetching from upstream...");
    let normalized_request = normalize_request(&request)?;
    let upstream_response = fetch_upstream(&normalized_request).await?;
    let normalized_response = normalize_response(upstream_response)?;
    log::info!("✅ Upstream response received");
    
    // Store in cache if policy allows
    log::info!("💾 Checking if response should be cached...");
    if cache_policy.should_cache(&normalized_response) {
        log::info!("💾 Storing response in cache...");
        cache_store.set(&cache_key, &normalized_response).await?;
        log::info!("✅ Response cached with key: {:?}", cache_key);
    } else {
        log::info!("⏭️ Response not cached due to policy");
    }
    
    log::info!("✅ Request processing complete");
    Ok(normalized_response)
}

fn extract_headers(request: &Value) -> HashMap<String, String> {
    let mut headers = HashMap::new();
    
    if let Some(headers_obj) = request["headers"].as_object() {
        for (key, value) in headers_obj {
            if let Some(value_str) = value.as_str() {
                headers.insert(key.clone(), value_str.to_string());
            }
        }
    }
    
    headers
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[tokio::test]
    async fn test_handler_basic() {
        let request = json!({
            "httpMethod": "GET",
            "path": "/api/test",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": ""
        });
        
        // Test would require mocking cache store and policy
        // This is a placeholder for the actual test implementation
    }
}
