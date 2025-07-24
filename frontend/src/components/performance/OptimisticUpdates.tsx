import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useMotion } from '../../contexts/EnhancedThemeContext';

// Types pour les mises à jour optimistes
export interface OptimisticAction<T = any> {
  id: string;
  type: string;
  payload: T;
  optimisticUpdate: (currentState: any) => any;
  rollback: (currentState: any) => any;
  retry?: () => Promise<void>;
}

export interface OptimisticState<T = any> {
  data: T;
  pendingActions: OptimisticAction[];
  errors: Array<{ actionId: string; error: Error }>;
}

// Hook pour les mises à jour optimistes
export const useOptimisticUpdates = <T,>(initialState: T) => {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialState,
    pendingActions: [],
    errors: []
  });

  const executeOptimistic = useCallback(async (
    action: OptimisticAction,
    serverAction: () => Promise<void>
  ) => {
    // Appliquer la mise à jour optimiste
    setState(prev => ({
      ...prev,
      data: action.optimisticUpdate(prev.data),
      pendingActions: [...prev.pendingActions, action]
    }));

    try {
      // Exécuter l'action sur le serveur
      await serverAction();
      
      // Succès - retirer l'action des actions en attente
      setState(prev => ({
        ...prev,
        pendingActions: prev.pendingActions.filter(a => a.id !== action.id),
        errors: prev.errors.filter(e => e.actionId !== action.id)
      }));
    } catch (error) {
      // Échec - rollback et ajouter l'erreur
      setState(prev => ({
        ...prev,
        data: action.rollback(prev.data),
        pendingActions: prev.pendingActions.filter(a => a.id !== action.id),
        errors: [...prev.errors.filter(e => e.actionId !== action.id), {
          actionId: action.id,
          error: error as Error
        }]
      }));
    }
  }, []);

  const retryAction = useCallback(async (actionId: string) => {
    const error = state.errors.find(e => e.actionId === actionId);
    if (!error) return;

    // Trouver l'action originale (si elle a une fonction retry)
    const originalAction = state.pendingActions.find(a => a.id === actionId);
    if (originalAction?.retry) {
      setState(prev => ({
        ...prev,
        errors: prev.errors.filter(e => e.actionId !== actionId)
      }));

      try {
        await originalAction.retry();
      } catch (retryError) {
        setState(prev => ({
          ...prev,
          errors: [...prev.errors, { actionId, error: retryError as Error }]
        }));
      }
    }
  }, [state.errors, state.pendingActions]);

  const clearError = useCallback((actionId: string) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(e => e.actionId !== actionId)
    }));
  }, []);

  return {
    data: state.data,
    pendingActions: state.pendingActions,
    errors: state.errors,
    executeOptimistic,
    retryAction,
    clearError,
    isPending: state.pendingActions.length > 0,
    hasErrors: state.errors.length > 0
  };
};

// Composant Error Boundary avec retry
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    retry: () => void;
    retryCount: number;
  }>;
  maxRetries?: number;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

export class ErrorBoundaryWithRetry extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx])) {
        this.resetErrorBoundary();
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prev => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prev.retryCount + 1
      }));

      // Auto-retry après un délai
      this.resetTimeoutId = window.setTimeout(() => {
        if (this.state.hasError) {
          this.setState({ hasError: true });
        }
      }, 1000);
    }
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback: Fallback, maxRetries = 3 } = this.props;

    if (hasError && error) {
      if (Fallback) {
        return <Fallback error={error} retry={this.handleRetry} retryCount={retryCount} />;
      }

      return <DefaultErrorFallback 
        error={error} 
        retry={this.handleRetry} 
        retryCount={retryCount}
        maxRetries={maxRetries}
      />;
    }

    return children;
  }
}

// Composant de fallback par défaut pour les erreurs
const DefaultErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  retryCount: number;
  maxRetries: number;
}> = ({ error, retry, retryCount, maxRetries }) => {
  const { shouldAnimate } = useMotion();

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 20 } : {}}
      animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
      className="flex flex-col items-center justify-center p-8 bg-red-500/10 border border-red-500/20 rounded-lg"
    >
      <XCircle className="w-12 h-12 text-red-400 mb-4" />
      <h3 className="text-lg font-semibold text-red-400 mb-2">
        Une erreur s'est produite
      </h3>
      <p className="text-sm text-slate-400 text-center mb-4 max-w-md">
        {error.message}
      </p>
      
      {retryCount < maxRetries ? (
        <motion.button
          whileHover={shouldAnimate ? { scale: 1.05 } : {}}
          whileTap={shouldAnimate ? { scale: 0.95 } : {}}
          onClick={retry}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Réessayer {retryCount > 0 && `(${retryCount}/${maxRetries})`}
        </motion.button>
      ) : (
        <div className="text-sm text-slate-500">
          Nombre maximum de tentatives atteint
        </div>
      )}
    </motion.div>
  );
};

// Composant pour afficher les actions optimistes en cours
export const OptimisticIndicator: React.FC<{
  pendingActions: OptimisticAction[];
  errors: Array<{ actionId: string; error: Error }>;
  onRetry: (actionId: string) => void;
  onClearError: (actionId: string) => void;
  className?: string;
}> = ({ pendingActions, errors, onRetry, onClearError, className }) => {
  const { shouldAnimate } = useMotion();

  if (pendingActions.length === 0 && errors.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence>
        {/* Actions en cours */}
        {pendingActions.map((action) => (
          <motion.div
            key={action.id}
            initial={shouldAnimate ? { opacity: 0, x: -20 } : {}}
            animate={shouldAnimate ? { opacity: 1, x: 0 } : {}}
            exit={shouldAnimate ? { opacity: 0, x: 20 } : {}}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg"
          >
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-400">
              {action.type} en cours...
            </span>
          </motion.div>
        ))}

        {/* Erreurs */}
        {errors.map(({ actionId, error }) => (
          <motion.div
            key={actionId}
            initial={shouldAnimate ? { opacity: 0, x: -20 } : {}}
            animate={shouldAnimate ? { opacity: 1, x: 0 } : {}}
            exit={shouldAnimate ? { opacity: 0, x: 20 } : {}}
            className="flex items-center justify-between px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">
                {error.message}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRetry(actionId)}
                className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Réessayer
              </button>
              <button
                onClick={() => onClearError(actionId)}
                className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
              >
                Ignorer
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook pour les actions avec retry automatique
export const useRetryableAction = <T,>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<number | undefined>(undefined);

  const execute = useCallback(async (): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await action();
      setRetryCount(0);
      setIsLoading(false);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        
        retryTimeoutRef.current = window.setTimeout(() => {
          execute();
        }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
      } else {
        setIsLoading(false);
      }
      
      return null;
    }
  }, [action, maxRetries, retryDelay, retryCount]);

  const reset = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsLoading(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    execute,
    reset,
    isLoading,
    error,
    retryCount,
    canRetry: retryCount < maxRetries
  };
};

export default ErrorBoundaryWithRetry;