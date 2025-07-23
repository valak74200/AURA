import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface ModernInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const ModernInput = forwardRef<HTMLInputElement, ModernInputProps>(({
  label,
  error,
  helperText,
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = true,
  className,
  disabled,
  ...props
}, ref) => {
  const baseClasses = clsx(
    'relative flex items-center rounded-xl border transition-all duration-200',
    'bg-slate-900/50 backdrop-blur-sm',
    'text-slate-100 placeholder:text-slate-400',
    'focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500',
    {
      'w-full': fullWidth,
      'border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20': error,
      'border-slate-600': !error,
      'opacity-50 cursor-not-allowed': disabled,
    }
  );

  const inputClasses = clsx(
    'flex-1 bg-transparent border-none outline-none',
    {
      'pl-4': !leftIcon,
      'pl-12': leftIcon,
      'pr-4': !rightIcon,
      'pr-12': rightIcon,
    }
  );

  const sizeClasses = {
    sm: 'h-10 text-sm',
    md: 'h-12 text-base',
    lg: 'h-14 text-lg',
  };

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <motion.label
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="block text-sm font-medium text-slate-200 mb-2"
        >
          {label}
        </motion.label>
      )}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={clsx(baseClasses, sizeClasses[size], className)}
      >
        {leftIcon && (
          <div className="absolute left-4 text-slate-400">
            {leftIcon}
          </div>
        )}
        
        <input
          ref={ref}
          className={inputClasses}
          disabled={disabled}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-4 text-slate-400">
            {rightIcon}
          </div>
        )}
      </motion.div>
      
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-400 mt-1"
        >
          {error}
        </motion.p>
      )}
      
      {helperText && !error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-slate-400 mt-1"
        >
          {helperText}
        </motion.p>
      )}
    </div>
  );
});

ModernInput.displayName = 'ModernInput';

export default ModernInput;