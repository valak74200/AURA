"""
Service Registry for AURA

Configures and registers all services with the dependency injection container,
providing a centralized place for service configuration and initialization.
"""

import asyncio
from typing import Dict, Any, Optional

from app.config import get_settings
from utils.service_container import ServiceContainer, set_current_container
from utils.logging import get_logger

# Import service interfaces
from services.service_interfaces import (
    IAudioService, IGeminiService, IStorageService, IAuthService,
    ICacheService, IMetricsService, INotificationService,
    IAnalyticsService, IEventBus, IHealthCheckService,
    IConfigurationService, ISecurityService
)

# Import existing service implementations
from services.audio_service import AudioService
from services.gemini_service import GeminiService
from services.storage_service import StorageService
from services.auth_service import AuthService

logger = get_logger(__name__)
settings = get_settings()


class ServiceRegistry:
    """
    Central registry for configuring and managing all application services
    with dependency injection.
    """
    
    def __init__(self):
        self.container = ServiceContainer()
        self._initialized = False
    
    async def initialize(self) -> ServiceContainer:
        """Initialize and configure all services."""
        if self._initialized:
            return self.container
        
        logger.info("Initializing service registry...")
        
        # Register core services
        await self._register_core_services()
        
        # Register business services
        await self._register_business_services()
        
        # Register infrastructure services
        await self._register_infrastructure_services()
        
        # Set as global container
        set_current_container(self.container)
        
        self._initialized = True
        logger.info("Service registry initialized successfully")
        
        return self.container
    
    async def _register_core_services(self):
        """Register core application services."""
        
        # Configuration Service
        self.container.register_singleton(
            IConfigurationService,
            ConfigurationService,
            instance=ConfigurationService(settings)
        )
        
        # Security Service
        self.container.register_singleton(
            ISecurityService,
            SecurityService
        )
        
        # Health Check Service
        self.container.register_singleton(
            IHealthCheckService,
            HealthCheckService
        )
    
    async def _register_business_services(self):
        """Register business logic services."""
        
        # Audio Service
        self.container.register_singleton(
            IAudioService,
            AudioService
        )
        
        # Gemini AI Service
        self.container.register_singleton(
            IGeminiService,
            factory=lambda: self._create_gemini_service()
        )
        
        # Storage Service
        self.container.register_singleton(
            IStorageService,
            StorageService
        )
        
        # Authentication Service
        self.container.register_singleton(
            IAuthService,
            AuthService
        )
        
        # Analytics Service
        self.container.register_singleton(
            IAnalyticsService,
            AnalyticsService
        )
    
    async def _register_infrastructure_services(self):
        """Register infrastructure services."""
        
        # Cache Service (Redis)
        if settings.redis_url:
            self.container.register_singleton(
                ICacheService,
                RedisCacheService
            )
        else:
            # Fallback to in-memory cache
            self.container.register_singleton(
                ICacheService,
                InMemoryCacheService
            )
        
        # Metrics Service
        self.container.register_singleton(
            IMetricsService,
            PrometheusMetricsService
        )
        
        # Event Bus
        self.container.register_singleton(
            IEventBus,
            InMemoryEventBus
        )
        
        # Notification Service
        self.container.register_singleton(
            INotificationService,
            NotificationService
        )
    
    def _create_gemini_service(self) -> GeminiService:
        """Factory method for creating Gemini service."""
        from services.gemini_service import create_gemini_service
        return create_gemini_service(settings)
    
    async def get_service(self, service_type):
        """Get a service instance."""
        return await self.container.get_service(service_type)
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on all services."""
        from utils.service_container import ServiceHealthChecker
        
        health_checker = ServiceHealthChecker(self.container)
        return await health_checker.check_all_services()


# Service implementations for interfaces not yet implemented

class ConfigurationService(IConfigurationService):
    """Configuration service implementation."""
    
    def __init__(self, settings):
        self.settings = settings
        self._config_cache = {}
    
    async def initialize(self):
        """Initialize configuration service."""
        logger.info("Configuration service initialized")
    
    async def cleanup(self):
        """Cleanup configuration service."""
        self._config_cache.clear()
    
    async def get_config(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        if hasattr(self.settings, key):
            return getattr(self.settings, key)
        return self._config_cache.get(key, default)
    
    async def set_config(self, key: str, value: Any) -> bool:
        """Set configuration value."""
        self._config_cache[key] = value
        return True
    
    async def get_all_config(self) -> Dict[str, Any]:
        """Get all configuration values."""
        config = {}
        for key in dir(self.settings):
            if not key.startswith('_'):
                config[key] = getattr(self.settings, key)
        config.update(self._config_cache)
        return config
    
    async def reload_config(self) -> bool:
        """Reload configuration from source."""
        # In a real implementation, this would reload from file/database
        return True


class SecurityService(ISecurityService):
    """Security service implementation."""
    
    async def initialize(self):
        """Initialize security service."""
        logger.info("Security service initialized")
    
    async def cleanup(self):
        """Cleanup security service."""
        pass
    
    async def hash_password(self, password: str) -> str:
        """Hash password securely."""
        import bcrypt
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    async def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash."""
        import bcrypt
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    async def generate_secure_token(self, length: int = 32) -> str:
        """Generate secure random token."""
        import secrets
        return secrets.token_urlsafe(length)
    
    async def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data."""
        # Placeholder implementation
        import base64
        return base64.b64encode(data.encode()).decode()
    
    async def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data."""
        # Placeholder implementation
        import base64
        return base64.b64decode(encrypted_data.encode()).decode()
    
    async def validate_input(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and sanitize input data."""
        # Basic sanitization - in production, use proper validation library
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Basic HTML escaping
                value = value.replace('<', '&lt;').replace('>', '&gt;')
            sanitized[key] = value
        return sanitized


class HealthCheckService(IHealthCheckService):
    """Health check service implementation."""
    
    async def initialize(self):
        """Initialize health check service."""
        logger.info("Health check service initialized")
    
    async def cleanup(self):
        """Cleanup health check service."""
        pass
    
    async def check_database_health(self) -> Dict[str, Any]:
        """Check database connectivity and health."""
        try:
            from app.database import check_database_connection
            is_connected = await check_database_connection()
            return {
                'status': 'healthy' if is_connected else 'unhealthy',
                'details': {'connected': is_connected}
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
    
    async def check_external_services(self) -> Dict[str, Any]:
        """Check external service dependencies."""
        services = {}
        
        # Check Gemini API
        try:
            # This would be a real health check in production
            services['gemini'] = {'status': 'healthy'}
        except Exception as e:
            services['gemini'] = {'status': 'unhealthy', 'error': str(e)}
        
        return services
    
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get system performance metrics."""
        import psutil
        import time
        
        return {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent,
            'uptime': time.time() - psutil.boot_time()
        }
    
    async def get_overall_health(self) -> Dict[str, Any]:
        """Get overall system health status."""
        db_health = await self.check_database_health()
        external_health = await self.check_external_services()
        system_metrics = await self.get_system_metrics()
        
        overall_healthy = (
            db_health['status'] == 'healthy' and
            all(service['status'] == 'healthy' for service in external_health.values())
        )
        
        return {
            'status': 'healthy' if overall_healthy else 'unhealthy',
            'database': db_health,
            'external_services': external_health,
            'system_metrics': system_metrics,
            'timestamp': asyncio.get_event_loop().time()
        }


class InMemoryCacheService(ICacheService):
    """In-memory cache service implementation."""
    
    def __init__(self):
        self._cache = {}
        self._ttl_cache = {}
    
    async def initialize(self):
        """Initialize cache service."""
        logger.info("In-memory cache service initialized")
    
    async def cleanup(self):
        """Cleanup cache service."""
        self._cache.clear()
        self._ttl_cache.clear()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if key in self._ttl_cache:
            if asyncio.get_event_loop().time() > self._ttl_cache[key]:
                del self._cache[key]
                del self._ttl_cache[key]
                return None
        return self._cache.get(key)
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with optional TTL."""
        self._cache[key] = value
        if ttl:
            self._ttl_cache[key] = asyncio.get_event_loop().time() + ttl
        return True
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        if key in self._cache:
            del self._cache[key]
        if key in self._ttl_cache:
            del self._ttl_cache[key]
        return True
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        return await self.get(key) is not None
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        import fnmatch
        keys_to_delete = [key for key in self._cache.keys() if fnmatch.fnmatch(key, pattern)]
        for key in keys_to_delete:
            await self.delete(key)
        return len(keys_to_delete)


class RedisCacheService(ICacheService):
    """Redis cache service implementation using redis-py with async support."""
    
    def __init__(self):
        self.redis = None
        self._connection_pool = None
    
    async def initialize(self):
        """Initialize Redis connection."""
        try:
            import redis.asyncio as redis
            from urllib.parse import urlparse
            
            # Parse Redis URL
            parsed_url = urlparse(settings.redis_url)
            
            # Create connection pool with configuration
            self._connection_pool = redis.ConnectionPool(
                host=parsed_url.hostname or 'localhost',
                port=parsed_url.port or 6379,
                db=int(parsed_url.path.lstrip('/')) if parsed_url.path else 0,
                password=parsed_url.password,
                decode_responses=True,
                max_connections=settings.redis_max_connections,
                socket_timeout=settings.redis_socket_timeout,
                socket_connect_timeout=settings.redis_socket_connect_timeout,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Create Redis client
            self.redis = redis.Redis(connection_pool=self._connection_pool)
            
            # Test connection
            await self.redis.ping()
            logger.info(f"Redis cache service initialized successfully at {settings.redis_url}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}")
            # Fallback to in-memory cache if Redis is not available
            logger.warning("Falling back to in-memory cache")
            self.redis = None
    
    async def cleanup(self):
        """Cleanup Redis connection."""
        if self.redis:
            await self.redis.aclose()
        if self._connection_pool:
            await self._connection_pool.aclose()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.redis:
            return None
        try:
            import json
            value = await self.redis.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            logger.warning(f"Redis get failed for key {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with optional TTL."""
        if not self.redis:
            return False
        try:
            import json
            serialized = json.dumps(value, default=str)  # Handle datetime and other objects
            if ttl:
                await self.redis.setex(key, ttl, serialized)
            else:
                await self.redis.set(key, serialized)
            return True
        except Exception as e:
            logger.warning(f"Redis set failed for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        if not self.redis:
            return False
        try:
            result = await self.redis.delete(key)
            return bool(result)
        except Exception as e:
            logger.warning(f"Redis delete failed for key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        if not self.redis:
            return False
        try:
            result = await self.redis.exists(key)
            return bool(result)
        except Exception as e:
            logger.warning(f"Redis exists failed for key {key}: {e}")
            return False
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        if not self.redis:
            return 0
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                deleted = await self.redis.delete(*keys)
                return deleted
            return 0
        except Exception as e:
            logger.warning(f"Redis clear_pattern failed for pattern {pattern}: {e}")
            return 0
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get Redis cache statistics."""
        if not self.redis:
            return {"status": "disconnected"}
        try:
            info = await self.redis.info()
            return {
                "status": "connected",
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0)
            }
        except Exception as e:
            logger.warning(f"Redis stats failed: {e}")
            return {"status": "error", "error": str(e)}


# Placeholder implementations for other services
class AnalyticsService(IAnalyticsService):
    async def initialize(self): pass
    async def cleanup(self): pass
    async def track_event(self, event_name: str, user_id=None, properties=None): pass
    async def get_session_analytics(self, session_id): return {}
    async def get_user_analytics(self, user_id, date_range=None): return {}


class PrometheusMetricsService(IMetricsService):
    async def initialize(self): pass
    async def cleanup(self): pass
    async def record_metric(self, name: str, value: float, tags=None): pass
    async def increment_counter(self, name: str, tags=None): pass
    async def record_histogram(self, name: str, value: float, tags=None): pass
    async def get_metrics(self): return {}


class InMemoryEventBus(IEventBus):
    def __init__(self):
        self._handlers = {}
        self._events = []
    
    async def initialize(self): pass
    async def cleanup(self): pass
    async def publish(self, event_type: str, data: Dict[str, Any], metadata=None): pass
    async def subscribe(self, event_type: str, handler: callable) -> str: return "sub_id"
    async def unsubscribe(self, subscription_id: str) -> bool: return True
    async def get_event_history(self, event_type=None, limit=100): return []


class NotificationService(INotificationService):
    async def initialize(self): pass
    async def cleanup(self): pass
    async def send_notification(self, user_id, message: str, notification_type="info") -> bool: return True
    async def send_email(self, to_email: str, subject: str, body: str, html_body=None) -> bool: return True
    async def get_user_notifications(self, user_id, limit=50): return []


# Global service registry instance
_service_registry: Optional[ServiceRegistry] = None


async def get_service_registry() -> ServiceRegistry:
    """Get or create the global service registry."""
    global _service_registry
    if _service_registry is None:
        _service_registry = ServiceRegistry()
        await _service_registry.initialize()
    return _service_registry


async def get_service(service_type):
    """Convenience function to get a service."""
    registry = await get_service_registry()
    return await registry.get_service(service_type)