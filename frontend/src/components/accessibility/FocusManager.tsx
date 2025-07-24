import React, { useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { cn } from '../../utils/cn';

// Context pour la gestion du focus
interface FocusContextType {
  trapFocus: (element: HTMLElement) => () => void;
  restoreFocus: () => void;
  announceLiveRegion: (message: string, priority?: 'polite' | 'assertive') => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const useFocus = () => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
};

// Provider pour la gestion du focus
export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // Créer la région live pour les annonces
  useEffect(() => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.id = 'live-region';
    document.body.appendChild(liveRegion);
    liveRegionRef.current = liveRegion;

    return () => {
      if (liveRegion.parentNode) {
        liveRegion.parentNode.removeChild(liveRegion);
      }
    };
  }, []);

  const trapFocus = useCallback((element: HTMLElement) => {
    // Sauvegarder l'élément actuellement focalisé
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Obtenir tous les éléments focalisables
    const getFocusableElements = () => {
      return element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Ajouter l'écouteur d'événements
    element.addEventListener('keydown', handleKeyDown);

    // Focaliser le premier élément focalisable
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Retourner la fonction de nettoyage
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, []);

  const announceLiveRegion = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', priority);
      liveRegionRef.current.textContent = message;
      
      // Effacer le message après un délai pour permettre de nouvelles annonces
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  const value: FocusContextType = {
    trapFocus,
    restoreFocus,
    announceLiveRegion
  };

  return (
    <FocusContext.Provider value={value}>
      {children}
    </FocusContext.Provider>
  );
};

// Hook pour la gestion du focus trap
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { trapFocus, restoreFocus } = useFocus();

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const cleanup = trapFocus(containerRef.current);

    return () => {
      cleanup();
      restoreFocus();
    };
  }, [isActive, trapFocus, restoreFocus]);

  return containerRef;
};

// Hook pour la navigation au clavier
export const useKeyboardNavigation = (
  items: any[],
  onSelect: (index: number) => void,
  isActive: boolean = true
) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
          break;
        case 'Home':
          e.preventDefault();
          setSelectedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setSelectedIndex(items.length - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect(selectedIndex);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items.length, selectedIndex, onSelect, isActive]);

  return { selectedIndex, setSelectedIndex };
};

// Composant pour les éléments avec focus visible
export const FocusVisible: React.FC<{
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  [key: string]: any;
}> = ({ children, className, as: Component = 'div', ...props }) => {
  const [isFocusVisible, setIsFocusVisible] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = (e: React.FocusEvent) => {
    setIsFocused(true);
    // Détecter si le focus est visible (navigation au clavier)
    setIsFocusVisible(e.target.matches(':focus-visible'));
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent) => {
    setIsFocused(false);
    setIsFocusVisible(false);
    props.onBlur?.(e);
  };

  return (
    <Component
      {...props}
      className={cn(
        className,
        isFocusVisible && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900',
        'focus:outline-none'
      )}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
    </Component>
  );
};

// Composant pour les régions de contenu avec landmarks
export const Landmark: React.FC<{
  children: React.ReactNode;
  role: 'main' | 'navigation' | 'banner' | 'contentinfo' | 'complementary' | 'region';
  label?: string;
  labelledBy?: string;
  className?: string;
}> = ({ children, role, label, labelledBy, className }) => {
  return (
    <div
      role={role}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={className}
    >
      {children}
    </div>
  );
};

// Hook pour les annonces aux lecteurs d'écran
export const useScreenReader = () => {
  const { announceLiveRegion } = useFocus();

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceLiveRegion(message, priority);
  }, [announceLiveRegion]);

  return { announce };
};

// Composant pour les liens de navigation rapide
export const SkipLinks: React.FC<{
  links: Array<{ href: string; label: string }>;
  className?: string;
}> = ({ links, className }) => {
  return (
    <div className={cn('sr-only focus-within:not-sr-only', className)}>
      {links.map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="absolute top-0 left-0 z-50 px-4 py-2 bg-blue-600 text-white rounded-br-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
};

// Hook pour la détection des préférences d'accessibilité
export const useAccessibilityPreferences = () => {
  const [preferences, setPreferences] = React.useState({
    prefersReducedMotion: false,
    prefersHighContrast: false,
    prefersColorScheme: 'light' as 'light' | 'dark'
  });

  useEffect(() => {
    const updatePreferences = () => {
      setPreferences({
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        prefersHighContrast: window.matchMedia('(prefers-contrast: high)').matches,
        prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      });
    };

    // Mise à jour initiale
    updatePreferences();

    // Écouter les changements
    const mediaQueries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(prefers-color-scheme: dark)')
    ];

    mediaQueries.forEach(mq => mq.addEventListener('change', updatePreferences));

    return () => {
      mediaQueries.forEach(mq => mq.removeEventListener('change', updatePreferences));
    };
  }, []);

  return preferences;
};

// Composant pour les descriptions d'éléments
export const VisuallyHidden: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <span className={cn('sr-only', className)}>
      {children}
    </span>
  );
};

export default FocusProvider;