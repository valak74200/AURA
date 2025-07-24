import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Command, 
  ArrowRight, 
  Clock, 
  Star, 
  Hash,
  User,
  Settings,
  FileText,
  BarChart3,
  Mic
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useMotion } from '../../../contexts/EnhancedThemeContext';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  category?: string;
  keywords?: string[];
  action: () => void;
  shortcut?: string[];
  recent?: boolean;
  favorite?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  className?: string;
  maxResults?: number;
  showCategories?: boolean;
  showRecent?: boolean;
  recentItems?: CommandItem[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
  placeholder = 'Tapez une commande ou recherchez...',
  className,
  maxResults = 8,
  showCategories = true,
  showRecent = true,
  recentItems = []
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { shouldAnimate } = useMotion();

  // Filtrer et trier les éléments
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return showRecent && recentItems.length > 0 
        ? recentItems.slice(0, maxResults)
        : items.slice(0, maxResults);
    }

    const searchQuery = query.toLowerCase();
    const filtered = items.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(searchQuery);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(searchQuery);
      const keywordMatch = item.keywords?.some(keyword => 
        keyword.toLowerCase().includes(searchQuery)
      );
      const categoryMatch = item.category?.toLowerCase().includes(searchQuery);
      
      return titleMatch || subtitleMatch || keywordMatch || categoryMatch;
    });

    // Trier par pertinence
    return filtered
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aStartsWith = aTitle.startsWith(searchQuery);
        const bStartsWith = bTitle.startsWith(searchQuery);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return aTitle.localeCompare(bTitle);
      })
      .slice(0, maxResults);
  }, [query, items, recentItems, maxResults, showRecent]);

  // Grouper par catégorie si activé
  const groupedItems = useMemo(() => {
    if (!showCategories) return { '': filteredItems };
    
    return filteredItems.reduce((groups, item) => {
      const category = item.category || 'Général';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {} as Record<string, CommandItem[]>);
  }, [filteredItems, showCategories]);

  // Réinitialiser la sélection quand les résultats changent
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Focus sur l'input quand ouvert
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Gestion du clavier
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredItems.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredItems.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Navigation': <ArrowRight className="w-4 h-4" />,
      'Utilisateur': <User className="w-4 h-4" />,
      'Paramètres': <Settings className="w-4 h-4" />,
      'Documents': <FileText className="w-4 h-4" />,
      'Analytics': <BarChart3 className="w-4 h-4" />,
      'Audio': <Mic className="w-4 h-4" />,
      'Général': <Hash className="w-4 h-4" />
    };
    return icons[category] || <Hash className="w-4 h-4" />;
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.95, 
      y: -20 
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95, 
      y: -20,
      transition: {
        duration: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (index: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: index * 0.05,
        duration: 0.2
      }
    })
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          {/* Overlay */}
          <motion.div
            variants={shouldAnimate ? overlayVariants : {}}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            variants={shouldAnimate ? modalVariants : {}}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative w-full max-w-2xl mx-4',
              'bg-slate-900/95 backdrop-blur-xl',
              'border border-slate-700 rounded-xl shadow-2xl',
              'overflow-hidden',
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-700">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-white placeholder-slate-400 outline-none"
              />
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600">
                  <Command className="w-3 h-3" />
                </kbd>
                <span>+</span>
                <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600">K</kbd>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Aucun résultat trouvé</p>
                  <p className="text-sm mt-1">Essayez d'autres mots-clés</p>
                </div>
              ) : (
                <div className="p-2">
                  {!query && showRecent && recentItems.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        Récent
                      </div>
                    </div>
                  )}

                  {showCategories ? (
                    Object.entries(groupedItems).map(([category, categoryItems]) => (
                      <div key={category} className="mb-4 last:mb-0">
                        {query && (
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {getCategoryIcon(category)}
                            {category}
                          </div>
                        )}
                        {categoryItems.map((item, index) => {
                          const globalIndex = filteredItems.indexOf(item);
                          return (
                            <motion.button
                              key={item.id}
                              custom={index}
                              variants={shouldAnimate ? itemVariants : {}}
                              initial="hidden"
                              animate="visible"
                              onClick={() => {
                                item.action();
                                onClose();
                              }}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors',
                                'hover:bg-slate-800/50',
                                globalIndex === selectedIndex && 'bg-blue-500/20 border border-blue-500/30'
                              )}
                            >
                              {item.icon && (
                                <div className="flex-shrink-0 text-slate-400">
                                  {item.icon}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium truncate">
                                    {item.title}
                                  </span>
                                  {item.favorite && (
                                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                  )}
                                </div>
                                {item.subtitle && (
                                  <p className="text-sm text-slate-400 truncate">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                              {item.shortcut && (
                                <div className="flex items-center gap-1">
                                  {item.shortcut.map((key, i) => (
                                    <kbd
                                      key={i}
                                      className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded border border-slate-600"
                                    >
                                      {key}
                                    </kbd>
                                  ))}
                                </div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    filteredItems.map((item, index) => (
                      <motion.button
                        key={item.id}
                        custom={index}
                        variants={shouldAnimate ? itemVariants : {}}
                        initial="hidden"
                        animate="visible"
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors',
                          'hover:bg-slate-800/50',
                          index === selectedIndex && 'bg-blue-500/20 border border-blue-500/30'
                        )}
                      >
                        {item.icon && (
                          <div className="flex-shrink-0 text-slate-400">
                            {item.icon}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate">
                              {item.title}
                            </span>
                            {item.favorite && (
                              <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-sm text-slate-400 truncate">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        {item.shortcut && (
                          <div className="flex items-center gap-1">
                            {item.shortcut.map((key, i) => (
                              <kbd
                                key={i}
                                className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded border border-slate-600"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </motion.button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd>
                  Naviguer
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↵</kbd>
                  Sélectionner
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd>
                  Fermer
                </span>
              </div>
              <span>{filteredItems.length} résultat{filteredItems.length !== 1 ? 's' : ''}</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Hook pour utiliser la command palette
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  };
};

export default CommandPalette;