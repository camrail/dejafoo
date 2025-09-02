// Request and response normalization
// Handles header stripping and JSON body normalization

use serde_json::{Value, Map};
use regex::Regex;

use crate::utils::AppResult;

/// Normalize incoming request for caching
pub fn normalize_request(request: &Value) -> AppResult<Value> {
    let mut normalized = request.clone();
    
    // Normalize headers
    if let Some(headers_obj) = normalized.get_mut("headers").and_then(|h| h.as_object_mut()) {
        let mut normalized_headers = Map::new();
        
        for (key, value) in headers_obj {
            let normalized_key = normalize_header_name(key);
            let normalized_value = normalize_header_value(value)?;
            normalized_headers.insert(normalized_key, normalized_value);
        }
        
        normalized["headers"] = Value::Object(normalized_headers);
    }
    
    // Normalize body
    if let Some(body) = normalized.get_mut("body") {
        if let Some(body_str) = body.as_str() {
            *body = normalize_body(body_str)?;
        }
    }
    
    // Normalize path
    if let Some(path) = normalized.get_mut("path") {
        if let Some(path_str) = path.as_str() {
            *path = Value::String(normalize_path(path_str));
        }
    }
    
    Ok(normalized)
}

/// Normalize outgoing response for caching
pub fn normalize_response(response: Value) -> AppResult<Value> {
    let mut normalized = response;
    
    // Normalize headers
    if let Some(headers_obj) = normalized.get_mut("headers").and_then(|h| h.as_object_mut()) {
        let mut normalized_headers = Map::new();
        
        for (key, value) in headers_obj {
            let normalized_key = normalize_header_name(key);
            let normalized_value = normalize_header_value(value)?;
            normalized_headers.insert(normalized_key, normalized_value);
        }
        
        normalized["headers"] = Value::Object(normalized_headers);
    }
    
    // Normalize body
    if let Some(body) = normalized.get_mut("body") {
        if let Some(body_str) = body.as_str() {
            *body = normalize_body(body_str)?;
        }
    }
    
    Ok(normalized)
}

/// Normalize header name (lowercase, trim)
fn normalize_header_name(name: &str) -> String {
    name.trim().to_lowercase()
}

/// Normalize header value (trim, handle special cases)
fn normalize_header_value(value: &Value) -> AppResult<Value> {
    match value {
        Value::String(s) => {
            let normalized = s.trim().to_string();
            Ok(Value::String(normalized))
        }
        Value::Array(arr) => {
            let normalized: Result<Vec<_>, _> = arr.iter()
                .map(|v| normalize_header_value(v))
                .collect();
            Ok(Value::Array(normalized?))
        }
        _ => Ok(value.clone()),
    }
}

/// Normalize request/response body
fn normalize_body(body: &str) -> AppResult<Value> {
    if body.is_empty() {
        return Ok(Value::String(String::new()));
    }
    
    // Try to parse as JSON and normalize
    if let Ok(mut json_value) = serde_json::from_str::<Value>(body) {
        json_value = normalize_json_value(json_value)?;
        Ok(json_value)
    } else {
        // Not JSON, return as string
        Ok(Value::String(body.to_string()))
    }
}

/// Normalize JSON value (sort keys, remove nulls, etc.)
fn normalize_json_value(value: Value) -> AppResult<Value> {
    match value {
        Value::Object(mut map) => {
            // Remove null values
            map.retain(|_, v| !v.is_null());
            
            // Sort keys for consistent ordering
            let mut sorted_pairs: Vec<_> = map.into_iter().collect();
            sorted_pairs.sort_by_key(|(k, _)| k.clone());
            
            // Recursively normalize values
            let mut normalized_map = Map::new();
            for (key, val) in sorted_pairs {
                let normalized_val = normalize_json_value(val)?;
                normalized_map.insert(key, normalized_val);
            }
            
            Ok(Value::Object(normalized_map))
        }
        Value::Array(arr) => {
            let normalized: Result<Vec<_>, _> = arr.into_iter()
                .map(normalize_json_value)
                .collect();
            Ok(Value::Array(normalized?))
        }
        Value::String(s) => {
            // Normalize string values (trim, handle special cases)
            let normalized = normalize_string_value(&s);
            Ok(Value::String(normalized))
        }
        _ => Ok(value),
    }
}

/// Normalize string values
fn normalize_string_value(s: &str) -> String {
    let mut normalized = s.trim().to_string();
    
    // Remove extra whitespace
    let re = Regex::new(r"\s+").unwrap();
    normalized = re.replace_all(&normalized, " ").to_string();
    
    // Handle common string normalizations
    normalized = normalized.replace("\r\n", "\n");
    normalized = normalized.replace("\r", "\n");
    
    normalized
}

