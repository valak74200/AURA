import React from 'react';
import { motion } from 'framer-motion';
import { useMotion } from '../../contexts/EnhancedThemeContext';

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  once?: boolean;
}

const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className = '',
  staggerDelay = 0.1,
  direction = 'up',
  distance = 20,
  duration = 0.5,
  once = true
}) => {
  const { shouldAnimate } = useMotion();

  const getInitialPosition = () => {
    if (!shouldAnimate) return {};
    
    switch (direction) {
      case 'up':
        return { y: distance, opacity: 0 };
      case 'down':
        return { y: -distance, opacity: 0 };
      case 'left':
        return { x: distance, opacity: 0 };
      case 'right':
        return { x: -distance, opacity: 0 };
      default:
        return { y: distance, opacity: 0 };
    }
  };

  const getAnimatePosition = () => {
    if (!shouldAnimate) return {};
    return { x: 0, y: 0, opacity: 1 };
  };

  const containerVariants = {
    hidden: { opacity: shouldAnimate ? 0 : 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldAnimate ? staggerDelay : 0,
        delayChildren: shouldAnimate ? 0.1 : 0
      }
    }
  };

  const itemVariants = {
    hidden: getInitialPosition(),
    visible: {
      ...getAnimatePosition(),
      transition: {
        duration: shouldAnimate ? duration : 0,
        ease: 'easeOut' as const
      }
    }
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      viewport={{ once, margin: '-50px' }}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Composant pour les listes avec animations stagger
export const StaggerList: React.FC<{
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}> = ({
  items,
  renderItem,
  className = '',
  itemClassName = '',
  staggerDelay = 0.1,
  direction = 'up'
}) => {
  const { shouldAnimate } = useMotion();

  const containerVariants = {
    hidden: { opacity: shouldAnimate ? 0 : 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldAnimate ? staggerDelay : 0
      }
    }
  };

  const getItemVariants = () => {
    if (!shouldAnimate) {
      return {
        hidden: {},
        visible: {}
      };
    }

    const distance = 30;
    let initial = {};
    
    switch (direction) {
      case 'up':
        initial = { y: distance, opacity: 0 };
        break;
      case 'down':
        initial = { y: -distance, opacity: 0 };
        break;
      case 'left':
        initial = { x: distance, opacity: 0 };
        break;
      case 'right':
        initial = { x: -distance, opacity: 0 };
        break;
    }

    return {
      hidden: initial,
      visible: {
        x: 0,
        y: 0,
        opacity: 1,
        transition: {
          duration: 0.5,
          ease: 'easeOut' as const
        }
      }
    };
  };

  const itemVariants = getItemVariants();

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item, index) => (
        <motion.div
          key={index}
          className={itemClassName}
          variants={itemVariants}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Hook pour les animations en cascade
export const useStaggerAnimation = (itemCount: number, delay: number = 0.1) => {
  const { shouldAnimate } = useMotion();
  
  const containerVariants = {
    hidden: { opacity: shouldAnimate ? 0 : 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldAnimate ? delay : 0,
        delayChildren: shouldAnimate ? 0.1 : 0
      }
    }
  };

  const itemVariants = {
    hidden: shouldAnimate ? { y: 20, opacity: 0 } : {},
    visible: shouldAnimate ? {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut'
      }
    } : {}
  };

  return { containerVariants, itemVariants };
};

// Composant pour les grilles avec animations stagger
export const StaggerGrid: React.FC<{
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  columns?: number;
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
}> = ({
  items,
  renderItem,
  columns = 3,
  className = '',
  itemClassName = '',
  staggerDelay = 0.05
}) => {
  const { shouldAnimate } = useMotion();

  const containerVariants = {
    hidden: { opacity: shouldAnimate ? 0 : 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldAnimate ? staggerDelay : 0
      }
    }
  };

  const itemVariants = {
    hidden: shouldAnimate ? { 
      scale: 0.8, 
      opacity: 0,
      y: 20
    } : {},
    visible: shouldAnimate ? {
      scale: 1,
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut' as const
      }
    } : {}
  };

  const gridClass = `grid grid-cols-1 md:grid-cols-${Math.min(columns, 3)} lg:grid-cols-${columns} gap-6`;

  return (
    <motion.div
      className={`${gridClass} ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      {items.map((item, index) => (
        <motion.div
          key={index}
          className={itemClassName}
          variants={itemVariants}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default StaggerContainer;