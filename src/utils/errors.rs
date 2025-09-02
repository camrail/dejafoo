// Error handling utilities
// Defines custom error types and result aliases

use std::fmt;
use serde::{Deserialize, Serialize};

/// Custom error type for the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppError {
    /// Configuration-related errors
    Configuration(String),
    
    /// Cache-related errors
    Cache(String),
    
    /// Proxy-related errors
    Proxy(String),
    
    /// AWS service errors
    Aws(String),
    
    /// JSON serialization/deserialization errors
    Json(String),
    
    /// HTTP request/response errors
    Http(String),
    
    /// Validation errors
    Validation(String),
    
    /// Generic errors
    Generic(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Configuration(msg) => write!(f, "Configuration error: {}", msg),
            AppError::Cache(msg) => write!(f, "Cache error: {}", msg),
            AppError::Proxy(msg) => write!(f, "Proxy error: {}", msg),
            AppError::Aws(msg) => write!(f, "AWS error: {}", msg),
            AppError::Json(msg) => write!(f, "JSON error: {}", msg),
            AppError::Http(msg) => write!(f, "HTTP error: {}", msg),
            AppError::Validation(msg) => write!(f, "Validation error: {}", msg),
            AppError::Generic(msg) => write!(f, "Error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

/// Result type alias for the application
pub type AppResult<T> = Result<T, AppError>;

/// Convert from serde_json::Error
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Json(err.to_string())
    }
}

/// Convert from reqwest::Error
impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Http(err.to_string())
    }
}

/// Convert from aws_sdk_dynamodb::Error
impl From<aws_sdk_dynamodb::Error> for AppError {
    fn from(err: aws_sdk_dynamodb::Error) -> Self {
        AppError::Aws(err.to_string())
    }
}

/// Convert from aws_sdk_s3::Error
impl From<aws_sdk_s3::Error> for AppError {
    fn from(err: aws_sdk_s3::Error) -> Self {
        AppError::Aws(err.to_string())
    }
}

// Generic error conversion removed to avoid conflicts

/// Convert from std::io::Error
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Generic(err.to_string())
    }
}

/// Convert from url::ParseError
impl From<url::ParseError> for AppError {
    fn from(err: url::ParseError) -> Self {
        AppError::Validation(err.to_string())
    }
}

/// Convert from chrono::ParseError
impl From<chrono::ParseError> for AppError {
    fn from(err: chrono::ParseError) -> Self {
        AppError::Validation(err.to_string())
    }
}

/// Convert from lambda_runtime::Error
impl From<lambda_runtime::Error> for AppError {
    fn from(err: lambda_runtime::Error) -> Self {
        AppError::Generic(err.to_string())
    }
}

/// Helper function to create configuration errors
pub fn config_error(msg: &str) -> AppError {
    AppError::Configuration(msg.to_string())
}

/// Helper function to create cache errors
pub fn cache_error(msg: &str) -> AppError {
    AppError::Cache(msg.to_string())
}

/// Helper function to create proxy errors
pub fn proxy_error(msg: &str) -> AppError {
    AppError::Proxy(msg.to_string())
}

/// Helper function to create AWS errors
pub fn aws_error(msg: &str) -> AppError {
    AppError::Aws(msg.to_string())
}

/// Helper function to create JSON errors
pub fn json_error(msg: &str) -> AppError {
    AppError::Json(msg.to_string())
}

/// Helper function to create HTTP errors
pub fn http_error(msg: &str) -> AppError {
    AppError::Http(msg.to_string())
}

/// Helper function to create validation errors
pub fn validation_error(msg: &str) -> AppError {
    AppError::Validation(msg.to_string())
}

/// Helper function to create generic errors
pub fn generic_error(msg: &str) -> AppError {
    AppError::Generic(msg.to_string())
}

/// Error context for better error handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorContext {
    pub operation: String,
    pub details: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl ErrorContext {
    /// Create a new error context
    pub fn new(operation: &str, details: serde_json::Value) -> Self {
        Self {
            operation: operation.to_string(),
            details,
            timestamp: chrono::Utc::now(),
        }
    }
    
    /// Create error context with operation only
    pub fn with_operation(operation: &str) -> Self {
        Self::new(operation, serde_json::Value::Null)
    }
    
    /// Add details to the context
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = details;
        self
    }
}

/// Enhanced error with context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualError {
    pub error: AppError,
    pub context: ErrorContext,
}

impl ContextualError {
    /// Create a new contextual error
    pub fn new(error: AppError, context: ErrorContext) -> Self {
        Self { error, context }
    }
    
    /// Create a contextual error with operation
    pub fn with_operation(error: AppError, operation: &str) -> Self {
        Self::new(error, ErrorContext::with_operation(operation))
    }
    
    /// Add details to the context
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.context = self.context.with_details(details);
        self
    }
}

impl fmt::Display for ContextualError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} (Operation: {}, Context: {})", 
               self.error, self.context.operation, self.context.details)
    }
}

impl std::error::Error for ContextualError {}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_app_error_display() {
        let error = AppError::Configuration("Invalid config".to_string());
        assert_eq!(error.to_string(), "Configuration error: Invalid config");
        
        let error = AppError::Cache("Cache miss".to_string());
        assert_eq!(error.to_string(), "Cache error: Cache miss");
    }
    
    #[test]
    fn test_error_conversions() {
        // Test serde_json::Error conversion
        let json_err = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
        let app_err: AppError = json_err.into();
        assert!(matches!(app_err, AppError::Json(_)));
        
        // Test std::io::Error conversion
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "File not found");
        let app_err: AppError = io_err.into();
        assert!(matches!(app_err, AppError::Generic(_)));
    }
    
    #[test]
    fn test_error_context() {
        let context = ErrorContext::new("test_operation", json!({"key": "value"}));
        assert_eq!(context.operation, "test_operation");
        assert_eq!(context.details["key"], "value");
        
        let context = ErrorContext::with_operation("simple_operation");
        assert_eq!(context.operation, "simple_operation");
        assert_eq!(context.details, serde_json::Value::Null);
    }
    
    #[test]
    fn test_contextual_error() {
        let error = AppError::Cache("Test error".to_string());
        let context = ErrorContext::with_operation("test_op");
        let contextual_error = ContextualError::new(error, context);
        
        assert!(matches!(contextual_error.error, AppError::Cache(_)));
        assert_eq!(contextual_error.context.operation, "test_op");
    }
    
    #[test]
    fn test_helper_functions() {
        let config_err = config_error("Test config error");
        assert!(matches!(config_err, AppError::Configuration(_)));
        
        let cache_err = cache_error("Test cache error");
        assert!(matches!(cache_err, AppError::Cache(_)));
        
        let proxy_err = proxy_error("Test proxy error");
        assert!(matches!(proxy_err, AppError::Proxy(_)));
    }
}
