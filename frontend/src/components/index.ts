// Hero Components
export { default as FuturisticHero } from './hero/FuturisticHero';

// Agent Components
export { default as DIDAgentInterface } from './agent/DIDAgentInterface';

// Summary Components
export { default as LiveSummaryPanel } from './summary/LiveSummaryPanel';

// Metrics Components
export { default as MetricsDashboard } from './metrics/MetricsDashboard';

// Settings Components
export { default as AudioSettings } from './settings/AudioSettings';

// UI Components
export { default as LanguageSwitcher } from './ui/LanguageSwitcher';

// Pricing Components
export { default as PricingCards } from './pricing/PricingCards';

// Form Components
export {
  TextInput,
  PasswordInput,
  Textarea,
  FormButton,
  ContactForm,
  default as AccessibleForm
} from './forms/AccessibleForm';

// Re-export existing components
export * from './ui';
export * from './layout';
export * from './audio';
export * from './session';
export * from './animations';
export * from './performance';
export * from './accessibility';