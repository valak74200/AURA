import React from 'react';
import { useFormValidation, validationRules } from '../../hooks/useFormValidation';

// Example form data interface
interface LoginFormData {
  email: string;
  password: string;
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  language: string;
}

// Reusable form field component
interface FormFieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  children?: React.ReactNode;
  error?: string | null;
  touched?: boolean;
  validating?: boolean;
  [key: string]: any;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  type = 'text',
  placeholder,
  required,
  error,
  touched,
  validating,
  children,
  ...props
}) => {
  const hasError = touched && error;
  
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {children || (
        <input
          type={type}
          placeholder={placeholder}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            ${hasError 
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500'
            }
            ${validating ? 'opacity-75' : ''}
          `}
          {...props}
        />
      )}
      
      {validating && (
        <div className="mt-1 text-sm text-blue-600 flex items-center">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
          Validating...
        </div>
      )}
      
      {hasError && (
        <div className="mt-1 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
};

// Login form example
export const LoginForm: React.FC<{
  onSubmit: (data: LoginFormData) => Promise<void>;
}> = ({ onSubmit }) => {
  const form = useFormValidation<LoginFormData>(
    {
      email: '',
      password: ''
    },
    {
      fields: {
        email: {
          rules: {
            ...validationRules.required(),
            ...validationRules.email()
          },
          validateOnChange: true,
          validateOnBlur: true,
          debounceMs: 500
        },
        password: {
          rules: validationRules.required('Password is required'),
          validateOnBlur: true
        }
      },
      validateOnSubmit: true
    }
  );

  const emailProps = form.getFieldProps('email');
  const passwordProps = form.getFieldProps('password');

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
      
      <FormField
        label="Email"
        type="email"
        placeholder="Enter your email"
        required
        {...emailProps}
      />
      
      <FormField
        label="Password"
        type="password"
        placeholder="Enter your password"
        required
        {...passwordProps}
      />
      
      <button
        type="submit"
        disabled={form.isSubmitting || !form.isValid}
        className={`
          w-full py-2 px-4 rounded-md font-medium transition-colors
          ${form.isSubmitting || !form.isValid
            ? 'bg-gray-400 cursor-not-allowed text-gray-700'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {form.isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Signing in...
          </div>
        ) : (
          'Sign In'
        )}
      </button>
      
      {form.submitCount > 0 && !form.isValid && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">
            Please fix the errors above before submitting.
          </p>
        </div>
      )}
    </form>
  );
};

// Registration form example
export const RegisterForm: React.FC<{
  onSubmit: (data: RegisterFormData) => Promise<void>;
}> = ({ onSubmit }) => {
  const form = useFormValidation<RegisterFormData>(
    {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      language: 'fr'
    },
    {
      fields: {
        username: {
          rules: {
            ...validationRules.required(),
            ...validationRules.minLength(3, 'Username must be at least 3 characters'),
            ...validationRules.pattern(
              /^[a-zA-Z0-9_]+$/,
              'Username can only contain letters, numbers, and underscores'
            )
          },
          validateOnChange: true,
          debounceMs: 300
        },
        email: {
          rules: {
            ...validationRules.required(),
            ...validationRules.email()
          },
          validateOnChange: true,
          debounceMs: 500
        },
        password: {
          rules: {
            ...validationRules.required(),
            ...validationRules.password()
          },
          validateOnChange: true,
          debounceMs: 300
        },
        confirmPassword: {
          rules: {
            ...validationRules.required('Please confirm your password'),
            ...validationRules.match('password')
          },
          validateOnChange: true,
          debounceMs: 300
        },
        firstName: {
          rules: {
            ...validationRules.required(),
            ...validationRules.minLength(2)
          },
          validateOnBlur: true
        },
        lastName: {
          rules: {
            ...validationRules.required(),
            ...validationRules.minLength(2)
          },
          validateOnBlur: true
        },
        language: {
          rules: validationRules.required()
        }
      },
      validateOnSubmit: true,
      resetOnSubmit: true
    }
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="First Name"
          placeholder="John"
          required
          {...form.getFieldProps('firstName')}
        />
        
        <FormField
          label="Last Name"
          placeholder="Doe"
          required
          {...form.getFieldProps('lastName')}
        />
      </div>
      
      <FormField
        label="Username"
        placeholder="johndoe"
        required
        {...form.getFieldProps('username')}
      />
      
      <FormField
        label="Email"
        type="email"
        placeholder="john@example.com"
        required
        {...form.getFieldProps('email')}
      />
      
      <FormField
        label="Password"
        type="password"
        placeholder="Enter a strong password"
        required
        {...form.getFieldProps('password')}
      />
      
      <FormField
        label="Confirm Password"
        type="password"
        placeholder="Confirm your password"
        required
        {...form.getFieldProps('confirmPassword')}
      />
      
      <FormField
        label="Language"
        required
        {...form.getFieldProps('language')}
      >
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          {...form.getFieldProps('language')}
        >
          <option value="">Select a language</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </FormField>
      
      <button
        type="submit"
        disabled={form.isSubmitting || !form.isValid}
        className={`
          w-full py-2 px-4 rounded-md font-medium transition-colors
          ${form.isSubmitting || !form.isValid
            ? 'bg-gray-400 cursor-not-allowed text-gray-700'
            : 'bg-green-600 hover:bg-green-700 text-white'
          }
        `}
      >
        {form.isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Creating account...
          </div>
        ) : (
          'Create Account'
        )}
      </button>
      
      {form.submitCount > 0 && !form.isValid && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">
            Please fix the errors above before submitting.
          </p>
        </div>
      )}
      
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => form.reset()}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Reset Form
        </button>
      </div>
    </form>
  );
};

