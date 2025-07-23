import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface ModernBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  pulse?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

const ModernBadge: React.FC<ModernBadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  pulse = false,
  glow = false,
  onClick,
}) => {
  const baseClasses = clsx(
    'inline-flex items-center justify-center font-medium rounded-full',
    'transition-all duration-200 ease-in-out',
    {
      'cursor-pointer hover:scale-105': onClick,
      'animate-pulse': pulse,
      'animate-glow': glow,
    }
  );

  const variantClasses = {
    default: 'bg-slate-800 text-slate-200 border border-slate-600',
    primary: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    danger: 'bg-red-500/20 text-red-300 border border-red-500/30',
    error: 'bg-red-500/20 text-red-300 border border-red-500/30',
    info: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={onClick ? { scale: 1.05 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      className={clsx(
        baseClasses,
        variantClasses[variant as keyof typeof variantClasses],
        sizeClasses[size],
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.span>
  );
};

export default ModernBadge;