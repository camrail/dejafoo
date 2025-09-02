// Utils module - exports all utility functionality

pub mod logging;
pub mod errors;

pub use logging::{setup_logging, log_with_context, log_error, log_cache_operation, log_proxy_operation};
pub use errors::{AppError, AppResult, ErrorContext, ContextualError, config_error, cache_error, proxy_error, aws_error, json_error, http_error, validation_error, generic_error};
