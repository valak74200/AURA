// Modern components as default exports (unified design system)
export { default as Button } from './modern/Button';
export { default as Card } from './modern/Card';
export { default as Input } from './modern/Input';
export { default as Badge } from './modern/Badge';
export { default as LoadingSpinner } from './modern/LoadingSpinner';
export { default as Toast } from './modern/Toast';
export { default as ToastContainer, ToastProvider, useToast } from './modern/ToastContainer';
export { default as Modal } from './modern/Modal';
export { default as Progress } from './modern/Progress';
export { default as Table } from './modern/Table';

// Keep these as they are already modern/universal
export { default as Container } from './Container';
export { default as AnimatedCard } from './AnimatedCard';
export { default as GradientText } from './GradientText';
export { default as ThemeToggle } from './ThemeToggle';

// Export types for TypeScript support
export type { ModernButtonProps as ButtonProps } from './modern/Button';
export type { ModernCardProps as CardProps } from './modern/Card';
export type { ModernInputProps as InputProps } from './modern/Input';
export type { ModernBadgeProps as BadgeProps } from './modern/Badge';
export type { ModernLoadingSpinnerProps as LoadingSpinnerProps } from './modern/LoadingSpinner';
export type { ToastProps } from './modern/Toast';
export type { ModernModalProps as ModalProps } from './modern/Modal';
export type { ModernProgressProps as ProgressProps } from './modern/Progress';
export type { ModernTableProps as TableProps, Column } from './modern/Table';