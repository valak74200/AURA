import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

export interface ToastProps {
  id: string;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  closable?: boolean;
  onClose?: (id: string) => void;
}

export interface ToastNotificationProps extends ToastProps {
  isVisible: boolean;
}

const Toast: React.FC<ToastNotificationProps> = ({
  id,
  title,
  message,
  type = 'info',
  closable = true,
  isVisible,
  onClose,
}) => {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      icon: 'text-emerald-400',
      text: 'text-slate-100',
      accent: 'bg-emerald-500',
    },
    error: {
      bg: 'bg-red-500/10 border-red-500/20',
      icon: 'text-red-400',
      text: 'text-slate-100',
      accent: 'bg-red-500',
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/20',
      icon: 'text-amber-400',
      text: 'text-slate-100',
      accent: 'bg-amber-500',
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/20',
      icon: 'text-blue-400',
      text: 'text-slate-100',
      accent: 'bg-blue-500',
    },
  };

  const Icon = icons[type];
  const colorScheme = colors[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={clsx(
            'relative flex items-start space-x-3 p-4 rounded-xl backdrop-blur-lg border',
            'shadow-lg min-w-[300px] max-w-[500px]',
            colorScheme.bg
          )}
        >
          {/* Accent Bar */}
          <div className={clsx('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', colorScheme.accent)} />
          
          {/* Icon */}
          <div className="flex-shrink-0 pt-0.5">
            <Icon className={clsx('w-5 h-5', colorScheme.icon)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className={clsx('text-sm font-semibold mb-1', colorScheme.text)}>
                {title}
              </h4>
            )}
            <p className={clsx('text-sm', colorScheme.text, !title && 'font-medium')}>
              {message}
            </p>
          </div>

          {/* Close Button */}
          {closable && onClose && (
            <button
              onClick={() => onClose(id)}
              className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-200 transition-colors rounded"
              aria-label="Fermer la notification"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;