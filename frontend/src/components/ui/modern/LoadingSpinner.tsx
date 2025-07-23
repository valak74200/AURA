import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface ModernLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse' | 'bars';
  className?: string;
}

const ModernLoadingSpinner: React.FC<ModernLoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  if (variant === 'dots') {
    return (
      <div className={clsx('flex space-x-1', className)}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={clsx(
              'bg-blue-500 rounded-full',
              size === 'sm' ? 'w-1 h-1' : size === 'md' ? 'w-2 h-2' : size === 'lg' ? 'w-3 h-3' : 'w-4 h-4'
            )}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <motion.div
        className={clsx(
          'bg-gradient-to-r from-blue-500 to-purple-600 rounded-full',
          sizeClasses[size],
          className
        )}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
        }}
      />
    );
  }

  if (variant === 'bars') {
    return (
      <div className={clsx('flex space-x-1 items-end', className)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className={clsx(
              'bg-gradient-to-t from-blue-500 to-purple-600 rounded-sm',
              size === 'sm' ? 'w-1' : size === 'md' ? 'w-1.5' : size === 'lg' ? 'w-2' : 'w-3'
            )}
            style={{
              height: size === 'sm' ? '16px' : size === 'md' ? '24px' : size === 'lg' ? '32px' : '48px',
            }}
            animate={{
              scaleY: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    );
  }

  // Default spinner
  return (
    <motion.div
      className={clsx(
        'border-2 border-slate-600 border-t-blue-500 rounded-full',
        sizeClasses[size],
        className
      )}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
};

export default ModernLoadingSpinner;