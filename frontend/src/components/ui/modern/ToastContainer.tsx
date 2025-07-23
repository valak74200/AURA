import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import Toast, { ToastProps } from './Toast';

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastWithVisibility extends ToastProps {
  isVisible: boolean;
}

interface ToastProviderProps {
  children: ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = 'top-right',
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = useState<ToastWithVisibility[]>([]);

  const showToast = useCallback((toastData: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const duration = toastData.duration || 5000;
    
    const newToast: ToastWithVisibility = {
      ...toastData,
      id,
      isVisible: true,
    };

    setToasts(prev => {
      const updated = [newToast, ...prev].slice(0, maxToasts);
      return updated;
    });

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, isVisible: false } : toast
    ));

    // Remove from array after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts(prev => prev.map(toast => ({ ...toast, isVisible: false })));
    setTimeout(() => {
      setToasts([]);
    }, 300);
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-6 right-6';
      case 'top-left':
        return 'top-6 left-6';
      case 'bottom-right':
        return 'bottom-6 right-6';
      case 'bottom-left':
        return 'bottom-6 left-6';
      case 'top-center':
        return 'top-6 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-6 right-6';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, removeToast, clearAllToasts }}>
      {children}
      {createPortal(
        <div className={`fixed z-50 ${getPositionClasses()}`}>
          <div className="flex flex-col space-y-2">
            <AnimatePresence>
              {toasts.map((toast) => (
                <Toast
                  key={toast.id}
                  {...toast}
                  onClose={removeToast}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastProvider;