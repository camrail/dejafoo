// Cache store implementation using DynamoDB and S3
// Handles get/set operations with TTL and size-based storage

use std::collections::HashMap;
use serde_json::Value;
use aws_sdk_dynamodb::{Client as DynamoClient, types::AttributeValue};
use aws_sdk_s3::{Client as S3Client, primitives::ByteStream};
use chrono::{DateTime, Utc, Duration};

use crate::cache::key::CacheKey;
use crate::utils::{AppError, AppResult};

#[derive(Clone)]
pub struct CacheStore {
    dynamo_client: DynamoClient,
    s3_client: S3Client,
    table_name: String,
    bucket_name: String,
    max_body_size: usize,
}

impl CacheStore {
    /// Create a file-based cache store for local testing
    pub fn file_based() -> Self {
        // Create minimal configs that won't try to connect to AWS
        let dynamo_config = aws_sdk_dynamodb::Config::builder()
            .behavior_version(aws_config::BehaviorVersion::latest())
            .build();
        let s3_config = aws_sdk_s3::Config::builder()
            .behavior_version(aws_config::BehaviorVersion::latest())
            .build();
            
        Self {
            dynamo_client: DynamoClient::from_conf(dynamo_config),
            s3_client: S3Client::from_conf(s3_config),
            table_name: "file-cache".to_string(), // Use this to identify file-based cache
            bucket_name: "mock-bucket".to_string(),
            max_body_size: 10485760, // 10MB
        }
    }

    /// Create a new cache store instance
    pub async fn new() -> AppResult<Self> {
        let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
        let dynamo_client = DynamoClient::new(&config);
        let s3_client = S3Client::new(&config);
        
        let table_name = std::env::var("DYNAMODB_TABLE_NAME")
            .unwrap_or_else(|_| "dejafoo-cache".to_string());
        let bucket_name = std::env::var("S3_BUCKET_NAME")
            .unwrap_or_else(|_| "dejafoo-cache-storage".to_string());
        let max_body_size = std::env::var("MAX_BODY_SIZE")
            .unwrap_or_else(|_| "1048576".to_string()) // 1MB default
            .parse()
            .map_err(|_| AppError::Configuration("Invalid MAX_BODY_SIZE".to_string()))?;
        
        Ok(CacheStore {
            dynamo_client,
            s3_client,
            table_name,
            bucket_name,
            max_body_size,
        })
    }
    
    /// Generate a cache key from request components
    pub fn generate_key(
        &self,
        method: &str,
        path: &str,
        headers: &HashMap<String, String>,
        body: &str,
    ) -> AppResult<CacheKey> {
        CacheKey::new(method, path, headers, body)
    }
    
    /// Generate a cache key from request components with subdomain
    pub fn generate_key_with_subdomain(
        &self,
        method: &str,
        path: &str,
        headers: &HashMap<String, String>,
        body: &str,
        subdomain: Option<&str>,
    ) -> AppResult<CacheKey> {
        CacheKey::new_with_subdomain(method, path, headers, body, subdomain)
    }
    
    /// Generate a cache key from request components with subdomain and TTL
    pub fn generate_key_with_subdomain_and_ttl(
        &self,
        method: &str,
        path: &str,
        headers: &HashMap<String, String>,
        body: &str,
        subdomain: Option<&str>,
        ttl_seconds: Option<u64>,
    ) -> AppResult<CacheKey> {
        CacheKey::new_with_subdomain_and_ttl(method, path, headers, body, subdomain, ttl_seconds)
    }
    
    /// Get a cached response
    pub async fn get(&self, cache_key: &CacheKey) -> AppResult<Option<Value>> {
        // For file-based cache store, read from local files
        if self.table_name == "file-cache" {
            return self.get_from_file(cache_key).await;
        }
        
        let key_hash = cache_key.to_string();
        
        // Check DynamoDB for cache entry
        let response = self.dynamo_client
            .get_item()
            .table_name(&self.table_name)
            .key("key_hash", AttributeValue::S(key_hash.clone()))
            .send()
            .await
            .map_err(|e| AppError::Aws(e.to_string()))?;
        
        if response.item().is_none() {
            return Ok(None);
        }
        
        let item = response.item().unwrap();
        
        // Check TTL
        if let Some(ttl_attr) = item.get("ttl") {
            if let Ok(ttl_value) = ttl_attr.as_n() {
                let ttl_timestamp: i64 = ttl_value.parse()
                    .map_err(|_| AppError::Cache("Invalid TTL format".to_string()))?;
                let ttl_datetime = DateTime::from_timestamp(ttl_timestamp, 0)
                    .ok_or_else(|| AppError::Cache("Invalid TTL timestamp".to_string()))?;
                
                if Utc::now() > ttl_datetime {
                    // Entry expired, remove it
                    self.delete(cache_key).await?;
                    return Ok(None);
                }
            }
        }
        
        // Get response data
        let response_data = if let Some(s3_key_attr) = item.get("s3_key") {
            // Large response stored in S3
            let s3_key = s3_key_attr.as_s()
                .map_err(|_| AppError::Cache("Invalid S3 key format".to_string()))?;
            self.get_from_s3(s3_key).await?
        } else if let Some(response_attr) = item.get("response") {
            // Small response stored directly in DynamoDB
            let response_str = response_attr.as_s()
                .map_err(|_| AppError::Cache("Invalid response format".to_string()))?;
            serde_json::from_str(response_str)
                .map_err(|e| AppError::Cache(format!("Failed to parse response: {}", e)))?
        } else {
            return Err(AppError::Cache("No response data found".to_string()));
        };
        
        Ok(Some(response_data))
    }
    
