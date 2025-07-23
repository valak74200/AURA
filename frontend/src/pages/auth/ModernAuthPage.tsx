import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mic, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Button, Input } from '../../components/ui';
import Container from '../../components/ui/Container';
import AnimatedCard from '../../components/ui/AnimatedCard';
import GradientText from '../../components/ui/GradientText';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

interface ModernAuthPageProps {
  mode: 'login' | 'register';
}

const ModernAuthPage: React.FC<ModernAuthPageProps> = ({ mode: initialMode }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, register: registerUser } = useAuthStore();
  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(mode === 'login' ? loginSchema : registerSchema),
  });

  const { register: registerField, handleSubmit, formState: { errors }, reset, watch } = form;

  const password = watch('password');

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    const levels = [
      { score: 0, label: 'Très faible', color: 'bg-red-500' },
      { score: 1, label: 'Faible', color: 'bg-red-400' },
      { score: 2, label: 'Moyen', color: 'bg-yellow-400' },
      { score: 3, label: 'Bon', color: 'bg-blue-400' },
      { score: 4, label: 'Fort', color: 'bg-green-400' },
      { score: 5, label: 'Très fort', color: 'bg-green-500' },
    ];

    return levels[score] || levels[0];
  };

  const passwordStrength = getPasswordStrength((password as string) || '');

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login({
          email_or_username: data.username,
          password: data.password,
        });
      } else {
        await registerUser({
          username: data.username,
          email: data.email,
          password: data.password,
          confirm_password: data.confirmPassword,
        });
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || `${mode === 'login' ? 'Login' : 'Registration'} failed. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    reset();
    setError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />
      
      <Container className="py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-100">AURA</span>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <AnimatedCard className="p-8 glass border-slate-700/50 bg-slate-900/50">
            {/* Logo and Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mb-4">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-3xl font-bold text-slate-100 mb-2">
                    {mode === 'login' ? (
                      <>Bon retour sur <GradientText>AURA</GradientText></>
                    ) : (
                      <>Rejoignez <GradientText>AURA</GradientText></>
                    )}
                  </h1>
                  <p className="text-slate-400">
                    {mode === 'login' 
                      ? 'Connectez-vous pour continuer votre progression'
                      : 'Commencez votre parcours vers une meilleure élocution'
                    }
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Form */}
            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Input
                      {...(registerField as any)('email')}
                      type="email"
                      placeholder="Adresse email"
                      error={mode === 'register' ? (errors as any).email?.message : undefined}
                      disabled={isLoading}
                    />
                  </motion.div>
                )}

                <div>
                  <Input
                    {...(registerField as any)('username')}
                    type="text"
                    placeholder={mode === 'login' ? 'Username ou Email' : 'Username'}
                    error={errors.username?.message}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Input
                    {...(registerField as any)('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    error={errors.password?.message}
                    disabled={isLoading}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  
                  {/* Password Strength Indicator */}
                  {mode === 'register' && password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{passwordStrength.label}</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <Input
                      {...(registerField as any)('confirmPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirmer le mot de passe"
                      error={mode === 'register' ? (errors as any).confirmPassword?.message : undefined}
                      disabled={isLoading}
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-slate-400 hover:text-slate-300 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                  loading={isLoading}
                >
                  {isLoading 
                    ? (mode === 'login' ? 'Connexion...' : 'Création du compte...')
                    : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')
                  }
                </Button>
              </motion.form>
            </AnimatePresence>

            {/* Switch Mode */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-400">
                {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}{' '}
                <button 
                  onClick={switchMode}
                  className="text-blue-400 hover:text-blue-300 font-medium underline bg-transparent border-none cursor-pointer"
                  disabled={isLoading}
                >
                  {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
                </button>
              </p>
            </div>

            {/* Features for Register Mode */}
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="mt-6 pt-6 border-t border-slate-700"
              >
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Analyse IA en temps réel
                  </div>
                  <div className="flex items-center text-sm text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Suivi des progrès personnalisé
                  </div>
                  <div className="flex items-center text-sm text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Support multilingue
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatedCard>

          {/* Terms */}
          {mode === 'register' && (
            <div className="mt-6 text-center text-xs text-slate-500">
              En créant un compte, vous acceptez nos{' '}
              <a href="#" className="text-blue-400 hover:text-blue-300">Conditions d'utilisation</a>{' '}
              et notre{' '}
              <a href="#" className="text-blue-400 hover:text-blue-300">Politique de confidentialité</a>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};

export default ModernAuthPage;