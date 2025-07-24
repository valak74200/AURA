"""
Cache Service for AURA

Provides high-level caching functionality with Redis backend,
including specialized methods for different data types and use cases.
"""

import json
import hashlib
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta

from app.config import get_settings
from utils.logging import get_logger
from services.service_interfaces import ICacheService

logger = get_logger(__name__)
settings = get_settings()


class CacheService:
    """
    High-level cache service with specialized methods for different data types.
    """
    
    def __init__(self, cache_backend: ICacheService):
        self.cache = cache_backend
        self._key_prefix = "aura:"
    
    async def initialize(self):
        """Initialize cache service."""
        await self.cache.initialize()
        logger.info("Cache service initialized")
    
    async def cleanup(self):
        """Cleanup cache service."""
        await self.cache.cleanup()
    
    def _make_key(self, namespace: str, key: str) -> str:
        """Create a namespaced cache key."""
        return f"{self._key_prefix}{namespace}:{key}"
    
    def _hash_key(self, data: Union[str, Dict, List]) -> str:
        """Create a hash from complex data for use as cache key."""
        if isinstance(data, str):
            return data
        
        # Convert to JSON string and hash
        json_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.md5(json_str.encode()).hexdigest()
    
    # Session caching methods
    async def cache_session_data(self, session_id: str, data: Dict[str, Any]) -> bool:
        """Cache session data with session-specific TTL."""
        key = self._make_key("session", session_id)
        return await self.cache.set(key, data, ttl=settings.cache_session_ttl)
    
    async def get_session_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get cached session data."""
        key = self._make_key("session", session_id)
        return await self.cache.get(key)
    
    async def invalidate_session(self, session_id: str) -> bool:
        """Invalidate session cache."""
        key = self._make_key("session", session_id)
        return await self.cache.delete(key)
    
    # User caching methods
    async def cache_user_data(self, user_id: str, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache user data."""
        key = self._make_key("user", user_id)
        return await self.cache.set(key, data, ttl=ttl or settings.cache_default_ttl)
    
    async def get_user_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached user data."""
        key = self._make_key("user", user_id)
        return await self.cache.get(key)
    
    async def invalidate_user_cache(self, user_id: str) -> bool:
        """Invalidate all user-related cache."""
        pattern = self._make_key("user", f"{user_id}*")
        deleted = await self.cache.clear_pattern(pattern)
        return deleted > 0
    
    # Analytics caching methods
    async def cache_analytics_data(self, analytics_key: str, data: Dict[str, Any]) -> bool:
        """Cache analytics data with analytics-specific TTL."""
        key = self._make_key("analytics", analytics_key)
        return await self.cache.set(key, data, ttl=settings.cache_analytics_ttl)
    
    async def get_analytics_data(self, analytics_key: str) -> Optional[Dict[str, Any]]:
        """Get cached analytics data."""
        key = self._make_key("analytics", analytics_key)
        return await self.cache.get(key)
    
    # Audio processing caching methods
    async def cache_audio_analysis(self, audio_hash: str, analysis_data: Dict[str, Any]) -> bool:
        """Cache audio analysis results."""
        key = self._make_key("audio_analysis", audio_hash)
        return await self.cache.set(key, analysis_data, ttl=settings.cache_default_ttl)
    
    async def get_audio_analysis(self, audio_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached audio analysis."""
        key = self._make_key("audio_analysis", audio_hash)
        return await self.cache.get(key)
    
    # API response caching methods
    async def cache_api_response(self, endpoint: str, params: Dict[str, Any], response_data: Any, ttl: int = 300) -> bool:
        """Cache API response data."""
        cache_key = self._hash_key({"endpoint": endpoint, "params": params})
        key = self._make_key("api_response", cache_key)
        return await self.cache.set(key, response_data, ttl=ttl)
    
    async def get_cached_api_response(self, endpoint: str, params: Dict[str, Any]) -> Optional[Any]:
        """Get cached API response."""
        cache_key = self._hash_key({"endpoint": endpoint, "params": params})
        key = self._make_key("api_response", cache_key)
        return await self.cache.get(key)
    
    # Generic caching methods with decorators support
    async def cache_function_result(self, function_name: str, args: tuple, kwargs: dict, result: Any, ttl: int = 3600) -> bool:
        """Cache function result for memoization."""
        cache_key = self._hash_key({
            "function": function_name,
            "args": args,
            "kwargs": kwargs
        })
        key = self._make_key("function_result", cache_key)
        return await self.cache.set(key, result, ttl=ttl)
    
    async def get_cached_function_result(self, function_name: str, args: tuple, kwargs: dict) -> Optional[Any]:
        """Get cached function result."""
        cache_key = self._hash_key({
            "function": function_name,
            "args": args,
            "kwargs": kwargs
        })
        key = self._make_key("function_result", cache_key)
        return await self.cache.get(key)
    
    # Batch operations
    async def cache_multiple(self, items: Dict[str, Dict[str, Any]], namespace: str, ttl: Optional[int] = None) -> Dict[str, bool]:
        """Cache multiple items at once."""
        results = {}
        for item_key, item_data in items.items():
            key = self._make_key(namespace, item_key)
            results[item_key] = await self.cache.set(key, item_data, ttl=ttl or settings.cache_default_ttl)
        return results
    
    async def get_multiple(self, keys: List[str], namespace: str) -> Dict[str, Any]:
        """Get multiple cached items at once."""
        results = {}
        for item_key in keys:
            key = self._make_key(namespace, item_key)
            results[item_key] = await self.cache.get(key)
        return results
    
    # Cache management methods
    async def clear_namespace(self, namespace: str) -> int:
        """Clear all cache entries in a namespace."""
        pattern = self._make_key(namespace, "*")
        return await self.cache.clear_pattern(pattern)
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if hasattr(self.cache, 'get_stats'):
            return await self.cache.get_stats()
        return {"status": "stats_not_available"}
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform cache health check."""
        try:
            # Test basic operations
            test_key = self._make_key("health", "test")
            test_data = {"timestamp": datetime.utcnow().isoformat(), "test": True}
            
            # Test set
            set_result = await self.cache.set(test_key, test_data, ttl=60)
            if not set_result:
                return {"status": "unhealthy", "error": "Failed to set test data"}
            
            # Test get
            get_result = await self.cache.get(test_key)
            if get_result != test_data:
                return {"status": "unhealthy", "error": "Failed to retrieve test data"}
            
            # Test delete
            delete_result = await self.cache.delete(test_key)
            if not delete_result:
                return {"status": "unhealthy", "error": "Failed to delete test data"}
            
            # Get additional stats if available
            stats = await self.get_cache_stats()
            
            return {
                "status": "healthy",
                "stats": stats,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Cache health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


def cache_decorator(namespace: str = "function", ttl: int = 3600):
    """
    Decorator for caching function results.
    
    Usage:
        @cache_decorator(namespace="my_functions", ttl=1800)
        async def my_expensive_function(arg1, arg2):
            # expensive computation
            return result
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get cache service from container
            from utils.service_container import get_current_container
            container = get_current_container()
            if not container:
                # No container available, execute function directly
                return await func(*args, **kwargs)
            
            try:
                cache_service_interface = await container.get_service(ICacheService)
                cache_service = CacheService(cache_service_interface)
                
                # Try to get cached result
                cached_result = await cache_service.get_cached_function_result(
                    func.__name__, args, kwargs
                )
                
                if cached_result is not None:
                    logger.debug(f"Cache hit for function {func.__name__}")
                    return cached_result
                
                # Execute function and cache result
                result = await func(*args, **kwargs)
                await cache_service.cache_function_result(
                    func.__name__, args, kwargs, result, ttl
                )
                
                logger.debug(f"Cache miss for function {func.__name__}, result cached")
                return result
                
            except Exception as e:
                logger.warning(f"Cache decorator failed for {func.__name__}: {e}")
                # Fall back to executing function directly
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator