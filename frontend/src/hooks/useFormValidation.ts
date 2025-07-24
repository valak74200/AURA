import { useState, useCallback, useMemo } from 'react';

// Validation rule types
export interface ValidationRule {
  required?: boolean | string;
  minLength?: number | { value: number; message: string };
  maxLength?: number | { value: number; message: string };
  pattern?: RegExp | { value: RegExp; message: string };
  email?: boolean | string;
  url?: boolean | string;
  number?: boolean | string;
  min?: number | { value: number; message: string };
  max?: number | { value: number; message: string };
  custom?: (value: any) => string | boolean;
  match?: string; // Field name to match against
}

export interface FieldConfig {
  rules?: ValidationRule;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

export interface FormConfig<T> {
  fields: Record<keyof T, FieldConfig>;
  validateOnSubmit?: boolean;
  resetOnSubmit?: boolean;
}

export interface FieldState {
  value: any;
  error: string | null;
  touched: boolean;
  dirty: boolean;
  validating: boolean;
}

export interface FormState<T> {
  values: T;
  errors: Record<keyof T, string | null>;
  touched: Record<keyof T, boolean>;
  dirty: Record<keyof T, boolean>;
  validating: Record<keyof T, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
}

export interface FormActions<T> {
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, error: string | null) => void;
  setErrors: (errors: Partial<Record<keyof T, string | null>>) => void;
  clearError: (field: keyof T) => void;
  clearErrors: () => void;
  setTouched: (field: keyof T, touched?: boolean) => void;
  setAllTouched: () => void;
  validateField: (field: keyof T) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
  reset: (values?: Partial<T>) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e?: React.FormEvent) => Promise<void>;
  getFieldProps: (field: keyof T) => {
    value: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    error: string | null;
    touched: boolean;
    dirty: boolean;
    validating: boolean;
  };
}