    /// Set a cached response
    pub async fn set(&self, cache_key: &CacheKey, response: &Value) -> AppResult<()> {
        self.set_with_ttl(cache_key, response, None).await
    }
    
    pub async fn set_with_ttl(&self, cache_key: &CacheKey, response: &Value, ttl_seconds: Option<u64>) -> AppResult<()> {
        // For file-based cache store, write to local files
        if self.table_name == "file-cache" {
            return self.set_to_file_with_ttl(cache_key, response, ttl_seconds).await;
        }
        
        let key_hash = cache_key.to_string();
        let response_str = serde_json::to_string(response)
            .map_err(|e| AppError::Cache(format!("Failed to serialize response: {}", e)))?;
        
        // Calculate TTL (default 1 hour)
        let ttl = Utc::now() + Duration::hours(1);
        let ttl_timestamp = ttl.timestamp();
        
        if response_str.len() > self.max_body_size {
            // Store large response in S3
            let s3_key = format!("responses/{}/{}", key_hash, ttl_timestamp);
            self.put_to_s3(&s3_key, &response_str).await?;
            
            // Store metadata in DynamoDB
            self.dynamo_client
                .put_item()
                .table_name(&self.table_name)
                .item("key_hash", AttributeValue::S(key_hash))
                .item("s3_key", AttributeValue::S(s3_key))
                .item("ttl", AttributeValue::N(ttl_timestamp.to_string()))
                .item("created_at", AttributeValue::S(Utc::now().to_rfc3339()))
                .send()
                .await
                .map_err(|e| AppError::Aws(e.to_string()))?;
        } else {
            // Store small response directly in DynamoDB
            self.dynamo_client
                .put_item()
                .table_name(&self.table_name)
                .item("key_hash", AttributeValue::S(key_hash))
                .item("response", AttributeValue::S(response_str))
                .item("ttl", AttributeValue::N(ttl_timestamp.to_string()))
                .item("created_at", AttributeValue::S(Utc::now().to_rfc3339()))
                .send()
                .await
                .map_err(|e| AppError::Aws(e.to_string()))?;
        }
        
        Ok(())
    }
    
    /// Delete a cached response
    pub async fn delete(&self, cache_key: &CacheKey) -> AppResult<()> {
        let key_hash = cache_key.to_string();
        
        // Get the item first to check for S3 key
        let response = self.dynamo_client
            .get_item()
            .table_name(&self.table_name)
            .key("key_hash", AttributeValue::S(key_hash.clone()))
            .send()
            .await
            .map_err(|e| AppError::Aws(e.to_string()))?;
        
        if let Some(item) = response.item() {
            // Delete from S3 if present
            if let Some(s3_key_attr) = item.get("s3_key") {
                if let Ok(s3_key) = s3_key_attr.as_s() {
                    let _ = self.s3_client
                        .delete_object()
                        .bucket(&self.bucket_name)
                        .key(s3_key)
                        .send()
                        .await;
                }
            }
        }
        
        // Delete from DynamoDB
        self.dynamo_client
            .delete_item()
            .table_name(&self.table_name)
            .key("key_hash", AttributeValue::S(key_hash))
            .send()
            .await
            .map_err(|e| AppError::Aws(e.to_string()))?;
        
        Ok(())
    }
    
    /// Get response data from S3
    async fn get_from_s3(&self, s3_key: &str) -> AppResult<Value> {
        let response = self.s3_client
            .get_object()
            .bucket(&self.bucket_name)
            .key(s3_key)
            .send()
            .await
            .map_err(|e| AppError::Aws(e.to_string()))?;
        
        let data = response.body.collect().await
            .map_err(|e| AppError::Aws(e.to_string()))?;
        let response_str = String::from_utf8(data.to_vec())
            .map_err(|e| AppError::Cache(format!("Invalid UTF-8 in S3 response: {}", e)))?;
        
        let response_data: Value = serde_json::from_str(&response_str)
            .map_err(|e| AppError::Cache(format!("Failed to parse S3 response: {}", e)))?;
        
        Ok(response_data)
    }
    
