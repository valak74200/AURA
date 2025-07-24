import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useMotion } from '../../contexts/EnhancedThemeContext';

interface ParallaxContainerProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  offset?: number;
  direction?: 'up' | 'down';
}

const ParallaxContainer: React.FC<ParallaxContainerProps> = ({
  children,
  speed = 0.5,
  className = '',
  offset = 0,
  direction = 'up'
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const multiplier = direction === 'up' ? -1 : 1;
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [offset, (offset + 200) * speed * multiplier]
  );

  const smoothY = useSpring(y, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y: smoothY }}
    >
      {children}
    </motion.div>
  );
};

// Composant pour les éléments flottants avec parallax
export const FloatingElement: React.FC<{
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  delay?: number;
}> = ({ children, className = '', intensity = 1, delay = 0 }) => {
  const { shouldAnimate } = useMotion();
  const { scrollY } = useScroll();
  
  const y = useTransform(
    scrollY,
    [0, 1000],
    [0, -100 * intensity]
  );

  const rotate = useTransform(
    scrollY,
    [0, 1000],
    [0, 10 * intensity]
  );

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={{ y, rotate }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.8 }}
    >
      {children}
    </motion.div>
  );
};

// Hook pour les animations basées sur le scroll
export const useScrollAnimation = () => {
  const { shouldAnimate } = useMotion();
  const { scrollYProgress } = useScroll();
  
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.8, 1, 1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  if (!shouldAnimate) {
    return {
      opacity: 1,
      scale: 1,
      y: 0
    };
  }

  return { opacity, scale, y };
};

// Composant pour les sections avec révélation au scroll
export const ScrollReveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  delay?: number;
}> = ({
  children,
  className = '',
  threshold = 0.1,
  direction = 'up',
  distance = 50,
  duration = 0.6,
  delay = 0
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { shouldAnimate } = useMotion();

  useEffect(() => {
    if (!shouldAnimate) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, shouldAnimate]);

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

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={getInitialPosition()}
      animate={isVisible ? getAnimatePosition() : getInitialPosition()}
      transition={{
        duration: shouldAnimate ? duration : 0,
        delay: shouldAnimate ? delay : 0,
        ease: 'easeOut'
      }}
    >
      {children}
    </motion.div>
  );
};

// Composant pour les backgrounds avec parallax
export const ParallaxBackground: React.FC<{
  children?: React.ReactNode;
  className?: string;
  speed?: number;
  image?: string;
}> = ({ children, className = '', speed = 0.5, image }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${speed * 100}%`]);

  const backgroundStyle = image ? {
    backgroundImage: `url(${image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  } : {};

  if (!shouldAnimate) {
    return (
      <div ref={ref} className={className} style={backgroundStyle}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ y, ...backgroundStyle }}
      />
      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}
    </div>
  );
};

// Hook pour les animations de mouse parallax
export const useMouseParallax = (intensity: number = 0.1) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { shouldAnimate } = useMotion();

  useEffect(() => {
    if (!shouldAnimate) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) * intensity;
      const y = (e.clientY - window.innerHeight / 2) * intensity;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [intensity, shouldAnimate]);

  return shouldAnimate ? mousePosition : { x: 0, y: 0 };
};

// Composant pour les éléments qui suivent la souris
export const MouseFollower: React.FC<{
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  smooth?: boolean;
}> = ({ children, className = '', intensity = 0.1, smooth = true }) => {
  const mousePosition = useMouseParallax(intensity);
  const { shouldAnimate } = useMotion();

  const x = smooth ? useSpring(mousePosition.x, { stiffness: 150, damping: 15 }) : mousePosition.x;
  const y = smooth ? useSpring(mousePosition.y, { stiffness: 150, damping: 15 }) : mousePosition.y;

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={{ x, y }}
    >
      {children}
    </motion.div>
  );
};

export default ParallaxContainer;