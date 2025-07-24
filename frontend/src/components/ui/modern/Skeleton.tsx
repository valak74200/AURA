import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../utils/cn';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  lines?: number;
  children?: React.ReactNode;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'wave',
  lines = 1,
  children,
  ...props
}) => {
  const baseClasses = 'bg-slate-700/50 dark:bg-slate-800/50';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full aspect-square',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton',
    none: ''
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              baseClasses,
              variantClasses[variant],
              animationClasses[animation],
              index === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
            )}
            style={style}
            {...props}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Composants spécialisés pour différents cas d'usage
export const SkeletonText: React.FC<Omit<SkeletonProps, 'variant'>> = (props) => (
  <Skeleton variant="text" {...props} />
);

export const SkeletonCircle: React.FC<Omit<SkeletonProps, 'variant'>> = (props) => (
  <Skeleton variant="circular" {...props} />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-6 space-y-4', className)}>
    <div className="flex items-center space-x-4">
      <SkeletonCircle width={40} height={40} />
      <div className="space-y-2 flex-1">
        <SkeletonText width="60%" />
        <SkeletonText width="40%" />
      </div>
    </div>
    <SkeletonText lines={3} />
    <div className="flex space-x-2">
      <Skeleton width={80} height={32} variant="rounded" />
      <Skeleton width={80} height={32} variant="rounded" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ 
  rows?: number; 
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className }) => (
  <div className={cn('space-y-3', className)}>
    {/* Header */}
    <div className="flex space-x-4">
      {Array.from({ length: columns }).map((_, index) => (
        <SkeletonText key={`header-${index}`} width="100%" height={20} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <motion.div
        key={`row-${rowIndex}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rowIndex * 0.1 }}
        className="flex space-x-4"
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <SkeletonText key={`cell-${rowIndex}-${colIndex}`} width="100%" />
        ))}
      </motion.div>
    ))}
  </div>
);

export const SkeletonDashboard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-6', className)}>
    {/* Header */}
    <div className="flex justify-between items-center">
      <SkeletonText width={200} height={32} />
      <div className="flex space-x-2">
        <Skeleton width={100} height={36} variant="rounded" />
        <Skeleton width={100} height={36} variant="rounded" />
      </div>
    </div>
    
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <motion.div
          key={`stat-${index}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="p-6 bg-slate-800/50 rounded-lg space-y-3"
        >
          <div className="flex items-center justify-between">
            <SkeletonText width={80} />
            <SkeletonCircle width={24} height={24} />
          </div>
          <SkeletonText width={120} height={28} />
          <SkeletonText width={60} />
        </motion.div>
      ))}
    </div>
    
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-6 bg-slate-800/50 rounded-lg space-y-4">
        <SkeletonText width={150} height={24} />
        <Skeleton height={200} variant="rounded" />
      </div>
      <div className="p-6 bg-slate-800/50 rounded-lg space-y-4">
        <SkeletonText width={150} height={24} />
        <Skeleton height={200} variant="rounded" />
      </div>
    </div>
  </div>
);

export const SkeletonList: React.FC<{ 
  items?: number;
  showAvatar?: boolean;
  className?: string;
}> = ({ items = 5, showAvatar = true, className }) => (
  <div className={cn('space-y-4', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <motion.div
        key={`list-item-${index}`}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className="flex items-center space-x-4 p-4 bg-slate-800/30 rounded-lg"
      >
        {showAvatar && <SkeletonCircle width={48} height={48} />}
        <div className="flex-1 space-y-2">
          <SkeletonText width="70%" />
          <SkeletonText width="50%" />
        </div>
        <div className="flex space-x-2">
          <Skeleton width={24} height={24} variant="rounded" />
          <Skeleton width={24} height={24} variant="rounded" />
        </div>
      </motion.div>
    ))}
  </div>
);

export const SkeletonProfile: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-6', className)}>
    {/* Profile Header */}
    <div className="flex items-center space-x-6">
      <SkeletonCircle width={120} height={120} />
      <div className="space-y-3 flex-1">
        <SkeletonText width={200} height={32} />
        <SkeletonText width={150} />
        <div className="flex space-x-2">
          <Skeleton width={100} height={36} variant="rounded" />
          <Skeleton width={100} height={36} variant="rounded" />
        </div>
      </div>
    </div>
    
    {/* Profile Content */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="p-6 bg-slate-800/50 rounded-lg space-y-4">
          <SkeletonText width={150} height={24} />
          <SkeletonText lines={4} />
        </div>
        <div className="p-6 bg-slate-800/50 rounded-lg space-y-4">
          <SkeletonText width={120} height={24} />
          <SkeletonList items={3} showAvatar={false} />
        </div>
      </div>
      <div className="space-y-6">
        <div className="p-6 bg-slate-800/50 rounded-lg space-y-4">
          <SkeletonText width={100} height={24} />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex justify-between">
                <SkeletonText width={80} />
                <SkeletonText width={60} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default Skeleton;