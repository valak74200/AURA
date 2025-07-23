import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className,
  hover = true,
  delay = 0,
  direction = 'up'
}) => {
  const directionOffsets = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 }
  };

  return (
    <motion.div
      initial={{ 
        opacity: 0,
        ...directionOffsets[direction]
      }}
      animate={{ 
        opacity: 1,
        x: 0,
        y: 0
      }}
      transition={{ 
        duration: 0.5,
        delay,
        ease: [0.21, 1.11, 0.81, 0.99]
      }}
      whileHover={hover ? { 
        y: -4,
        scale: 1.02,
        transition: { duration: 0.2 }
      } : undefined}
      className={clsx(
        'rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm p-6 shadow-lg',
        'hover:shadow-xl hover:shadow-slate-900/20 transition-all duration-200',
        'glass',
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedCard;