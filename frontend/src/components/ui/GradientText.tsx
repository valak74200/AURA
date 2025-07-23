import React from 'react';
import { clsx } from 'clsx';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'accent' | 'success' | 'warning';
}

const GradientText: React.FC<GradientTextProps> = ({
  children,
  className,
  variant = 'primary'
}) => {
  const gradientClasses = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600',
    accent: 'bg-gradient-to-r from-purple-500 to-pink-500',
    success: 'bg-gradient-to-r from-green-500 to-emerald-500',
    warning: 'bg-gradient-to-r from-orange-500 to-red-500'
  };

  return (
    <span className={clsx(
      'bg-clip-text text-transparent font-bold',
      gradientClasses[variant],
      className
    )}>
      {children}
    </span>
  );
};

export default GradientText;