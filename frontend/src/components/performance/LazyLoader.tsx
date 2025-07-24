import React, { Suspense, lazy, ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '../ui/modern';
import { useMotion } from '../../contexts/EnhancedThemeContext';

interface LazyLoaderProps {
  fallback?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

// Composant de base pour le lazy loading
const LazyLoader: React.FC<LazyLoaderProps> = ({
  fallback,
  className,
  children
}) => {
  const { shouldAnimate } = useMotion();

  const defaultFallback = (
    <div className={className}>
      <Skeleton height={200} variant="rounded" />
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <motion.div
        initial={shouldAnimate ? { opacity: 0 } : {}}
        animate={shouldAnimate ? { opacity: 1 } : {}}
        transition={{ duration: 0.3 }}
        className={className}
      >
        {children}
      </motion.div>
    </Suspense>
  );
};

// HOC pour créer des composants lazy
export const withLazyLoading = <P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = lazy(() => Promise.resolve({ default: Component }));
  
  return React.forwardRef<any, P>((props, ref) => (
    <LazyLoader fallback={fallback}>
      <LazyComponent {...props} ref={ref} />
    </LazyLoader>
  ));
};

// Hook pour le lazy loading conditionnel
export const useLazyLoading = (shouldLoad: boolean, delay: number = 0) => {
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    if (shouldLoad && !isLoaded) {
      const timer = setTimeout(() => {
        setIsLoaded(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [shouldLoad, isLoaded, delay]);

  return isLoaded;
};

// Composant pour le lazy loading basé sur l'intersection
export const IntersectionLazyLoader: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  className?: string;
  once?: boolean;
}> = ({
  children,
  fallback,
  threshold = 0.1,
  rootMargin = '50px',
  className,
  once = true
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            setHasLoaded(true);
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  const shouldShow = once ? hasLoaded : isVisible;

  return (
    <div ref={ref} className={className}>
      {shouldShow ? (
        <LazyLoader fallback={fallback}>
          {children}
        </LazyLoader>
      ) : (
        fallback || <Skeleton height={200} variant="rounded" />
      )}
    </div>
  );
};

// Composant pour le chargement progressif d'images
export const LazyImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
}> = ({
  src,
  alt,
  className,
  placeholder,
  blurDataURL,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const { shouldAnimate } = useMotion();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse">
          {blurDataURL && (
            <img
              src={blurDataURL}
              alt=""
              className="w-full h-full object-cover opacity-50 blur-sm"
            />
          )}
          {placeholder && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              {placeholder}
            </div>
          )}
        </div>
      )}

      {/* Main image */}
      {isInView && (
        <motion.img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          initial={shouldAnimate ? { opacity: 0 } : {}}
          animate={shouldAnimate ? { opacity: isLoaded ? 1 : 0 } : {}}
          transition={{ duration: 0.3 }}
          className={`w-full h-full object-cover ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-sm">Erreur de chargement</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour le lazy loading de modules
export const LazyModule: React.FC<{
  moduleLoader: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
  props?: any;
  className?: string;
}> = ({ moduleLoader, fallback, props = {}, className }) => {
  const [Component, setComponent] = React.useState<ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    moduleLoader()
      .then((module) => {
        setComponent(() => module.default);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, [moduleLoader]);

  if (isLoading) {
    return (
      <div className={className}>
        {fallback || <Skeleton height={200} variant="rounded" />}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-500/10 border border-red-500/20 rounded-lg ${className}`}>
        <div className="text-red-400 text-sm">
          Erreur de chargement du module: {error.message}
        </div>
      </div>
    );
  }

  if (!Component) {
    return null;
  }

  return (
    <div className={className}>
      <Component {...props} />
    </div>
  );
};

// Hook pour le preloading de ressources
export const usePreloader = () => {
  const preloadImage = React.useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const preloadModule = React.useCallback(
    (moduleLoader: () => Promise<any>): Promise<any> => {
      return moduleLoader();
    },
    []
  );

  const preloadFont = React.useCallback((fontUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = fontUrl;
      link.onload = () => resolve();
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }, []);

  return {
    preloadImage,
    preloadModule,
    preloadFont
  };
};

export default LazyLoader;