// Session creation form example
interface SessionFormData {
  title: string;
  description: string;
  sessionType: string;
  language: string;
  maxDuration: number;
  feedbackFrequency: number;
}

export const SessionForm: React.FC<{
  onSubmit: (data: SessionFormData) => Promise<void>;
}> = ({ onSubmit }) => {
  const form = useFormValidation<SessionFormData>(
    {
      title: '',
      description: '',
      sessionType: 'practice',
      language: 'fr',
      maxDuration: 1800,
      feedbackFrequency: 5
    },
    {
      fields: {
        title: {
          rules: {
            ...validationRules.required(),
            ...validationRules.minLength(3),
            ...validationRules.maxLength(100)
          },
          validateOnChange: true,
          debounceMs: 300
        },
        description: {
          rules: {
            ...validationRules.maxLength(500, 'Description must be less than 500 characters')
          },
          validateOnChange: true,
          debounceMs: 500
        },
        sessionType: {
          rules: validationRules.required()
        },
        language: {
          rules: validationRules.required()
        },
        maxDuration: {
          rules: {
            ...validationRules.required(),
            min: { value: 300, message: 'Session must be at least 5 minutes' },
            max: { value: 7200, message: 'Session cannot exceed 2 hours' }
          },
          validateOnChange: true
        },
        feedbackFrequency: {
          rules: {
            ...validationRules.required(),
            min: { value: 1, message: 'Minimum feedback frequency is 1 second' },
            max: { value: 60, message: 'Maximum feedback frequency is 60 seconds' }
          },
          validateOnChange: true
        }
      }
    }
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Create New Session</h2>
      
      <FormField
        label="Session Title"
        placeholder="My presentation practice"
        required
        {...form.getFieldProps('title')}
      />
      
      <FormField
        label="Description"
        placeholder="Describe what you'll be practicing..."
        {...form.getFieldProps('description')}
      >
        <textarea
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          {...form.getFieldProps('description')}
        />
      </FormField>
      
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Session Type"
          required
          {...form.getFieldProps('sessionType')}
        >
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...form.getFieldProps('sessionType')}
          >
            <option value="practice">Practice</option>
            <option value="rehearsal">Rehearsal</option>
            <option value="evaluation">Evaluation</option>
          </select>
        </FormField>
        
        <FormField
          label="Language"
          required
          {...form.getFieldProps('language')}
        >
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...form.getFieldProps('language')}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </FormField>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Max Duration (seconds)"
          type="number"
          required
          {...form.getFieldProps('maxDuration')}
        />
        
        <FormField
          label="Feedback Frequency (seconds)"
          type="number"
          required
          {...form.getFieldProps('feedbackFrequency')}
        />
      </div>
      
      <button
        type="submit"
        disabled={form.isSubmitting || !form.isValid}
        className={`
          w-full py-3 px-4 rounded-md font-medium transition-colors
          ${form.isSubmitting || !form.isValid
            ? 'bg-gray-400 cursor-not-allowed text-gray-700'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {form.isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Creating session...
          </div>
        ) : (
          'Create Session'
        )}
      </button>
    </form>
  );
};