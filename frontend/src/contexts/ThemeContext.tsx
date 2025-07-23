import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  // Detect system theme preference
  const getSystemTheme = (): boolean => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // Apply theme to document
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    const systemIsDark = getSystemTheme();
    
    let shouldBeDark: boolean;
    
    switch (theme) {
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

    setIsDark(shouldBeDark);

    if (shouldBeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', shouldBeDark ? '#1f2937' : '#ffffff');
    }
  };

  // Set theme and persist to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('aura_theme', newTheme);
    applyTheme(newTheme);
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('aura_theme') as Theme;
    const initialTheme = savedTheme && ['light', 'dark', 'system'].includes(savedTheme) 
      ? savedTheme 
      : 'system';
    
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};