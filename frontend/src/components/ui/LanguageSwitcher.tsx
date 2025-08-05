import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Globe, 
  ChevronDown, 
  Check,
  Languages
} from 'lucide-react';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  size = 'md',
  showFlag = true,
  showNativeName = true,
  className = '',
  position = 'bottom-right'
}) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: Language[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸'
    },
    {
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      flag: '🇫🇷'
    }
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setIsOpen(false);
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-sm px-2 py-1';
      case 'lg':
        return 'text-lg px-4 py-3';
      default:
        return 'text-base px-3 py-2';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  };

  const getDropdownPosition = () => {
    switch (position) {
      case 'top-left':
        return 'bottom-full left-0 mb-2';
      case 'top-right':
        return 'bottom-full right-0 mb-2';
      case 'bottom-left':
        return 'top-full left-0 mt-2';
      default:
        return 'top-full right-0 mt-2';
    }
  };

  // Compact variant - just flags/icons
  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400 ${getSizeClasses()}`}
          aria-label={t('language.switch')}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {showFlag ? (
            <span className="text-lg">{currentLanguage.flag}</span>
          ) : (
            <Globe className={`${getIconSize()} text-gray-400`} />
          )}
          <ChevronDown className={`${getIconSize()} text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`absolute z-50 ${getDropdownPosition()} min-w-48 bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-xl shadow-glass overflow-hidden`}
              role="listbox"
              aria-label={t('language.switch')}
            >
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-glass-200 focus:outline-none focus:bg-glass-200 ${
                    currentLanguage.code === language.code ? 'bg-primary-500/20 text-primary-400' : 'text-white'
                  }`}
                  role="option"
                  aria-selected={currentLanguage.code === language.code}
                >
                  <span className="text-lg">{language.flag}</span>
                  <div className="flex-1">
                    <div className="font-medium">{language.name}</div>
                    {showNativeName && language.name !== language.nativeName && (
                      <div className="text-sm text-gray-400">{language.nativeName}</div>
                    )}
                  </div>
                  {currentLanguage.code === language.code && (
                    <Check className="w-4 h-4 text-primary-400" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full variant - toggle buttons
  if (variant === 'full') {
    return (
      <div className={`flex bg-gray-800/50 rounded-xl p-1 ${className}`}>
        {languages.map((language) => (
          <button
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              currentLanguage.code === language.code
                ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-glass-300'
            }`}
            aria-pressed={currentLanguage.code === language.code}
          >
            {showFlag && <span className="text-lg">{language.flag}</span>}
            <span>{showNativeName ? language.nativeName : language.name}</span>
          </button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400 ${getSizeClasses()}`}
        aria-label={t('language.switch')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {showFlag ? (
          <span className="text-lg">{currentLanguage.flag}</span>
        ) : (
          <Languages className={`${getIconSize()} text-gray-400`} />
        )}
        
        <div className="flex flex-col items-start">
          <span className="text-white font-medium">
            {showNativeName ? currentLanguage.nativeName : currentLanguage.name}
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-gray-400">
              {t('language.current')}
            </span>
          )}
        </div>
        
        <ChevronDown className={`${getIconSize()} text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 ${getDropdownPosition()} min-w-full bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-xl shadow-glass overflow-hidden`}
            role="listbox"
            aria-label={t('language.switch')}
          >
            <div className="p-2">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 py-2">
                {t('language.switch')}
              </div>
              
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 hover:bg-glass-200 focus:outline-none focus:bg-glass-200 ${
                    currentLanguage.code === language.code ? 'bg-primary-500/20 text-primary-400' : 'text-white'
                  }`}
                  role="option"
                  aria-selected={currentLanguage.code === language.code}
                >
                  <span className="text-lg">{language.flag}</span>
                  <div className="flex-1">
                    <div className="font-medium">{language.name}</div>
                    {showNativeName && language.name !== language.nativeName && (
                      <div className="text-sm text-gray-400">{language.nativeName}</div>
                    )}
                  </div>
                  {currentLanguage.code === language.code && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="p-1"
                    >
                      <Check className="w-4 h-4 text-primary-400" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;