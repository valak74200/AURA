import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Palette, 
  Eye, 
  Volume2, 
  Type,
  Settings,
  Check
} from 'lucide-react';
import { useEnhancedTheme, ColorScheme, Theme } from '../../../contexts/EnhancedThemeContext';
import { cn } from '../../../utils/cn';

interface ThemeSelectorProps {
  className?: string;
  compact?: boolean;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className, compact = false }) => {
  const {
    theme,
    colorScheme,
    highContrast,
    reducedMotion,
    fontSize,
    setTheme,
    setColorScheme,
    setHighContrast,
    setReducedMotion,
    setFontSize,
    isDark
  } = useEnhancedTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'theme' | 'colors' | 'accessibility'>('theme');

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Clair', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Sombre', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'Système', icon: <Monitor className="w-4 h-4" /> }
  ];

  const colorOptions: { value: ColorScheme; label: string; color: string }[] = [
    { value: 'blue', label: 'Bleu', color: 'bg-blue-500' },
    { value: 'purple', label: 'Violet', color: 'bg-purple-500' },
    { value: 'green', label: 'Vert', color: 'bg-green-500' },
    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
    { value: 'pink', label: 'Rose', color: 'bg-pink-500' }
  ];

  const fontSizeOptions: { value: 'sm' | 'md' | 'lg'; label: string }[] = [
    { value: 'sm', label: 'Petit' },
    { value: 'md', label: 'Moyen' },
    { value: 'lg', label: 'Grand' }
  ];

  if (compact) {
    return (
      <div className={cn('relative', className)}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 transition-colors"
          aria-label="Paramètres de thème"
        >
          <Settings className="w-5 h-5" />
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 top-full mt-2 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Paramètres d'apparence</h3>
                  
                  {/* Theme Selection */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Thème</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {themeOptions.map((option) => (
                        <motion.button
                          key={option.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setTheme(option.value)}
                          className={cn(
                            'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                            theme === option.value
                              ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                          )}
                        >
                          {option.icon}
                          <span className="text-xs">{option.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Color Scheme */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Couleur d'accent</h4>
                    <div className="flex gap-2">
                      {colorOptions.map((option) => (
                        <motion.button
                          key={option.value}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setColorScheme(option.value)}
                          className={cn(
                            'w-8 h-8 rounded-full border-2 transition-all relative',
                            colorScheme === option.value
                              ? 'border-white scale-110'
                              : 'border-slate-600 hover:border-slate-500'
                          )}
                          title={option.label}
                        >
                          <div className={cn('w-full h-full rounded-full', option.color)} />
                          {colorScheme === option.value && (
                            <Check className="w-3 h-3 text-white absolute inset-0 m-auto" />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Accessibility Options */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-300">Accessibilité</h4>
                    
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Contraste élevé</span>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setHighContrast(!highContrast)}
                        className={cn(
                          'w-10 h-6 rounded-full transition-colors relative',
                          highContrast ? 'bg-blue-500' : 'bg-slate-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: highContrast ? 16 : 2 }}
                          className="w-4 h-4 bg-white rounded-full absolute top-1"
                        />
                      </motion.button>
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="text-sm">Réduire les animations</span>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setReducedMotion(!reducedMotion)}
                        className={cn(
                          'w-10 h-6 rounded-full transition-colors relative',
                          reducedMotion ? 'bg-blue-500' : 'bg-slate-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: reducedMotion ? 16 : 2 }}
                          className="w-4 h-4 bg-white rounded-full absolute top-1"
                        />
                      </motion.button>
                    </label>

                    <div>
                      <span className="text-sm block mb-2">Taille de police</span>
                      <div className="flex gap-1">
                        {fontSizeOptions.map((option) => (
                          <motion.button
                            key={option.value}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFontSize(option.value)}
                            className={cn(
                              'px-3 py-1 text-xs rounded border transition-all',
                              fontSize === option.value
                                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                            )}
                          >
                            {option.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full version for settings page
  return (
    <div className={cn('bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden', className)}>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">Paramètres d'apparence</h2>
        
        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-slate-800/50 rounded-lg p-1">
          {[
            { id: 'theme', label: 'Thème', icon: <Palette className="w-4 h-4" /> },
            { id: 'colors', label: 'Couleurs', icon: <Eye className="w-4 h-4" /> },
            { id: 'accessibility', label: 'Accessibilité', icon: <Volume2 className="w-4 h-4" /> }
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md transition-all flex-1 justify-center',
                activeTab === tab.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              )}
            >
              {tab.icon}
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'theme' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Mode d'affichage</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {themeOptions.map((option) => (
                      <motion.button
                        key={option.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                          'flex flex-col items-center gap-3 p-6 rounded-xl border transition-all',
                          theme === option.value
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        )}
                      >
                        {option.icon}
                        <span className="font-medium">{option.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'colors' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Schéma de couleurs</h3>
                  <div className="grid grid-cols-5 gap-4">
                    {colorOptions.map((option) => (
                      <motion.button
                        key={option.value}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setColorScheme(option.value)}
                        className={cn(
                          'flex flex-col items-center gap-3 p-4 rounded-xl border transition-all',
                          colorScheme === option.value
                            ? 'bg-slate-800/80 border-slate-600 scale-105'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        )}
                      >
                        <div className={cn('w-12 h-12 rounded-full', option.color)} />
                        <span className="text-sm font-medium">{option.label}</span>
                        {colorScheme === option.value && (
                          <Check className="w-4 h-4 text-green-400" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'accessibility' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Options d'accessibilité</h3>
                  
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                      <div>
                        <span className="font-medium">Contraste élevé</span>
                        <p className="text-sm text-slate-400">Améliore la lisibilité avec des contrastes plus marqués</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setHighContrast(!highContrast)}
                        className={cn(
                          'w-12 h-6 rounded-full transition-colors relative',
                          highContrast ? 'bg-blue-500' : 'bg-slate-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: highContrast ? 24 : 2 }}
                          className="w-5 h-5 bg-white rounded-full absolute top-0.5"
                        />
                      </motion.button>
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                      <div>
                        <span className="font-medium">Réduire les animations</span>
                        <p className="text-sm text-slate-400">Limite les mouvements pour réduire les distractions</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setReducedMotion(!reducedMotion)}
                        className={cn(
                          'w-12 h-6 rounded-full transition-colors relative',
                          reducedMotion ? 'bg-blue-500' : 'bg-slate-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: reducedMotion ? 24 : 2 }}
                          className="w-5 h-5 bg-white rounded-full absolute top-0.5"
                        />
                      </motion.button>
                    </label>

                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <span className="font-medium block mb-3">Taille de police</span>
                      <div className="flex gap-2">
                        {fontSizeOptions.map((option) => (
                          <motion.button
                            key={option.value}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFontSize(option.value)}
                            className={cn(
                              'px-4 py-2 rounded-lg border transition-all',
                              fontSize === option.value
                                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                            )}
                          >
                            {option.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ThemeSelector;