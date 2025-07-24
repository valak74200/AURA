import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useMotion } from '../../../contexts/EnhancedThemeContext';

export interface FABAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

interface FloatingActionButtonProps {
  actions?: FABAction[];
  mainAction?: () => void;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  tooltip?: string;
  disabled?: boolean;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  actions = [],
  mainAction,
  className,
  position = 'bottom-right',
  size = 'md',
  color = 'primary',
  tooltip,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { shouldAnimate } = useMotion();

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  };

  const colorClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-slate-600 hover:bg-slate-700 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    warning: 'bg-orange-500 hover:bg-orange-600 text-white',
    error: 'bg-red-500 hover:bg-red-600 text-white'
  };

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  const getActionPosition = (index: number) => {
    const distance = 70;
    const baseOffset = distance * (index + 1);
    
    switch (position) {
      case 'bottom-right':
      case 'bottom-left':
        return { bottom: baseOffset };
      case 'top-right':
      case 'top-left':
        return { top: baseOffset };
      default:
        return { bottom: baseOffset };
    }
  };

  const handleMainClick = () => {
    if (actions.length > 0) {
      setIsOpen(!isOpen);
    } else if (mainAction) {
      mainAction();
    }
  };

  const fabVariants = {
    initial: { scale: 0, rotate: -180 },
    animate: {
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 260,
        damping: 20
      }
    },
    exit: {
      scale: 0,
      rotate: 180,
      transition: {
        duration: 0.2
      }
    }
  };

  const actionVariants = {
    initial: {
      scale: 0,
      opacity: 0,
      y: position.includes('bottom') ? 20 : -20
    },
    animate: (index: number) => ({
      scale: 1,
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.1,
        type: 'spring' as const,
        stiffness: 300,
        damping: 25
      }
    }),
    exit: {
      scale: 0,
      opacity: 0,
      y: position.includes('bottom') ? 20 : -20,
      transition: {
        duration: 0.15
      }
    }
  };

  const rotateVariants = {
    closed: { rotate: 0 },
    open: { rotate: 45 }
  };

  return (
    <div className={cn('fixed z-50', positionClasses[position], className)}>
      {/* Actions */}
      <AnimatePresence>
        {isOpen && actions.map((action, index) => (
          <motion.div
            key={action.id}
            custom={index}
            variants={shouldAnimate ? actionVariants : {}}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute"
            style={getActionPosition(index)}
          >
            <div className="relative group">
              <motion.button
                whileHover={shouldAnimate ? { scale: 1.1 } : {}}
                whileTap={shouldAnimate ? { scale: 0.95 } : {}}
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  'w-12 h-12 rounded-full shadow-lg transition-all duration-200',
                  'flex items-center justify-center',
                  'backdrop-blur-sm border border-white/10',
                  action.color || 'bg-slate-700 hover:bg-slate-600 text-white',
                  action.disabled && 'opacity-50 cursor-not-allowed'
                )}
                aria-label={action.label}
              >
                {action.icon}
              </motion.button>
              
              {/* Action Tooltip */}
              <div className={cn(
                'absolute whitespace-nowrap px-3 py-2 bg-slate-900 text-white text-sm rounded-lg',
                'opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none',
                position.includes('right') ? 'right-full mr-3' : 'left-full ml-3',
                'top-1/2 -translate-y-1/2'
              )}>
                {action.label}
                <div className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45',
                  position.includes('right') ? '-right-1' : '-left-1'
                )} />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Main FAB */}
      <div className="relative">
        <motion.button
          variants={shouldAnimate ? fabVariants : {}}
          initial="initial"
          animate="animate"
          whileHover={shouldAnimate ? { scale: 1.05 } : {}}
          whileTap={shouldAnimate ? { scale: 0.95 } : {}}
          onClick={handleMainClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          disabled={disabled}
          className={cn(
            sizeClasses[size],
            colorClasses[color],
            'rounded-full shadow-xl transition-all duration-200',
            'flex items-center justify-center',
            'backdrop-blur-sm border border-white/10',
            'focus:outline-none focus:ring-4 focus:ring-blue-500/30',
            disabled && 'opacity-50 cursor-not-allowed',
            'group'
          )}
          aria-label={tooltip || 'Actions'}
          aria-expanded={isOpen}
        >
          <motion.div
            variants={shouldAnimate ? rotateVariants : {}}
            animate={isOpen ? 'open' : 'closed'}
            className={iconSizes[size]}
          >
            {actions.length > 0 ? (
              isOpen ? <X className={iconSizes[size]} /> : <Plus className={iconSizes[size]} />
            ) : (
              <Plus className={iconSizes[size]} />
            )}
          </motion.div>
        </motion.button>

        {/* Main Tooltip */}
        {tooltip && (
          <AnimatePresence>
            {showTooltip && !isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  'absolute whitespace-nowrap px-3 py-2 bg-slate-900 text-white text-sm rounded-lg',
                  'pointer-events-none z-10',
                  position.includes('right') ? 'right-full mr-3' : 'left-full ml-3',
                  'top-1/2 -translate-y-1/2'
                )}
              >
                {tooltip}
                <div className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45',
                  position.includes('right') ? '-right-1' : '-left-1'
                )} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 -z-10"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingActionButton;