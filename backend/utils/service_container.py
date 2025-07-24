"""
Dependency Injection Container for AURA

Provides a flexible service container for managing dependencies,
supporting singleton and transient lifetimes, lazy loading,
and automatic dependency resolution.
"""

import asyncio
import inspect
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Type, TypeVar, Union, get_type_hints
from functools import wraps
import logging

from utils.logging import get_logger

logger = get_logger(__name__)

T = TypeVar('T')


class ServiceLifetime(Enum):
    """Service lifetime options."""
    SINGLETON = "singleton"
    TRANSIENT = "transient"
    SCOPED = "scoped"


class ServiceDescriptor:
    """Describes how a service should be created and managed."""
    
    def __init__(
        self,
        service_type: Type,
        implementation_type: Optional[Type] = None,
        factory: Optional[Callable] = None,
        instance: Optional[Any] = None,
        lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT,
        lazy: bool = True
    ):
        self.service_type = service_type
        self.implementation_type = implementation_type or service_type
        self.factory = factory
        self.instance = instance
        self.lifetime = lifetime
        self.lazy = lazy
        self.dependencies: List[Type] = []
        
        # Analyze dependencies if we have an implementation
        if self.implementation_type and not self.factory:
            self._analyze_dependencies()
    
    def _analyze_dependencies(self):
        """Analyze constructor dependencies."""
        try:
            init_signature = inspect.signature(self.implementation_type.__init__)
            type_hints = get_type_hints(self.implementation_type.__init__)
            
            for param_name, param in init_signature.parameters.items():
                if param_name == 'self':
                    continue
                    
                if param_name in type_hints:
                    self.dependencies.append(type_hints[param_name])
                elif param.annotation != inspect.Parameter.empty:
                    self.dependencies.append(param.annotation)
                    
        except Exception as e:
            logger.warning(f"Could not analyze dependencies for {self.implementation_type}: {e}")


