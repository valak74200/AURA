import React from 'react';
import { clsx } from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'md',
  onClick
}) => {
  const baseClasses = 'rounded-lg border bg-white dark:bg-gray-800 shadow-sm';
  
  const variantClasses = {
    default: 'border-gray-200 dark:border-gray-700',
    elevated: 'border-gray-200 dark:border-gray-700 shadow-lg',
    outlined: 'border-gray-300 dark:border-gray-600 shadow-none',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={clsx(
        baseClasses,
        variantClasses[variant],
        paddingClasses[padding],
        onClick && 'cursor-pointer hover:scale-[1.02] transition-transform',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;