    /// Put response data to S3
    async fn put_to_s3(&self, s3_key: &str, data: &str) -> AppResult<()> {
        let body = ByteStream::from(data.as_bytes().to_vec());
        
        self.s3_client
            .put_object()
            .bucket(&self.bucket_name)
            .key(s3_key)
            .body(body)
            .content_type("application/json")
            .send()
            .await
            .map_err(|e| AppError::Aws(e.to_string()))?;
        
        Ok(())
    }
    
    /// Clean up expired entries (should be run periodically)
    pub async fn cleanup_expired(&self) -> AppResult<usize> {
        let now = Utc::now().timestamp();
        let mut deleted_count = 0;
        
        // Scan for expired items
        let mut paginator = self.dynamo_client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("ttl < :now")
            .expression_attribute_values(":now", AttributeValue::N(now.to_string()))
            .into_paginator()
            .send();
        
        while let Some(result) = paginator.next().await {
            let response = result
                .map_err(|e| AppError::Aws(e.to_string()))?;
            
            for item in response.items() {
                if let Some(key_hash_attr) = item.get("key_hash") {
                    if let Ok(key_hash) = key_hash_attr.as_s() {
                        let cache_key = CacheKey::from_string(key_hash)?;
                        self.delete(&cache_key).await?;
                        deleted_count += 1;
                    }
                }
            }
        }
        
        Ok(deleted_count)
    }
    
    /// File-based cache methods for local testing
    async fn get_from_file(&self, cache_key: &CacheKey) -> AppResult<Option<Value>> {
        let key_hash = cache_key.to_string();
        let cache_dir = ".dev-cache";
        let file_path = format!("{}/{}.json", cache_dir, key_hash);
        
        // Create cache directory if it doesn't exist
        if !std::path::Path::new(cache_dir).exists() {
            std::fs::create_dir_all(cache_dir)
                .map_err(|e| AppError::Cache(format!("Failed to create cache directory: {}", e)))?;
        }
        
        // Check if cache file exists
        if !std::path::Path::new(&file_path).exists() {
            log::debug!("File cache miss for key: {}", key_hash);
            return Ok(None);
        }
        
        // Read cache file
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| AppError::Cache(format!("Failed to read cache file: {}", e)))?;
        
        // Parse JSON
        let cache_data: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| AppError::Cache(format!("Failed to parse cache file: {}", e)))?;
        
        // Check TTL
        if let Some(ttl) = cache_data.get("ttl") {
            if let Some(ttl_timestamp) = ttl.as_i64() {
                let now = Utc::now().timestamp();
                if now > ttl_timestamp {
                    log::debug!("File cache expired for key: {}", key_hash);
                    // Delete expired file
                    let _ = std::fs::remove_file(&file_path);
                    return Ok(None);
                }
            }
        }
        
        log::info!("File cache hit for key: {}", key_hash);
        Ok(cache_data.get("response").cloned())
    }
    

    
    async fn set_to_file_with_ttl(&self, cache_key: &CacheKey, response: &Value, custom_ttl_seconds: Option<u64>) -> AppResult<()> {
        let key_hash = cache_key.to_string();
        let cache_dir = ".dev-cache";
        let file_path = format!("{}/{}.json", cache_dir, key_hash);
        
        // Create cache directory if it doesn't exist
        if !std::path::Path::new(cache_dir).exists() {
            std::fs::create_dir_all(cache_dir)
                .map_err(|e| AppError::Cache(format!("Failed to create cache directory: {}", e)))?;
        }
        
        // Calculate TTL (use custom TTL or default 1 hour)
        let ttl_seconds = custom_ttl_seconds.unwrap_or(3600); // 1 hour default
        let ttl = Utc::now() + Duration::seconds(ttl_seconds as i64);
        let ttl_timestamp = ttl.timestamp();
        
        // Create cache data
        let cache_data = serde_json::json!({
            "key": key_hash,
            "response": response,
            "ttl": ttl_timestamp,
            "ttl_seconds": ttl_seconds,
            "created_at": Utc::now().to_rfc3339()
        });
        
        // Write to file
        let content = serde_json::to_string_pretty(&cache_data)
            .map_err(|e| AppError::Cache(format!("Failed to serialize cache data: {}", e)))?;
        
        std::fs::write(&file_path, content)
            .map_err(|e| AppError::Cache(format!("Failed to write cache file: {}", e)))?;
        
        log::info!("File cache stored for key: {} with TTL: {}s", key_hash, ttl_seconds);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use serde_json::json;
    
    #[tokio::test]
    async fn test_cache_store_creation() {
        // This test would require AWS credentials or mocking
        // For now, it's a placeholder
    }
    
    #[test]
    fn test_cache_key_generation() {
        let headers = HashMap::new();
        let key = CacheKey::new("GET", "/api/test", &headers, "{}").unwrap();
        assert_eq!(key.method, "GET");
        assert_eq!(key.path, "/api/test");
        
        // Test that the key string is generated
        let key_string = key.to_string();
        assert!(!key_string.is_empty());
        assert!(key_string.len() > 10); // Should be a reasonable hash length
    }
}
