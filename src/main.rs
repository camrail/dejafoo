// Main entry point for the dejafoo proxy server
// Runs as a standalone HTTP server for local development

use std::env;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde_json::Value;
use std::collections::HashMap;

use dejafoo::cache::{CacheStore, CachePolicy};
use dejafoo::proxy::{fetch_upstream, normalize_request, normalize_response};
use dejafoo::utils::{setup_logging, AppError, AppResult, log_proxy_operation};

#[tokio::main]
async fn main() -> AppResult<()> {
    setup_logging().map_err(|e| AppError::Generic(e.to_string()))?;
    
    // Parse command line arguments
    let args: Vec<String> = env::args().collect();
    let port = parse_port(&args).unwrap_or(8080);
    
    // Initialize cache store and policy
    // For local testing, use a file-based cache store to avoid AWS dependencies
    let cache_store = if std::env::var("USE_FILE_CACHE").is_ok() {
        log::info!("Using file-based cache store for local testing");
        CacheStore::file_based()
    } else {
        log::info!("Using real AWS cache store");
        CacheStore::new().await?
    };
    log::info!("Loading cache policy...");
    let cache_policy = CachePolicy::load_from_config().await?;
    log::info!("Cache policy loaded successfully");
    
    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(addr).await?;
    
    log::info!("Dejafoo proxy server listening on {}", addr);
    log::info!("Upstream URL: {}", env::var("UPSTREAM_BASE_URL").unwrap_or_else(|_| "Not set".to_string()));
    
    loop {
        let (stream, client_addr) = listener.accept().await?;
        let cache_store = cache_store.clone();
        let cache_policy = cache_policy.clone();
        
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, client_addr, cache_store, cache_policy).await {
                log::error!("Error handling connection: {}", e);
            }
        });
    }
}

async fn handle_connection(
    mut stream: tokio::net::TcpStream,
    _client_addr: std::net::SocketAddr,
    cache_store: CacheStore,
    cache_policy: CachePolicy,
) -> AppResult<()> {
    let mut buffer = [0; 4096];
    let n = stream.read(&mut buffer).await?;
    
    if n == 0 {
        return Ok(());
    }
    
    let request_str = String::from_utf8_lossy(&buffer[..n]);
    let request = parse_http_request(&request_str)?;
    
    let start_time = std::time::Instant::now();
    let response = process_request(request, &cache_store, &cache_policy).await?;
    let duration = start_time.elapsed();
    
    // Log the request
    log_proxy_operation(
        &response.method,
        &response.path,
        &response.upstream_url,
        response.status_code,
        duration.as_millis() as u64,
    );
    
    // Send response
    let response_str = format_response(&response);
    stream.write_all(response_str.as_bytes()).await?;
    stream.flush().await?;
    
    Ok(())
}

fn parse_port(args: &[String]) -> Option<u16> {
    for (i, arg) in args.iter().enumerate() {
        if arg == "--port" && i + 1 < args.len() {
            return args[i + 1].parse().ok();
        }
    }
    None
}

/// Extract subdomain from Host header
fn extract_subdomain(headers: &HashMap<String, String>) -> Option<String> {
    if let Some(host) = headers.get("host") {
        // Handle localhost:port format
        if host.starts_with("localhost") {
            return None; // No subdomain for localhost
        }
        
        // Split by dots and check if we have a subdomain
        let parts: Vec<&str> = host.split('.').collect();
        if parts.len() >= 3 {
            // abc.dejafoo.io -> abc
            return Some(parts[0].to_lowercase());
        }
    }
    None
}

/// Extract TTL parameter from query string
fn extract_ttl_from_path(path: &str) -> Option<u64> {
    if let Some(query_start) = path.find('?') {
        let query_string = &path[query_start + 1..];
        for param in query_string.split('&') {
            if let Some((key, value)) = param.split_once('=') {
                if key == "ttl" {
                    // Parse TTL string (7d, 30m, 60s, etc.)
                    return parse_ttl_string(value).ok();
                }
            }
        }
    }
    None
}