/// Normalize URL path
fn normalize_path(path: &str) -> String {
    let mut normalized = path.trim().to_string();
    
    // Remove query parameters for normalization
    if let Some(query_pos) = normalized.find('?') {
        normalized = normalized[..query_pos].to_string();
    }
    
    // Remove fragment
    if let Some(fragment_pos) = normalized.find('#') {
        normalized = normalized[..fragment_pos].to_string();
    }
    
    // Remove trailing slash except for root
    if normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    
    // Ensure leading slash
    if !normalized.starts_with('/') {
        normalized = format!("/{}", normalized);
    }
    
    normalized
}

/// Strip sensitive headers from request/response
pub fn strip_sensitive_headers(headers: &mut Map<String, Value>) {
    let sensitive_headers = [
        "authorization",
        "cookie",
        "x-api-key",
        "x-auth-token",
        "x-access-token",
        "x-csrf-token",
        "x-session-id",
        "x-user-id",
        "x-request-id",
        "x-correlation-id",
    ];
    
    for header in &sensitive_headers {
        headers.remove(*header);
    }
}

/// Add cache headers to response
pub fn add_cache_headers(headers: &mut Map<String, Value>, ttl_seconds: u64) {
    headers.insert("cache-control".to_string(), 
        Value::String(format!("public, max-age={}", ttl_seconds)));
    headers.insert("x-cache".to_string(), Value::String("HIT".to_string()));
    headers.insert("x-cache-ttl".to_string(), 
        Value::String(ttl_seconds.to_string()));
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_normalize_header_name() {
        assert_eq!(normalize_header_name("Content-Type"), "content-type");
        assert_eq!(normalize_header_name("  Authorization  "), "authorization");
    }
    
    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("/api/users"), "/api/users");
        assert_eq!(normalize_path("/api/users/"), "/api/users");
        assert_eq!(normalize_path("/api/users?page=1"), "/api/users");
        assert_eq!(normalize_path("/api/users#section"), "/api/users");
        assert_eq!(normalize_path("api/users"), "/api/users");
        assert_eq!(normalize_path("/"), "/");
    }
    
    #[test]
    fn test_normalize_json_value() {
        let input = json!({
            "c": 3,
            "a": 1,
            "b": null,
            "d": {
                "z": 2,
                "y": 1
            }
        });
        
        let normalized = normalize_json_value(input).unwrap();
        
        // Keys should be sorted
        if let Value::Object(map) = &normalized {
            let keys: Vec<_> = map.keys().collect();
            assert_eq!(keys, vec!["a", "c", "d"]);
        }
        
        // Null values should be removed
        assert!(normalized["b"].is_null());
    }
    
    #[test]
    fn test_normalize_request() {
        let request = json!({
            "httpMethod": "GET",
            "path": "/api/users/",
            "headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer token123"
            },
            "body": "{\"id\": 1, \"name\": \"test\"}"
        });
        
        let normalized = normalize_request(&request).unwrap();
        
        // Path should be normalized
        assert_eq!(normalized["path"], "/api/users");
        
        // Headers should be lowercase
        assert!(normalized["headers"]["content-type"].is_string());
        assert!(normalized["headers"]["authorization"].is_string());
        
        // Body should be normalized JSON
        assert!(normalized["body"]["id"].is_number());
        assert_eq!(normalized["body"]["name"], "test");
    }
    
    #[test]
    fn test_strip_sensitive_headers() {
        let mut headers = serde_json::Map::new();
        headers.insert("content-type".to_string(), json!("application/json"));
        headers.insert("authorization".to_string(), json!("Bearer token123"));
        headers.insert("x-api-key".to_string(), json!("secret-key"));
        
        strip_sensitive_headers(&mut headers);
        
        // Sensitive headers should be removed
        assert!(!headers.contains_key("authorization"));
        assert!(!headers.contains_key("x-api-key"));
        
        // Other headers should remain
        assert!(headers.contains_key("content-type"));
    }
    
    #[test]
    fn test_add_cache_headers() {
        let mut headers = serde_json::Map::new();
        add_cache_headers(&mut headers, 3600);
        
        assert_eq!(headers["cache-control"], "public, max-age=3600");
        assert_eq!(headers["x-cache"], "HIT");
        assert_eq!(headers["x-cache-ttl"], "3600");
    }
}
