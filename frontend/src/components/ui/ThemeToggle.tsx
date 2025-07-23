import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, Theme } from '../../contexts/ThemeContext';
import Button from './Button';

interface ThemeToggleProps {
  variant?: 'button' | 'dropdown';
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'button',
  className = '' 
}) => {
  const { theme, setTheme, isDark } = useTheme();

  const themes: { value: Theme; label: string; icon: React.ComponentType<any> }[] = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ];

  if (variant === 'button') {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    const currentIcon = themes.find(t => t.value === theme)?.icon || Sun;
    const IconComponent = currentIcon;

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme(nextTheme)}
        className={`p-2 ${className}`}
        aria-label="Changer de thème"
      >
        <IconComponent className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Thème
      </label>
      <div className="grid grid-cols-1 gap-2">
        {themes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              theme === value
                ? 'bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm">{label}</span>
            {theme === value && (
              <div className="ml-auto w-2 h-2 bg-primary-500 rounded-full" />
            )}
          </button>
        ))}
      </div>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {theme === 'system' 
          ? `Suit les préférences système (${isDark ? 'sombre' : 'clair'})`
          : `Thème ${theme === 'light' ? 'clair' : 'sombre'} appliqué`
        }
      </p>
    </div>
  );
};

export default ThemeToggle;