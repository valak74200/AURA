import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface ModernProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
  barClassName?: string;
}

const ModernProgress: React.FC<ModernProgressProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  animated = true,
  className,
  barClassName,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  const variantClasses = {
    default: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    gradient: 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500',
  };

  return (
    <div className={clsx('w-full', className)}>
      {/* Label */}
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-300">
            {label || 'Progression'}
          </span>
          <span className="text-sm text-slate-400">
            {Math.round(percentage)}%
          </span>
        </div>
      )}

      {/* Progress Bar Container */}
      <div className={clsx(
        'w-full bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm',
        sizeClasses[size]
      )}>
        {/* Progress Bar */}
        <motion.div
          className={clsx(
            'h-full rounded-full relative overflow-hidden',
            variantClasses[variant],
            barClassName
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ 
            duration: animated ? 0.8 : 0,
            ease: 'easeOut'
          }}
        >
          {/* Shimmer Effect */}
          {animated && percentage > 0 && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </motion.div>
      </div>

      {/* Additional Info */}
      {value !== percentage && (
        <div className="mt-1 text-xs text-slate-500">
          {value} / {max}
        </div>
      )}
    </div>
  );
};

export default ModernProgress;