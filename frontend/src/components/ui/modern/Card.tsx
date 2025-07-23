import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface ModernCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  glass?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const ModernCard: React.FC<ModernCardProps> = ({
  children,
  className,
  hover = true,
  glow = false,
  glass = false,
  padding = 'md',
  onClick,
}) => {
  const baseClasses = clsx(
    'rounded-xl border transition-all duration-300',
    {
      'cursor-pointer': onClick,
      'glass': glass,
      'card-modern': !glass,
      'animate-glow': glow,
    }
  );

  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: hover ? { y: -4, scale: 1.02 } : {},
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      className={clsx(
        baseClasses,
        paddingClasses[padding],
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};

export default ModernCard;