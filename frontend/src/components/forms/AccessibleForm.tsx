import React, { useId } from 'react';
import { useForm, Controller, FieldValues, Path, Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  Lock,
  User,
  Phone,
  Building,
  MessageSquare
} from 'lucide-react';

// Base input props interface
interface BaseInputProps {
  label: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

// Text Input Component
interface TextInputProps<T extends FieldValues> extends BaseInputProps {
  name: Path<T>;
  control: Control<T>;
  type?: 'text' | 'email' | 'tel' | 'url';
  icon?: React.ComponentType<{ className?: string }>;
  maxLength?: number;
}

export function TextInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  helperText,
  type = 'text',
  icon: Icon,
  maxLength,
  required = false,
  disabled = false,
  className = '',
  ...props
}: TextInputProps<T>) {
  const { t } = useTranslation();
  const inputId = useId();
  const helperTextId = useId();
  const errorId = useId();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <div className={`space-y-2 ${className}`}>
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
            {required && <span className="text-red-400 ml-1" aria-label="required">*</span>}
          </label>
          
          <div className="relative">
            {Icon && (
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon className="w-5 h-5 text-gray-400" />
              </div>
            )}
            
            <input
              {...field}
              id={inputId}
              type={type}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={disabled}
              className={`w-full bg-glass-gradient backdrop-blur-sm border rounded-xl px-4 py-3 text-white placeholder-gray-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                Icon ? 'pl-12' : ''
              } ${
                error 
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-red-400' 
                  : 'border-glass-300 focus:border-primary-500 focus:ring-primary-400'
              } ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-glass-400'
              }`}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={`${helperText ? helperTextId : ''} ${error ? errorId : ''}`.trim()}
              {...props}
            />
            
            {maxLength && field.value && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-xs text-gray-400">
                  {field.value.length}/{maxLength}
                </span>
              </div>
            )}
          </div>
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-red-400 text-sm"
                id={errorId}
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error.message}</span>
              </motion.div>
            )}
            
            {!error && helperText && (
              <motion.div
                key="helper"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-gray-400 text-sm"
                id={helperTextId}
              >
                {helperText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    />
  );
}

// Password Input Component
interface PasswordInputProps<T extends FieldValues> extends BaseInputProps {
  name: Path<T>;
  control: Control<T>;
  showStrengthIndicator?: boolean;
}

export function PasswordInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  helperText,
  showStrengthIndicator = false,
  required = false,
  disabled = false,
  className = '',
  ...props
}: PasswordInputProps<T>) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = React.useState(false);
  const inputId = useId();
  const helperTextId = useId();
  const errorId = useId();

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['text-red-400', 'text-orange-400', 'text-yellow-400', 'text-blue-400', 'text-green-400'];
    
    return {
      score: (score / 5) * 100,
      label: labels[Math.min(score - 1, 4)] || '',
      color: colors[Math.min(score - 1, 4)] || 'text-gray-400'
    };
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const strength = showStrengthIndicator ? getPasswordStrength(field.value || '') : null;
        
        return (
          <div className={`space-y-2 ${className}`}>
            <label 
              htmlFor={inputId}
              className="block text-sm font-medium text-gray-300"
            >
              {label}
              {required && <span className="text-red-400 ml-1" aria-label="required">*</span>}
            </label>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              
              <input
                {...field}
                id={inputId}
                type={showPassword ? 'text' : 'password'}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full bg-glass-gradient backdrop-blur-sm border rounded-xl pl-12 pr-12 py-3 text-white placeholder-gray-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  error 
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-400' 
                    : 'border-glass-300 focus:border-primary-500 focus:ring-primary-400'
                } ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-glass-400'
                }`}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={`${helperText ? helperTextId : ''} ${error ? errorId : ''}`.trim()}
                {...props}
              />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {showStrengthIndicator && strength && field.value && (
              <div className="space-y-1">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full transition-all duration-300 ${
                      strength.score <= 20 ? 'bg-red-400' :
                      strength.score <= 40 ? 'bg-orange-400' :
                      strength.score <= 60 ? 'bg-yellow-400' :
                      strength.score <= 80 ? 'bg-blue-400' : 'bg-green-400'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${strength.score}%` }}
                  />
                </div>
                {strength.label && (
                  <p className={`text-sm ${strength.color}`}>
                    Password strength: {strength.label}
                  </p>
                )}
              </div>
            )}
            
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 text-red-400 text-sm"
                  id={errorId}
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error.message}</span>
                </motion.div>
              )}
              
              {!error && helperText && (
                <motion.div
                  key="helper"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-gray-400 text-sm"
                  id={helperTextId}
                >
                  {helperText}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }}
    />
  );
}

