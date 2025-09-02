#!/usr/bin/env python3

"""
Load testing script for dejafoo proxy
Tests cache performance and proxy throughput
"""

import asyncio
import aiohttp
import time
import json
import argparse
import statistics
from typing import List, Dict, Any
import sys
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import random

@dataclass
class TestResult:
    """Result of a single test request"""
    status_code: int
    response_time: float
    cache_hit: bool
    error: str = None

@dataclass
class LoadTestConfig:
    """Configuration for load testing"""
    base_url: str
    concurrent_requests: int
    total_requests: int
    test_endpoints: List[str]
    cache_test_ratio: float = 0.7  # 70% cache hits, 30% cache misses
    request_timeout: int = 30

class LoadTester:
    """Load testing client for dejafoo proxy"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results: List[TestResult] = []
        self.session: aiohttp.ClientSession = None
        
    async def __aenter__(self):
        timeout = aiohttp.ClientTimeout(total=self.config.request_timeout)
        self.session = aiohttp.ClientSession(timeout=timeout)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def make_request(self, endpoint: str, headers: Dict[str, str] = None) -> TestResult:
        """Make a single HTTP request"""
        url = f"{self.config.base_url}{endpoint}"
        start_time = time.time()
        
        try:
            async with self.session.get(url, headers=headers) as response:
                response_time = time.time() - start_time
                
                # Check if it's a cache hit
                cache_hit = response.headers.get('X-Cache') == 'HIT'
                
                return TestResult(
                    status_code=response.status,
                    response_time=response_time,
                    cache_hit=cache_hit
                )
        except Exception as e:
            response_time = time.time() - start_time
            return TestResult(
                status_code=0,
                response_time=response_time,
                cache_hit=False,
                error=str(e)
            )
    
    async def run_cache_test(self) -> List[TestResult]:
        """Run cache performance test"""
        print("Running cache performance test...")
        results = []
        
        # First, populate cache with some requests
        print("Populating cache...")
        for endpoint in self.config.test_endpoints:
            result = await self.make_request(endpoint)
            results.append(result)
            await asyncio.sleep(0.1)  # Small delay between requests
        
        # Now test cache hits
        print("Testing cache hits...")
        cache_hit_tasks = []
        for _ in range(int(self.config.total_requests * self.config.cache_test_ratio)):
            endpoint = random.choice(self.config.test_endpoints)
            task = self.make_request(endpoint)
            cache_hit_tasks.append(task)
        
        cache_hit_results = await asyncio.gather(*cache_hit_tasks, return_exceptions=True)
        for result in cache_hit_results:
            if isinstance(result, TestResult):
                results.append(result)
        
        return results
    
    async def run_concurrent_test(self) -> List[TestResult]:
        """Run concurrent load test"""
        print(f"Running concurrent load test with {self.config.concurrent_requests} concurrent requests...")
        
        semaphore = asyncio.Semaphore(self.config.concurrent_requests)
        
        async def make_request_with_semaphore():
            async with semaphore:
                endpoint = random.choice(self.config.test_endpoints)
                return await self.make_request(endpoint)
        
        tasks = [make_request_with_semaphore() for _ in range(self.config.total_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return [r for r in results if isinstance(r, TestResult)]
    
    async def run_throughput_test(self, duration_seconds: int = 60) -> List[TestResult]:
        """Run throughput test for a specified duration"""
        print(f"Running throughput test for {duration_seconds} seconds...")
        
        results = []
        start_time = time.time()
        
        while time.time() - start_time < duration_seconds:
            tasks = []
            for _ in range(self.config.concurrent_requests):
                endpoint = random.choice(self.config.test_endpoints)
                task = self.make_request(endpoint)
                tasks.append(task)
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in batch_results:
                if isinstance(result, TestResult):
                    results.append(result)
            
            # Small delay to prevent overwhelming the server
            await asyncio.sleep(0.1)
        
        return results
    
    def analyze_results(self, results: List[TestResult]) -> Dict[str, Any]:
        """Analyze test results and return statistics"""
        if not results:
            return {"error": "No results to analyze"}
        
        successful_results = [r for r in results if r.status_code == 200]
        error_results = [r for r in results if r.status_code != 200]
        
        response_times = [r.response_time for r in successful_results]
        cache_hits = [r for r in results if r.cache_hit]
        
        stats = {
            "total_requests": len(results),
            "successful_requests": len(successful_results),
            "error_requests": len(error_results),
            "success_rate": len(successful_results) / len(results) * 100,
            "cache_hits": len(cache_hits),
            "cache_hit_rate": len(cache_hits) / len(results) * 100,
            "average_response_time": statistics.mean(response_times) if response_times else 0,
            "median_response_time": statistics.median(response_times) if response_times else 0,
            "p95_response_time": statistics.quantiles(response_times, n=20)[18] if len(response_times) > 20 else max(response_times) if response_times else 0,
            "p99_response_time": statistics.quantiles(response_times, n=100)[98] if len(response_times) > 100 else max(response_times) if response_times else 0,
            "min_response_time": min(response_times) if response_times else 0,
            "max_response_time": max(response_times) if response_times else 0,
            "requests_per_second": len(results) / (max(r.response_time for r in results) if results else 1),
        }
        
        return stats
    
    def print_results(self, stats: Dict[str, Any]):
        """Print test results in a formatted way"""
        print("\n" + "="*60)
        print("LOAD TEST RESULTS")
        print("="*60)
        
        print(f"Total Requests: {stats['total_requests']}")
        print(f"Successful Requests: {stats['successful_requests']}")
        print(f"Error Requests: {stats['error_requests']}")
        print(f"Success Rate: {stats['success_rate']:.2f}%")
        print(f"Cache Hits: {stats['cache_hits']}")
        print(f"Cache Hit Rate: {stats['cache_hit_rate']:.2f}%")
        
        print("\nResponse Time Statistics:")
        print(f"  Average: {stats['average_response_time']:.3f}s")
        print(f"  Median: {stats['median_response_time']:.3f}s")
        print(f"  95th Percentile: {stats['p95_response_time']:.3f}s")
        print(f"  99th Percentile: {stats['p99_response_time']:.3f}s")
        print(f"  Min: {stats['min_response_time']:.3f}s")
        print(f"  Max: {stats['max_response_time']:.3f}s")
        
        print(f"\nThroughput: {stats['requests_per_second']:.2f} requests/second")
        print("="*60)

async def main():
    parser = argparse.ArgumentParser(description="Load test dejafoo proxy")
    parser.add_argument("--url", required=True, help="Base URL of the proxy (e.g., http://localhost:8080)")
    parser.add_argument("--concurrent", type=int, default=10, help="Number of concurrent requests")
    parser.add_argument("--total", type=int, default=100, help="Total number of requests")
    parser.add_argument("--endpoints", nargs="+", default=["/api/users", "/api/posts", "/api/comments"], 
                       help="Test endpoints")
    parser.add_argument("--cache-ratio", type=float, default=0.7, 
                       help="Ratio of cache hits to cache misses")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    parser.add_argument("--test-type", choices=["cache", "concurrent", "throughput"], 
                       default="concurrent", help="Type of test to run")
    parser.add_argument("--duration", type=int, default=60, 
                       help="Duration for throughput test in seconds")
    
    args = parser.parse_args()
    
    config = LoadTestConfig(
        base_url=args.url,
        concurrent_requests=args.concurrent,
        total_requests=args.total,
        test_endpoints=args.endpoints,
        cache_test_ratio=args.cache_ratio,
        request_timeout=args.timeout
    )
    
    print(f"Starting load test with configuration:")
    print(f"  URL: {config.base_url}")
    print(f"  Concurrent requests: {config.concurrent_requests}")
    print(f"  Total requests: {config.total_requests}")
    print(f"  Test endpoints: {config.test_endpoints}")
    print(f"  Test type: {args.test_type}")
    
    async with LoadTester(config) as tester:
        if args.test_type == "cache":
            results = await tester.run_cache_test()
        elif args.test_type == "concurrent":
            results = await tester.run_concurrent_test()
        elif args.test_type == "throughput":
            results = await tester.run_throughput_test(args.duration)
        
        stats = tester.analyze_results(results)
        tester.print_results(stats)
        
        # Save results to file
        timestamp = int(time.time())
        filename = f"load_test_results_{timestamp}.json"
        with open(filename, 'w') as f:
            json.dump({
                "config": {
                    "base_url": config.base_url,
                    "concurrent_requests": config.concurrent_requests,
                    "total_requests": config.total_requests,
                    "test_endpoints": config.test_endpoints,
                    "test_type": args.test_type
                },
                "stats": stats,
                "raw_results": [
                    {
                        "status_code": r.status_code,
                        "response_time": r.response_time,
                        "cache_hit": r.cache_hit,
                        "error": r.error
                    } for r in results
                ]
            }, f, indent=2)
        
        print(f"\nResults saved to: {filename}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Test failed: {e}")
        sys.exit(1)
