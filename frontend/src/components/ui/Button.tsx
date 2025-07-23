import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import { ButtonProps } from '../../types';

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled = false,
  loading = false,
  onClick,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
    ghost: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-12 px-8 text-base',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        { 'opacity-50 cursor-not-allowed': isDisabled },
        className
      )}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

export default Button;