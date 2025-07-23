import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export interface ModernButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  glow?: boolean;
}

const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  glow = false,
  children,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = clsx(
    'relative inline-flex items-center justify-center font-semibold rounded-xl',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    {
      'w-full': fullWidth,
      'animate-glow': glow && !disabled && !loading,
    }
  );

  const variantClasses = {
    primary: clsx(
      'bg-gradient-to-r from-blue-500 to-purple-600',
      'text-white shadow-lg',
      'hover:from-blue-600 hover:to-purple-700',
      'hover:shadow-xl hover:shadow-blue-500/20',
      'focus:ring-blue-500'
    ),
    secondary: clsx(
      'bg-slate-800 border border-slate-600',
      'text-slate-200',
      'hover:bg-slate-700 hover:border-slate-500',
      'focus:ring-slate-500'
    ),
    outline: clsx(
      'border border-slate-600 bg-transparent',
      'text-slate-300',
      'hover:bg-slate-800/50 hover:border-slate-500',
      'focus:ring-slate-500'
    ),
    ghost: clsx(
      'text-slate-300',
      'hover:bg-slate-800/50',
      'focus:ring-slate-500'
    ),
    danger: clsx(
      'bg-gradient-to-r from-red-500 to-red-600',
      'text-white shadow-lg',
      'hover:from-red-600 hover:to-red-700',
      'hover:shadow-xl hover:shadow-red-500/20',
      'focus:ring-red-500'
    ),
    success: clsx(
      'bg-gradient-to-r from-emerald-500 to-emerald-600',
      'text-white shadow-lg',
      'hover:from-emerald-600 hover:to-emerald-700',
      'hover:shadow-xl hover:shadow-emerald-500/20',
      'focus:ring-emerald-500'
    ),
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm gap-2',
    md: 'px-6 py-3 text-base gap-2',
    lg: 'px-8 py-4 text-lg gap-3',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={clsx(
        baseClasses,
        variantClasses[variant as keyof typeof variantClasses],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...(props as any)}
    >
      {loading && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}
      
      {!loading && icon && iconPosition === 'left' && (
        <span className="shrink-0">{icon}</span>
      )}
      
      {children}
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
    </motion.button>
  );
};

export default ModernButton;