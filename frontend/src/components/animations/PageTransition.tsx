import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useMotion } from '../../contexts/EnhancedThemeContext';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1
  },
  out: {
    opacity: 0,
    y: -20,
    scale: 1.02
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.4
};

const slideVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0
  }),
  in: {
    x: 0,
    opacity: 1
  },
  out: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0
  })
};

const scaleVariants = {
  initial: {
    scale: 0.8,
    opacity: 0,
    rotateX: -15
  },
  in: {
    scale: 1,
    opacity: 1,
    rotateX: 0
  },
  out: {
    scale: 1.1,
    opacity: 0,
    rotateX: 15
  }
};

export type TransitionType = 'fade' | 'slide' | 'scale';

interface PageTransitionWrapperProps extends PageTransitionProps {
  type?: TransitionType;
  direction?: number;
}

const PageTransition: React.FC<PageTransitionWrapperProps> = ({
  children,
  className = '',
  type = 'fade',
  direction = 1
}) => {
  const location = useLocation();
  const { shouldAnimate, transition } = useMotion();

  const getVariants = () => {
    switch (type) {
      case 'slide':
        return slideVariants;
      case 'scale':
        return scaleVariants;
      default:
        return pageVariants;
    }
  };

  const getTransition = () => {
    if (!shouldAnimate) return { duration: 0 };
    return transition || pageTransition;
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        custom={direction}
        initial="initial"
        animate="in"
        exit="out"
        variants={getVariants()}
        transition={getTransition()}
        className={className}
        style={{ perspective: 1000 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Hook pour gérer les transitions de pages avec historique
export const usePageTransition = () => {
  const location = useLocation();
  const [direction, setDirection] = React.useState(1);
  const [history, setHistory] = React.useState<string[]>([]);

  React.useEffect(() => {
    setHistory(prev => {
      const newHistory = [...prev, location.pathname];
      if (newHistory.length > 10) {
        newHistory.shift();
      }
      
      // Déterminer la direction basée sur l'historique
      if (prev.length > 0) {
        const lastPath = prev[prev.length - 1];
        const currentIndex = newHistory.indexOf(location.pathname);
        const lastIndex = newHistory.indexOf(lastPath);
        
        if (currentIndex > lastIndex) {
          setDirection(1);
        } else {
          setDirection(-1);
        }
      }
      
      return newHistory;
    });
  }, [location.pathname]);

  return { direction };
};

// Composant pour les transitions de contenu
export const ContentTransition: React.FC<{
  children: React.ReactNode;
  show: boolean;
  className?: string;
}> = ({ children, show, className = '' }) => {
  const { shouldAnimate } = useMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 10 } : {}}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
          exit={shouldAnimate ? { opacity: 0, y: -10 } : {}}
          transition={{ duration: shouldAnimate ? 0.2 : 0 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageTransition;