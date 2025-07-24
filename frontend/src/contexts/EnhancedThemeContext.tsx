import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'blue' | 'purple' | 'green' | 'orange' | 'pink';

interface ThemeConfig {
  theme: Theme;
  colorScheme: ColorScheme;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'sm' | 'md' | 'lg';
}

interface ThemeContextType extends ThemeConfig {
  setTheme: (theme: Theme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setFontSize: (size: 'sm' | 'md' | 'lg') => void;
  isDark: boolean;
  isTransitioning: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultConfig: ThemeConfig = {
  theme: 'system',
  colorScheme: 'blue',
  highContrast: false,
  reducedMotion: false,
  fontSize: 'md'
};

export const EnhancedThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ThemeConfig>(defaultConfig);
  const [isDark, setIsDark] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Detect system theme preference
  const getSystemTheme = useCallback((): boolean => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);

  // Detect system preferences
  const getSystemPreferences = useCallback(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    return {
      reducedMotion: prefersReducedMotion,
      highContrast: prefersHighContrast
    };
  }, []);

  // Apply theme with smooth transition
  const applyTheme = useCallback(async (newConfig: ThemeConfig) => {
    const root = document.documentElement;
    const systemIsDark = getSystemTheme();
    
    let shouldBeDark: boolean;
    
    switch (newConfig.theme) {
      case 'dark':
        shouldBeDark = true;
        break;
      case 'light':
        shouldBeDark = false;
        break;
      case 'system':
      default:
        shouldBeDark = systemIsDark;
        break;
    }

    // Start transition
    setIsTransitioning(true);
    
    // Apply theme classes with transition
    root.style.setProperty('--theme-transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)');
    
    // Apply dark/light mode
    if (shouldBeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply color scheme
    root.setAttribute('data-color-scheme', newConfig.colorScheme);
    
    // Apply accessibility settings
    root.classList.toggle('high-contrast', newConfig.highContrast);
    root.classList.toggle('reduced-motion', newConfig.reducedMotion);
    root.setAttribute('data-font-size', newConfig.fontSize);

    // Update CSS custom properties for color scheme
    const colorSchemes = {
      blue: { primary: '59 130 246', accent: '168 85 247' },
      purple: { primary: '147 51 234', accent: '236 72 153' },
      green: { primary: '34 197 94', accent: '59 130 246' },
      orange: { primary: '249 115 22', accent: '168 85 247' },
      pink: { primary: '236 72 153', accent: '147 51 234' }
    };

    const colors = colorSchemes[newConfig.colorScheme];
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--accent', colors.accent);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', shouldBeDark ? '#0f172a' : '#ffffff');
    }

    setIsDark(shouldBeDark);
    
    // End transition after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
      root.style.removeProperty('--theme-transition');
    }, 300);
  }, [getSystemTheme]);

  // Theme setters with persistence
  const setTheme = useCallback((theme: Theme) => {
    const newConfig = { ...config, theme };
    setConfig(newConfig);
    localStorage.setItem('aura_theme_config', JSON.stringify(newConfig));
    applyTheme(newConfig);
  }, [config, applyTheme]);

  const setColorScheme = useCallback((colorScheme: ColorScheme) => {
    const newConfig = { ...config, colorScheme };
    setConfig(newConfig);
    localStorage.setItem('aura_theme_config', JSON.stringify(newConfig));
    applyTheme(newConfig);
  }, [config, applyTheme]);

  const setHighContrast = useCallback((highContrast: boolean) => {
    const newConfig = { ...config, highContrast };
    setConfig(newConfig);
    localStorage.setItem('aura_theme_config', JSON.stringify(newConfig));
    applyTheme(newConfig);
  }, [config, applyTheme]);

  const setReducedMotion = useCallback((reducedMotion: boolean) => {
    const newConfig = { ...config, reducedMotion };
    setConfig(newConfig);
    localStorage.setItem('aura_theme_config', JSON.stringify(newConfig));
    applyTheme(newConfig);
  }, [config, applyTheme]);

  const setFontSize = useCallback((fontSize: 'sm' | 'md' | 'lg') => {
    const newConfig = { ...config, fontSize };
    setConfig(newConfig);
    localStorage.setItem('aura_theme_config', JSON.stringify(newConfig));
    applyTheme(newConfig);
  }, [config, applyTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = config.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [config.theme, setTheme]);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedConfig = localStorage.getItem('aura_theme_config');
    const systemPrefs = getSystemPreferences();
    
    let initialConfig: ThemeConfig;
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        initialConfig = { ...defaultConfig, ...parsed };
      } catch {
        initialConfig = { ...defaultConfig, ...systemPrefs };
      }
    } else {
      initialConfig = { ...defaultConfig, ...systemPrefs };
    }
    
    setConfig(initialConfig);
    applyTheme(initialConfig);
  }, [applyTheme, getSystemPreferences]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleThemeChange = () => {
      if (config.theme === 'system') {
        applyTheme(config);
      }
    };

    const handleMotionChange = () => {
      const newConfig = { ...config, reducedMotion: motionQuery.matches };
      setConfig(newConfig);
      applyTheme(newConfig);
    };

    const handleContrastChange = () => {
      const newConfig = { ...config, highContrast: contrastQuery.matches };
      setConfig(newConfig);
      applyTheme(newConfig);
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, [config, applyTheme]);

  const contextValue: ThemeContextType = {
    ...config,
    isDark,
    isTransitioning,
    setTheme,
    setColorScheme,
    setHighContrast,
    setReducedMotion,
    setFontSize,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] pointer-events-none"
            style={{
              background: `linear-gradient(45deg, 
                ${isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)'} 0%, 
                ${isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(248, 250, 252, 0.6)'} 100%)`
            }}
          />
        )}
      </AnimatePresence>
      {children}
    </ThemeContext.Provider>
  );
};

export const useEnhancedTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useEnhancedTheme must be used within an EnhancedThemeProvider');
  }
  return context;
};

// Hook pour les animations conditionnelles basées sur les préférences
export const useMotion = () => {
  const { reducedMotion } = useEnhancedTheme();
  
  return {
    shouldAnimate: !reducedMotion,
    transition: reducedMotion ? { duration: 0 } : undefined,
    variants: {
      initial: reducedMotion ? {} : { opacity: 0, y: 20 },
      animate: reducedMotion ? {} : { opacity: 1, y: 0 },
      exit: reducedMotion ? {} : { opacity: 0, y: -20 }
    }
  };
};