class ServiceContainer:
    """
    Dependency injection container with support for different service lifetimes,
    automatic dependency resolution, and async service creation.
    """
    
    def __init__(self):
        self._services: Dict[Type, ServiceDescriptor] = {}
        self._instances: Dict[Type, Any] = {}
        self._scoped_instances: Dict[str, Dict[Type, Any]] = {}
        self._creating: set = set()  # Prevent circular dependencies
        self._lock = asyncio.Lock()
    
    def register_singleton(
        self, 
        service_type: Type[T], 
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None,
        instance: Optional[T] = None
    ) -> 'ServiceContainer':
        """Register a singleton service."""
        return self._register(
            service_type, 
            implementation_type, 
            factory, 
            instance, 
            ServiceLifetime.SINGLETON
        )
    
    def register_transient(
        self, 
        service_type: Type[T], 
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None
    ) -> 'ServiceContainer':
        """Register a transient service (new instance each time)."""
        return self._register(
            service_type, 
            implementation_type, 
            factory, 
            None, 
            ServiceLifetime.TRANSIENT
        )
    
    def register_scoped(
        self, 
        service_type: Type[T], 
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None
    ) -> 'ServiceContainer':
        """Register a scoped service (one instance per scope)."""
        return self._register(
            service_type, 
            implementation_type, 
            factory, 
            None, 
            ServiceLifetime.SCOPED
        )
    
    def _register(
        self,
        service_type: Type,
        implementation_type: Optional[Type] = None,
        factory: Optional[Callable] = None,
        instance: Optional[Any] = None,
        lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
    ) -> 'ServiceContainer':
        """Internal registration method."""
        if service_type in self._services:
            logger.warning(f"Service {service_type} is already registered. Overriding.")
        
        descriptor = ServiceDescriptor(
            service_type=service_type,
            implementation_type=implementation_type,
            factory=factory,
            instance=instance,
            lifetime=lifetime
        )
        
        self._services[service_type] = descriptor
        
        # If it's a singleton with an instance, store it immediately
        if lifetime == ServiceLifetime.SINGLETON and instance is not None:
            self._instances[service_type] = instance
        
        logger.debug(f"Registered {lifetime.value} service: {service_type.__name__}")
        return self
    
    async def get_service(self, service_type: Type[T], scope_id: Optional[str] = None) -> T:
        """Get a service instance, creating it if necessary."""
        async with self._lock:
            return await self._get_service_internal(service_type, scope_id)
    
    async def _get_service_internal(self, service_type: Type[T], scope_id: Optional[str] = None) -> T:
        """Internal service resolution method."""
        if service_type not in self._services:
            raise ValueError(f"Service {service_type} is not registered")
        
        descriptor = self._services[service_type]
        
        # Check for circular dependencies
        if service_type in self._creating:
            raise ValueError(f"Circular dependency detected for service {service_type}")
        
        # Handle different lifetimes
        if descriptor.lifetime == ServiceLifetime.SINGLETON:
            if service_type in self._instances:
                return self._instances[service_type]
            
            instance = await self._create_instance(descriptor, scope_id)
            self._instances[service_type] = instance
            return instance
        
        elif descriptor.lifetime == ServiceLifetime.SCOPED:
            if not scope_id:
                raise ValueError(f"Scope ID required for scoped service {service_type}")
            
            if scope_id not in self._scoped_instances:
                self._scoped_instances[scope_id] = {}
            
            if service_type in self._scoped_instances[scope_id]:
                return self._scoped_instances[scope_id][service_type]
            
            instance = await self._create_instance(descriptor, scope_id)
            self._scoped_instances[scope_id][service_type] = instance
            return instance
        
        else:  # TRANSIENT
            return await self._create_instance(descriptor, scope_id)
    
    async def _create_instance(self, descriptor: ServiceDescriptor, scope_id: Optional[str] = None) -> Any:
        """Create a new service instance."""
        self._creating.add(descriptor.service_type)
        
        try:
            # Use provided instance
            if descriptor.instance is not None:
                return descriptor.instance
            
            # Use factory function
            if descriptor.factory:
                if asyncio.iscoroutinefunction(descriptor.factory):
                    return await descriptor.factory()
                else:
                    return descriptor.factory()
            
            # Create using constructor with dependency injection
            return await self._create_with_dependencies(descriptor, scope_id)
        
        finally:
            self._creating.discard(descriptor.service_type)
    
    async def _create_with_dependencies(self, descriptor: ServiceDescriptor, scope_id: Optional[str] = None) -> Any:
        """Create instance with automatic dependency injection."""
        constructor = descriptor.implementation_type.__init__
        signature = inspect.signature(constructor)
        type_hints = get_type_hints(constructor)
        
        kwargs = {}
        
        for param_name, param in signature.parameters.items():
            if param_name == 'self':
                continue
            
            # Get parameter type
            param_type = None
            if param_name in type_hints:
                param_type = type_hints[param_name]
            elif param.annotation != inspect.Parameter.empty:
                param_type = param.annotation
            
            if param_type and param_type in self._services:
                # Resolve dependency
                dependency = await self._get_service_internal(param_type, scope_id)
                kwargs[param_name] = dependency
            elif param.default != inspect.Parameter.empty:
                # Use default value
                kwargs[param_name] = param.default
            else:
                logger.warning(f"Cannot resolve dependency {param_name} for {descriptor.service_type}")
        
        # Create instance
        instance = descriptor.implementation_type(**kwargs)
        
        # If it's async, await it
        if asyncio.iscoroutine(instance):
            instance = await instance
        
        logger.debug(f"Created instance of {descriptor.service_type.__name__}")
        return instance
    
    def create_scope(self, scope_id: str) -> 'ServiceScope':
        """Create a new service scope."""
        return ServiceScope(self, scope_id)
    
    def clear_scope(self, scope_id: str):
        """Clear all scoped instances for a given scope."""
        if scope_id in self._scoped_instances:
            del self._scoped_instances[scope_id]
            logger.debug(f"Cleared scope: {scope_id}")
    
    def is_registered(self, service_type: Type) -> bool:
        """Check if a service type is registered."""
        return service_type in self._services
    
    def get_registered_services(self) -> List[Type]:
        """Get list of all registered service types."""
        return list(self._services.keys())
    
    def get_service_info(self, service_type: Type) -> Optional[Dict[str, Any]]:
        """Get information about a registered service."""
        if service_type not in self._services:
            return None
        
        descriptor = self._services[service_type]
        return {
            'service_type': descriptor.service_type.__name__,
            'implementation_type': descriptor.implementation_type.__name__,
            'lifetime': descriptor.lifetime.value,
            'has_factory': descriptor.factory is not None,
            'has_instance': descriptor.instance is not None,
            'dependencies': [dep.__name__ for dep in descriptor.dependencies]
        }


