import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>((
  {
    label,
    error,
    helperText,
    variant = 'default',
    size = 'md',
    leftIcon,
    rightIcon,
    className,
    disabled,
    ...props
  },
  ref
) => {
  const baseClasses = 'flex w-full rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';
  
  const variantClasses = {
    default: 'border-gray-300 dark:border-gray-600',
    filled: 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700',
    outlined: 'border-gray-400 dark:border-gray-500',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base',
  };

  const hasError = !!error;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        
        <input
          ref={ref}
          className={clsx(
            baseClasses,
            variantClasses[variant],
            sizeClasses[size],
            {
              'border-red-500 focus:border-red-500 focus:ring-red-500': hasError,
              'pl-10': leftIcon,
              'pr-10': rightIcon,
              'opacity-50 cursor-not-allowed': disabled,
            },
            className
          )}
          disabled={disabled}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;