/// Parse human-readable TTL string to seconds
fn parse_ttl_string(ttl_str: &str) -> Result<u64, String> {
    if ttl_str.is_empty() {
        return Err("TTL cannot be empty".to_string());
    }
    
    let ttl_str = ttl_str.trim().to_lowercase();
    let (number_part, unit_part) = if ttl_str.ends_with('d') {
        (&ttl_str[..ttl_str.len()-1], "d")
    } else if ttl_str.ends_with('h') {
        (&ttl_str[..ttl_str.len()-1], "h")
    } else if ttl_str.ends_with('m') {
        (&ttl_str[..ttl_str.len()-1], "m")
    } else if ttl_str.ends_with('s') {
        (&ttl_str[..ttl_str.len()-1], "s")
    } else {
        // Default to seconds if no unit specified
        (ttl_str.as_str(), "s")
    };
    
    let number: u64 = number_part.parse()
        .map_err(|_| format!("Invalid TTL number: {}", number_part))?;
    
    let seconds = match unit_part {
        "s" => number,
        "m" => number * 60,
        "h" => number * 60 * 60,
        "d" => number * 60 * 60 * 24,
        _ => return Err(format!("Invalid TTL unit: {}", unit_part)),
    };
    
    // Validate reasonable limits (1 second to 1 year)
    if seconds < 1 {
        return Err("TTL must be at least 1 second".to_string());
    }
    if seconds > 365 * 24 * 60 * 60 {
        return Err("TTL cannot exceed 1 year".to_string());
    }
    
    Ok(seconds)
}

fn parse_http_request(request_str: &str) -> AppResult<HttpRequest> {
    let lines: Vec<&str> = request_str.lines().collect();
    if lines.is_empty() {
        return Err(AppError::Http("Empty request".to_string()));
    }
    
    let first_line = lines[0];
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 3 {
        return Err(AppError::Http("Invalid request line".to_string()));
    }
    
    let method = parts[0].to_string();
    let path = parts[1].to_string();
    
    // Parse headers
    let mut headers = HashMap::new();
    let mut body_start = 0;
    
    for (i, line) in lines.iter().enumerate() {
        if line.is_empty() {
            body_start = i + 1;
            break;
        }
        if i > 0 && line.contains(':') {
            let header_parts: Vec<&str> = line.splitn(2, ':').collect();
            if header_parts.len() == 2 {
                headers.insert(
                    header_parts[0].trim().to_string(),
                    header_parts[1].trim().to_string(),
                );
            }
        }
    }
    
    // Parse body
    let body = if body_start < lines.len() {
        lines[body_start..].join("\n")
    } else {
        String::new()
    };
    
    Ok(HttpRequest {
        method,
        path,
        headers,
        body,
    })
}

