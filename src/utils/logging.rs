// Logging utilities
// Sets up structured logging for the application

use log::{Level, LevelFilter};
use std::sync::Once;

static INIT: Once = Once::new();

// Simple logging setup without custom logger

/// Setup logging for the application
pub fn setup_logging() -> Result<(), Box<dyn std::error::Error>> {
    INIT.call_once(|| {
        let log_level = get_log_level();
        
        // Simple logging setup without external dependencies
        log::set_max_level(log_level);
    });
    
    Ok(())
}

/// Get log level from environment or default to Info
fn get_log_level() -> LevelFilter {
    let level_str = std::env::var("LOG_LEVEL")
        .unwrap_or_else(|_| "INFO".to_string())
        .to_uppercase();
    
    match level_str.as_str() {
        "TRACE" => LevelFilter::Trace,
        "DEBUG" => LevelFilter::Debug,
        "INFO" => LevelFilter::Info,
        "WARN" => LevelFilter::Warn,
        "ERROR" => LevelFilter::Error,
        _ => LevelFilter::Info,
    }
}

/// Log a structured message with context
pub fn log_with_context(
    level: Level,
    message: &str,
    context: &serde_json::Value,
) {
    let timestamp = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S%.3f UTC");
    let context_str = serde_json::to_string(context).unwrap_or_else(|_| "{}".to_string());
    
    let log_message = format!(
        "[{}] {} {}: {} | Context: {}",
        timestamp,
        level,
        module_path!(),
        message,
        context_str
    );
    
    match level {
        Level::Error => log::error!("{}", log_message),
        Level::Warn => log::warn!("{}", log_message),
        Level::Info => log::info!("{}", log_message),
        Level::Debug => log::debug!("{}", log_message),
        Level::Trace => log::trace!("{}", log_message),
    }
}

/// Log an error with context
pub fn log_error(error: &dyn std::error::Error, context: &serde_json::Value) {
    let error_context = serde_json::json!({
        "error": error.to_string(),
        "error_type": std::any::type_name::<dyn std::error::Error>(),
        "context": context
    });
    
    log_with_context(Level::Error, "Error occurred", &error_context);
}

/// Log a cache operation
pub fn log_cache_operation(
    operation: &str,
    key: &str,
    success: bool,
    duration_ms: u64,
) {
    let context = serde_json::json!({
        "operation": operation,
        "cache_key": key,
        "success": success,
        "duration_ms": duration_ms
    });
    
    let level = if success { Level::Info } else { Level::Warn };
    log_with_context(level, "Cache operation", &context);
}

/// Log a proxy operation
pub fn log_proxy_operation(
    method: &str,
    path: &str,
    upstream_url: &str,
    status_code: u16,
    duration_ms: u64,
) {
    let context = serde_json::json!({
        "method": method,
        "path": path,
        "upstream_url": upstream_url,
        "status_code": status_code,
        "duration_ms": duration_ms
    });
    
    let level = if status_code < 400 { Level::Info } else { Level::Warn };
    log_with_context(level, "Proxy operation", &context);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_get_log_level() {
        // Test default level
        std::env::remove_var("LOG_LEVEL");
        assert_eq!(get_log_level(), LevelFilter::Info);
        
        // Test custom levels
        std::env::set_var("LOG_LEVEL", "DEBUG");
        assert_eq!(get_log_level(), LevelFilter::Debug);
        
        std::env::set_var("LOG_LEVEL", "ERROR");
        assert_eq!(get_log_level(), LevelFilter::Error);
        
        // Test invalid level (should default to Info)
        std::env::set_var("LOG_LEVEL", "INVALID");
        assert_eq!(get_log_level(), LevelFilter::Info);
        
        std::env::remove_var("LOG_LEVEL");
    }
    
    #[test]
    fn test_log_with_context() {
        let context = json!({
            "user_id": "123",
            "action": "cache_get"
        });
        
        // This test just ensures the function doesn't panic
        log_with_context(Level::Info, "Test message", &context);
    }
    
    #[test]
    fn test_log_cache_operation() {
        // This test just ensures the function doesn't panic
        log_cache_operation("GET", "test-key", true, 100);
        log_cache_operation("SET", "test-key", false, 200);
    }
    
    #[test]
    fn test_log_proxy_operation() {
        // This test just ensures the function doesn't panic
        log_proxy_operation("GET", "/api/users", "https://api.example.com/users", 200, 150);
        log_proxy_operation("POST", "/api/users", "https://api.example.com/users", 500, 300);
    }
}