// Default validation messages
const defaultMessages = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  url: 'Please enter a valid URL',
  number: 'Please enter a valid number',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be no more than ${max} characters`,
  min: (min: number) => `Must be at least ${min}`,
  max: (max: number) => `Must be no more than ${max}`,
  pattern: 'Invalid format',
  match: (field: string) => `Must match ${field}`
};

// Validation functions
const validateField = async (
  value: any,
  rules: ValidationRule,
  allValues: any,
  fieldName: string
): Promise<string | null> => {
  // Required validation
  if (rules.required) {
    const isEmpty = value === null || value === undefined || value === '' || 
                   (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      return typeof rules.required === 'string' ? rules.required : defaultMessages.required;
    }
  }

  // Skip other validations if value is empty and not required
  if (!value && !rules.required) {
    return null;
  }

  // Email validation
  if (rules.email && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return typeof rules.email === 'string' ? rules.email : defaultMessages.email;
    }
  }

  // URL validation
  if (rules.url && value) {
    try {
      new URL(value);
    } catch {
      return typeof rules.url === 'string' ? rules.url : defaultMessages.url;
    }
  }

  // Number validation
  if (rules.number && value) {
    if (isNaN(Number(value))) {
      return typeof rules.number === 'string' ? rules.number : defaultMessages.number;
    }
  }

  // Min length validation
  if (rules.minLength && value) {
    const minLength = typeof rules.minLength === 'number' ? rules.minLength : rules.minLength.value;
    if (value.length < minLength) {
      return typeof rules.minLength === 'object' && rules.minLength.message
        ? rules.minLength.message
        : defaultMessages.minLength(minLength);
    }
  }

  // Max length validation
  if (rules.maxLength && value) {
    const maxLength = typeof rules.maxLength === 'number' ? rules.maxLength : rules.maxLength.value;
    if (value.length > maxLength) {
      return typeof rules.maxLength === 'object' && rules.maxLength.message
        ? rules.maxLength.message
        : defaultMessages.maxLength(maxLength);
    }
  }

  // Min value validation
  if (rules.min !== undefined && value !== '') {
    const minValue = typeof rules.min === 'number' ? rules.min : rules.min.value;
    if (Number(value) < minValue) {
      return typeof rules.min === 'object' && rules.min.message
        ? rules.min.message
        : defaultMessages.min(minValue);
    }
  }

  // Max value validation
  if (rules.max !== undefined && value !== '') {
    const maxValue = typeof rules.max === 'number' ? rules.max : rules.max.value;
    if (Number(value) > maxValue) {
      return typeof rules.max === 'object' && rules.max.message
        ? rules.max.message
        : defaultMessages.max(maxValue);
    }
  }

  // Pattern validation
  if (rules.pattern && value) {
    const pattern = rules.pattern instanceof RegExp ? rules.pattern : rules.pattern.value;
    if (!pattern.test(value)) {
      return typeof rules.pattern === 'object' && 'message' in rules.pattern
        ? rules.pattern.message
        : defaultMessages.pattern;
    }
  }

  // Match validation
  if (rules.match && value) {
    const matchValue = allValues[rules.match];
    if (value !== matchValue) {
      return defaultMessages.match(rules.match);
    }
  }

  // Custom validation
  if (rules.custom) {
    const result = rules.custom(value);
    if (typeof result === 'string') {
      return result;
    }
    if (result === false) {
      return 'Validation failed';
    }
  }

  return null;
};

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  config: FormConfig<T>
): FormState<T> & FormActions<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrorsState] = useState<Record<keyof T, string | null>>(
    {} as Record<keyof T, string | null>
  );
  const [touched, setTouchedState] = useState<Record<keyof T, boolean>>(
    {} as Record<keyof T, boolean>
  );
  const [dirty, setDirtyState] = useState<Record<keyof T, boolean>>(
    {} as Record<keyof T, boolean>
  );
  const [validating, setValidatingState] = useState<Record<keyof T, boolean>>(
    {} as Record<keyof T, boolean>
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Debounce timers
  const [debounceTimers, setDebounceTimers] = useState<Record<string, number>>({});

  const isValid = useMemo(() => {
    return Object.values(errors).every(error => !error);
  }, [errors]);

  const setValue = useCallback((field: keyof T, value: any) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
    setDirtyState(prev => ({ ...prev, [field]: true }));

    const fieldConfig = config.fields[field];
    if (fieldConfig?.validateOnChange) {
      // Clear existing debounce timer
      if (debounceTimers[field as string]) {
        clearTimeout(debounceTimers[field as string]);
      }

      const debounceMs = fieldConfig.debounceMs || 300;
      const timer = setTimeout(async () => {
        setValidatingState(prev => ({ ...prev, [field]: true }));
        const error = await validateField(
          value,
          fieldConfig.rules || {},
          { ...values, [field]: value },
          field as string
        );
        setErrorsState(prev => ({ ...prev, [field]: error }));
        setValidatingState(prev => ({ ...prev, [field]: false }));
      }, debounceMs);

      setDebounceTimers(prev => ({ ...prev, [field as string]: timer }));
    }
  }, [values, config.fields, debounceTimers]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
    Object.keys(newValues).forEach(key => {
      setDirtyState(prev => ({ ...prev, [key]: true }));
    });
  }, []);

  const setError = useCallback((field: keyof T, error: string | null) => {
    setErrorsState(prev => ({ ...prev, [field]: error }));
  }, []);

  const setErrors = useCallback((newErrors: Partial<Record<keyof T, string | null>>) => {
    setErrorsState(prev => ({ ...prev, ...newErrors }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrorsState(prev => ({ ...prev, [field]: null }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrorsState({} as Record<keyof T, string | null>);
  }, []);

  const setTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouchedState(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  const setAllTouched = useCallback(() => {
    const touchedFields = {} as Record<keyof T, boolean>;
    Object.keys(values).forEach(key => {
      touchedFields[key as keyof T] = true;
    });
    setTouchedState(touchedFields);
  }, [values]);

  const validateFieldAsync = useCallback(async (field: keyof T): Promise<boolean> => {
    const fieldConfig = config.fields[field];
    if (!fieldConfig?.rules) return true;

    setValidatingState(prev => ({ ...prev, [field]: true }));
    const error = await validateField(
      values[field],
      fieldConfig.rules,
      values,
      field as string
    );
    setErrorsState(prev => ({ ...prev, [field]: error }));
    setValidatingState(prev => ({ ...prev, [field]: false }));

    return !error;
  }, [values, config.fields]);

  const validateForm = useCallback(async (): Promise<boolean> => {
    const validationPromises = Object.keys(config.fields).map(async (field) => {
      const fieldKey = field as keyof T;
      return validateFieldAsync(fieldKey);
    });

    const results = await Promise.all(validationPromises);
    return results.every(result => result);
  }, [config.fields, validateFieldAsync]);

  const reset = useCallback((newValues?: Partial<T>) => {
    const resetValues = newValues ? { ...initialValues, ...newValues } : initialValues;
    setValuesState(resetValues);
    setErrorsState({} as Record<keyof T, string | null>);
    setTouchedState({} as Record<keyof T, boolean>);
    setDirtyState({} as Record<keyof T, boolean>);
    setValidatingState({} as Record<keyof T, boolean>);
    setIsSubmitting(false);
    setSubmitCount(0);
  }, [initialValues]);

  const handleSubmit = useCallback((onSubmit: (values: T) => Promise<void> | void) => {
    return async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      setIsSubmitting(true);
      setSubmitCount(prev => prev + 1);

      try {
        if (config.validateOnSubmit !== false) {
          setAllTouched();
          const isFormValid = await validateForm();
          if (!isFormValid) {
            setIsSubmitting(false);
            return;
          }
        }

        await onSubmit(values);

        if (config.resetOnSubmit) {
          reset();
        }
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [values, config.validateOnSubmit, config.resetOnSubmit, validateForm, setAllTouched, reset]);

  const getFieldProps = useCallback((field: keyof T) => {
    const fieldConfig = config.fields[field];
    
    return {
      value: values[field] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValue(field, e.target.value);
      },
      onBlur: async (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setTouched(field, true);
        if (fieldConfig?.validateOnBlur) {
          await validateFieldAsync(field);
        }
      },
      error: errors[field],
      touched: touched[field] || false,
      dirty: dirty[field] || false,
      validating: validating[field] || false
    };
  }, [values, errors, touched, dirty, validating, config.fields, setValue, setTouched, validateFieldAsync]);

  return {
    // State
    values,
    errors,
    touched,
    dirty,
    validating,
    isValid,
    isSubmitting,
    submitCount,
    // Actions
    setValue,
    setValues,
    setError,
    setErrors,
    clearError,
    clearErrors,
    setTouched,
    setAllTouched,
    validateField: validateFieldAsync,
    validateForm,
    reset,
    handleSubmit,
    getFieldProps
  };
}

// Utility function for common validation rules
export const validationRules = {
  required: (message?: string): ValidationRule => ({
    required: message || defaultMessages.required
  }),
  
  email: (message?: string): ValidationRule => ({
    email: message || defaultMessages.email
  }),
  
  minLength: (length: number, message?: string): ValidationRule => ({
    minLength: message ? { value: length, message } : length
  }),
  
  maxLength: (length: number, message?: string): ValidationRule => ({
    maxLength: message ? { value: length, message } : length
  }),
  
  pattern: (regex: RegExp, message?: string): ValidationRule => ({
    pattern: message ? { value: regex, message } : regex
  }),
  
  match: (fieldName: string): ValidationRule => ({
    match: fieldName
  }),
  
  password: (message?: string): ValidationRule => ({
    minLength: 8,
    pattern: {
      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      message: message || 'Password must contain at least 8 characters with uppercase, lowercase, number and special character'
    }
  })
};