class ServiceScope:
    """Represents a service scope for scoped service lifetimes."""
    
    def __init__(self, container: ServiceContainer, scope_id: str):
        self.container = container
        self.scope_id = scope_id
    
    async def get_service(self, service_type: Type[T]) -> T:
        """Get a service within this scope."""
        return await self.container.get_service(service_type, self.scope_id)
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.container.clear_scope(self.scope_id)
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.container.clear_scope(self.scope_id)


# Decorator for automatic service injection
def inject(*service_types: Type):
    """Decorator to automatically inject services into function parameters."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get container from global or context
            container = get_current_container()
            if not container:
                raise RuntimeError("No service container available")
            
            # Inject services
            signature = inspect.signature(func)
            type_hints = get_type_hints(func)
            
            for param_name, param in signature.parameters.items():
                if param_name in type_hints and type_hints[param_name] in service_types:
                    if param_name not in kwargs:
                        service = await container.get_service(type_hints[param_name])
                        kwargs[param_name] = service
            
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


# Global container management
_current_container: Optional[ServiceContainer] = None


def set_current_container(container: ServiceContainer):
    """Set the current global service container."""
    global _current_container
    _current_container = container


def get_current_container() -> Optional[ServiceContainer]:
    """Get the current global service container."""
    return _current_container


def create_container() -> ServiceContainer:
    """Create a new service container."""
    return ServiceContainer()


# Service interface base class
class IService(ABC):
    """Base interface for services."""
    
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the service."""
        pass
    
    @abstractmethod
    async def cleanup(self) -> None:
        """Cleanup the service."""
        pass


# Health check for services
class ServiceHealthChecker:
    """Health checker for registered services."""
    
    def __init__(self, container: ServiceContainer):
        self.container = container
    
    async def check_service_health(self, service_type: Type) -> Dict[str, Any]:
        """Check health of a specific service."""
        try:
            service = await self.container.get_service(service_type)
            
            # If service has a health check method, use it
            if hasattr(service, 'health_check'):
                health_result = service.health_check()
                if asyncio.iscoroutine(health_result):
                    health_result = await health_result
                return {
                    'service': service_type.__name__,
                    'status': 'healthy' if health_result else 'unhealthy',
                    'details': health_result if isinstance(health_result, dict) else {}
                }
            
            return {
                'service': service_type.__name__,
                'status': 'healthy',
                'details': {'message': 'Service instance created successfully'}
            }
            
        except Exception as e:
            return {
                'service': service_type.__name__,
                'status': 'unhealthy',
                'error': str(e)
            }
    
    async def check_all_services(self) -> Dict[str, Any]:
        """Check health of all registered services."""
        services = self.container.get_registered_services()
        results = {}
        
        for service_type in services:
            results[service_type.__name__] = await self.check_service_health(service_type)
        
        overall_healthy = all(
            result['status'] == 'healthy' 
            for result in results.values()
        )
        
        return {
            'overall_status': 'healthy' if overall_healthy else 'unhealthy',
            'services': results,
            'timestamp': asyncio.get_event_loop().time()
        }