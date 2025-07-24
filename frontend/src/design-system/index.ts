// Export des design tokens
export { 
  default as designTokens,
  getColor,
  getSpacing,
  getFontSize,
  getBreakpoint,
  generateCSSVariables
} from './tokens';

export type {
  DesignTokens,
  ColorScale,
  SemanticColor,
  FontSize,
  Spacing,
  BorderRadius,
  BoxShadow,
  Breakpoint
} from './tokens';

// Export des composants UI modernes
export * from '../components/ui/modern';

// Export des composants d'animation
export * from '../components/animations';

// Export des composants de performance
export * from '../components/performance';

// Export des composants d'accessibilité
export {
  default as FocusProvider,
  useFocus,
  useFocusTrap,
  useKeyboardNavigation,
  FocusVisible,
  Landmark,
  useScreenReader,
  SkipLinks,
  useAccessibilityPreferences,
  VisuallyHidden
} from '../components/accessibility/FocusManager';

// Export des contextes
export {
  EnhancedThemeProvider,
  useEnhancedTheme,
  useMotion
} from '../contexts/EnhancedThemeContext';

// Export des hooks utilitaires
export { useSkeleton, useSkeletonWithData, useSkeletonList } from '../hooks/useSkeleton';

// Export des utilitaires
export { cn } from '../utils/cn';

// Configuration du système de design
export const designSystemConfig = {
  name: 'AURA Design System',
  version: '1.0.0',
  description: 'Système de design moderne et complet pour l\'application AURA',
  features: [
    'Skeleton Loaders avec animations shimmer',
    'Système de thèmes avancé (light/dark/auto)',
    'Animations avancées (page transitions, stagger, parallax)',
    'Composants modernes (FAB, Command Palette, Status indicators)',
    'Optimisations de performance (lazy loading, virtualization)',
    'Accessibilité complète (focus management, screen reader support)',
    'Design tokens complets',
    'Support TypeScript complet'
  ],
  components: {
    // Composants de base
    basic: [
      'Button',
      'Input',
      'Card',
      'Badge',
      'Modal',
      'Toast',
      'Progress',
      'Table',
      'LoadingSpinner'
    ],
    
    // Composants avancés
    advanced: [
      'Skeleton (avec variantes)',
      'ThemeSelector',
      'FloatingActionButton',
      'CommandPalette',
      'StatusIndicator (avec variantes)',
      'NetworkStatus',
      'BatteryStatus',
      'SystemStatus',
      'LiveStatus'
    ],
    
    // Composants d'animation
    animations: [
      'PageTransition',
      'StaggerContainer',
      'StaggerList',
      'StaggerGrid',
      'ParallaxContainer',
      'FloatingElement',
      'ScrollReveal',
      'ParallaxBackground',
      'MouseFollower'
    ],
    
    // Composants de performance
    performance: [
      'LazyLoader',
      'IntersectionLazyLoader',
      'LazyImage',
      'LazyModule',
      'VirtualList',
      'VirtualGrid',
      'InfiniteList',
      'ErrorBoundaryWithRetry',
      'OptimisticIndicator'
    ],
    
    // Composants d'accessibilité
    accessibility: [
      'FocusProvider',
      'FocusVisible',
      'Landmark',
      'SkipLinks',
      'VisuallyHidden'
    ]
  },
  
  hooks: [
    'useSkeleton',
    'useSkeletonWithData',
    'useSkeletonList',
    'useEnhancedTheme',
    'useMotion',
    'useFocus',
    'useFocusTrap',
    'useKeyboardNavigation',
    'useScreenReader',
    'useAccessibilityPreferences',
    'usePageTransition',
    'useStaggerAnimation',
    'useScrollAnimation',
    'useMouseParallax',
    'useLazyLoading',
    'usePreloader',
    'useVirtualization',
    'useOptimisticUpdates',
    'useRetryableAction',
    'useCommandPalette'
  ],
  
  utilities: [
    'cn (className utility)',
    'generateCSSVariables',
    'getColor',
    'getSpacing',
    'getFontSize',
    'getBreakpoint'
  ]
} as const;

// Guide d'utilisation rapide
export const quickStartGuide = {
  installation: `
    // Le système de design est déjà intégré dans le projet AURA
    // Importez les composants depuis le design system
    import { 
      ModernButton, 
      Skeleton, 
      ThemeSelector,
      FloatingActionButton,
      CommandPalette 
    } from './design-system';
  `,
  
  basicUsage: `
    // Utilisation des composants de base
    <ModernButton variant="primary" size="md">
      Cliquez ici
    </ModernButton>
    
    // Utilisation des skeletons
    <Skeleton variant="text" lines={3} />
    <SkeletonCard />
    
    // Utilisation du sélecteur de thème
    <ThemeSelector compact />
  `,
  
  advancedUsage: `
    // Utilisation des animations
    <PageTransition type="slide">
      <YourPageContent />
    </PageTransition>
    
    <StaggerList 
      items={data}
      renderItem={(item) => <ItemComponent item={item} />}
    />
    
    // Utilisation de la command palette
    const { isOpen, open, close } = useCommandPalette();
    
    // Utilisation des optimisations de performance
    <VirtualList 
      items={largeDataset}
      itemHeight={60}
      containerHeight={400}
      renderItem={(item) => <ListItem item={item} />}
    />
  `,
  
  accessibility: `
    // Utilisation des fonctionnalités d'accessibilité
    <FocusProvider>
      <YourApp />
    </FocusProvider>
    
    // Navigation au clavier
    const { selectedIndex } = useKeyboardNavigation(items, onSelect);
    
    // Annonces aux lecteurs d'écran
    const { announce } = useScreenReader();
    announce('Action terminée avec succès');
  `,
  
  theming: `
    // Utilisation du système de thèmes avancé
    <EnhancedThemeProvider>
      <YourApp />
    </EnhancedThemeProvider>
    
    // Dans vos composants
    const { theme, colorScheme, setTheme } = useEnhancedTheme();
    const { shouldAnimate } = useMotion();
  `
};

export default designSystemConfig;