async fn process_request(
    request: HttpRequest,
    cache_store: &CacheStore,
    cache_policy: &CachePolicy,
) -> AppResult<HttpResponse> {
    // Convert to JSON format for processing
    let mut request_json = serde_json::Map::new();
    request_json.insert("httpMethod".to_string(), Value::String(request.method.clone()));
    request_json.insert("path".to_string(), Value::String(request.path.clone()));
    
    let headers_json: serde_json::Map<String, Value> = request.headers
        .iter()
        .map(|(k, v)| (k.clone(), Value::String(v.clone())))
        .collect();
    request_json.insert("headers".to_string(), Value::Object(headers_json));
    request_json.insert("body".to_string(), Value::String(request.body.clone()));
    
    let request_value = Value::Object(request_json);
    
    // Normalize request
    let normalized_request = normalize_request(&request_value)?;
    
    // Extract subdomain from Host header
    let subdomain = extract_subdomain(&request.headers);
    if let Some(ref subdomain) = subdomain {
        log::info!("Detected subdomain: {}", subdomain);
    }
    
    // Extract TTL from query parameters
    let ttl_seconds = extract_ttl_from_path(&request.path);
    if let Some(ttl) = ttl_seconds {
        log::info!("Custom TTL requested: {} seconds", ttl);
    }
    
    // Generate cache key with subdomain and TTL
    let cache_key = cache_store.generate_key_with_subdomain_and_ttl(
        &request.method,
        &request.path,
        &request.headers,
        &request.body,
        subdomain.as_deref(),
        ttl_seconds,
    )?;
    
    // Check cache first
    if let Some(cached_response) = cache_store.get(&cache_key).await? {
        log::info!("Cache hit for key: {}", cache_key.to_string());
        
        // Extract the response body from the cached response
        log::debug!("Cached response structure: {}", cached_response);
        let response_body = if let Some(body) = cached_response.get("body") {
            log::debug!("Found body: {}", body);
            serde_json::to_string(body).unwrap_or_else(|_| "{}".to_string())
        } else {
            log::debug!("No body found in cached response");
            "{}".to_string()
        };
        
        return Ok(HttpResponse {
            status_code: 200,
            headers: HashMap::new(),
            body: response_body,
            method: request.method,
            path: request.path,
            upstream_url: "cache".to_string(),
        });
    }
    
    // Cache miss - fetch from upstream
    log::info!("Cache miss for key: {}", cache_key.to_string());
    
    let upstream_response = fetch_upstream(&normalized_request).await?;
    let normalized_response = normalize_response(upstream_response)?;
    
    // Store in cache if policy allows
    if cache_policy.should_cache(&normalized_response) {
        cache_store.set_with_ttl(&cache_key, &normalized_response, ttl_seconds).await?;
        log::info!("Response cached with key: {} and TTL: {:?}", cache_key.to_string(), ttl_seconds);
    }
    
    // Extract response details
    let status_code = normalized_response["statusCode"].as_u64().unwrap_or(200) as u16;
    let body = normalized_response["body"].as_str().unwrap_or("").to_string();
    
    let mut response_headers = HashMap::new();
    if let Some(headers_obj) = normalized_response["headers"].as_object() {
        for (key, value) in headers_obj {
            if let Some(value_str) = value.as_str() {
                response_headers.insert(key.clone(), value_str.to_string());
            }
        }
    }
    
    Ok(HttpResponse {
        status_code,
        headers: response_headers,
        body,
        method: request.method,
        path: request.path,
        upstream_url: env::var("UPSTREAM_BASE_URL").unwrap_or_else(|_| "unknown".to_string()),
    })
}

fn format_response(response: &HttpResponse) -> String {
    let status_text = match response.status_code {
        200 => "OK",
        201 => "Created",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    };
    
    let mut response_str = format!("HTTP/1.1 {} {}\r\n", response.status_code, status_text);
    
    // Add headers
    for (key, value) in &response.headers {
        response_str.push_str(&format!("{}: {}\r\n", key, value));
    }
    
    // Add content length
    response_str.push_str(&format!("Content-Length: {}\r\n", response.body.len()));
    response_str.push_str("Connection: close\r\n");
    response_str.push_str("\r\n");
    response_str.push_str(&response.body);
    
    response_str
}

#[derive(Debug)]
struct HttpRequest {
    method: String,
    path: String,
    headers: HashMap<String, String>,
    body: String,
}

#[derive(Debug)]
struct HttpResponse {
    status_code: u16,
    headers: HashMap<String, String>,
    body: String,
    method: String,
    path: String,
    upstream_url: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_port() {
        let args = vec!["program".to_string(), "--port".to_string(), "3000".to_string()];
        assert_eq!(parse_port(&args), Some(3000));
        
        let args = vec!["program".to_string()];
        assert_eq!(parse_port(&args), None);
    }
    
    #[test]
    fn test_parse_http_request() {
        let request = "GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n";
        let parsed = parse_http_request(request).unwrap();
        
        assert_eq!(parsed.method, "GET");
        assert_eq!(parsed.path, "/test");
        assert_eq!(parsed.headers.get("Host"), Some(&"localhost".to_string()));
    }
}
