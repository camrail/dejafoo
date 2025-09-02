// Proxy module - exports all proxy-related functionality

pub mod fetch;
pub mod normalize;

pub use fetch::{fetch_upstream, UpstreamFetcher};
pub use normalize::{normalize_request, normalize_response, strip_sensitive_headers, add_cache_headers};
