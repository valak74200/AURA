import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import { ButtonProps } from '../../types';
import { motion } from 'framer-motion';

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
  const baseClasses = 'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:from-blue-600 hover:to-purple-700',
    secondary: 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
    ghost: 'bg-transparent text-blue-400 hover:bg-blue-50 hover:text-blue-600',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-12 px-8 text-base',
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={{ scale: 1.04, boxShadow: "0 4px 24px 0 rgba(80,80,255,0.10)" }}
      whileTap={{ scale: 0.97 }}
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
    </motion.button>
  );
};

export default Button;