// Textarea Component
interface TextareaProps<T extends FieldValues> extends BaseInputProps {
  name: Path<T>;
  control: Control<T>;
  rows?: number;
  maxLength?: number;
}

export function Textarea<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  helperText,
  rows = 4,
  maxLength,
  required = false,
  disabled = false,
  className = '',
  ...props
}: TextareaProps<T>) {
  const inputId = useId();
  const helperTextId = useId();
  const errorId = useId();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <div className={`space-y-2 ${className}`}>
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
            {required && <span className="text-red-400 ml-1" aria-label="required">*</span>}
          </label>
          
          <div className="relative">
            <textarea
              {...field}
              id={inputId}
              rows={rows}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={disabled}
              className={`w-full bg-glass-gradient backdrop-blur-sm border rounded-xl px-4 py-3 text-white placeholder-gray-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 resize-vertical ${
                error 
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-red-400' 
                  : 'border-glass-300 focus:border-primary-500 focus:ring-primary-400'
              } ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-glass-400'
              }`}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={`${helperText ? helperTextId : ''} ${error ? errorId : ''}`.trim()}
              {...props}
            />
            
            {maxLength && field.value && (
              <div className="absolute bottom-3 right-3 pointer-events-none">
                <span className="text-xs text-gray-400 bg-gray-800/80 px-2 py-1 rounded">
                  {field.value.length}/{maxLength}
                </span>
              </div>
            )}
          </div>
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-red-400 text-sm"
                id={errorId}
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error.message}</span>
              </motion.div>
            )}
            
            {!error && helperText && (
              <motion.div
                key="helper"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-gray-400 text-sm"
                id={helperTextId}
              >
                {helperText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    />
  );
}

// Form Button Component
interface FormButtonProps {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const FormButton: React.FC<FormButtonProps> = ({
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  className = '',
  onClick,
  ...props
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-4 py-2 text-sm';
      case 'lg':
        return 'px-8 py-4 text-lg';
      default:
        return 'px-6 py-3 text-base';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:shadow-neon hover:scale-105';
      case 'secondary':
        return 'bg-glass-gradient border border-glass-300 text-white hover:bg-glass-200';
      case 'outline':
        return 'border-2 border-primary-500 text-primary-400 hover:bg-primary-500 hover:text-white';
      case 'ghost':
        return 'text-gray-400 hover:text-white hover:bg-glass-300';
      default:
        return 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:shadow-neon hover:scale-105';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none ${getSizeClasses()} ${getVariantClasses()} ${className}`}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

// Example usage with complete form
const ContactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message must be less than 1000 characters'),
});

type ContactFormData = z.infer<typeof ContactFormSchema>;

interface ContactFormProps {
  onSubmit: (data: ContactFormData) => Promise<void>;
  loading?: boolean;
  className?: string;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  onSubmit,
  loading = false,
  className = ''
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset
  } = useForm<ContactFormData>({
    resolver: zodResolver(ContactFormSchema),
    mode: 'onChange'
  });

  const onFormSubmit = async (data: ContactFormData) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onFormSubmit)}
      className={`space-y-6 ${className}`}
      noValidate
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TextInput
          name="firstName"
          control={control}
          label={t('forms.labels.first_name')}
          placeholder={t('forms.placeholders.first_name')}
          icon={User}
          required
        />
        
        <TextInput
          name="lastName"
          control={control}
          label={t('forms.labels.last_name')}
          placeholder={t('forms.placeholders.last_name')}
          icon={User}
          required
        />
      </div>
      
      <TextInput
        name="email"
        control={control}
        type="email"
        label={t('forms.labels.email')}
        placeholder={t('forms.placeholders.email')}
        icon={Mail}
        required
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TextInput
          name="phone"
          control={control}
          type="tel"
          label={t('forms.labels.phone')}
          placeholder={t('forms.placeholders.phone')}
          icon={Phone}
        />
        
        <TextInput
          name="company"
          control={control}
          label={t('forms.labels.company')}
          placeholder={t('forms.placeholders.company')}
          icon={Building}
        />
      </div>
      
      <Textarea
        name="message"
        control={control}
        label={t('forms.labels.message')}
        placeholder={t('forms.placeholders.message')}
        rows={6}
        maxLength={1000}
        required
      />
      
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          * Required fields
        </p>
        
        <FormButton
          type="submit"
          loading={isSubmitting || loading}
          disabled={!isValid}
          size="lg"
        >
          Send Message
        </FormButton>
      </div>
    </form>
  );
};

export default ContactForm;