// Library root - exports all modules

pub mod cache;
pub mod proxy;
pub mod utils;

pub use cache::{CacheKey, CacheStore, CachePolicy};
pub use proxy::{fetch_upstream, UpstreamFetcher, normalize_request, normalize_response, strip_sensitive_headers, add_cache_headers};
pub use utils::{AppError, AppResult, setup_logging, log_with_context, log_error, log_cache_operation, log_proxy_operation};
