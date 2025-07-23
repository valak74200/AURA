import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Mic, 
  Users, 
  BookOpen, 
  Target,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Clock,
  Zap,
  Brain,
  Settings
} from 'lucide-react';
import { useCreateSession } from '../../hooks/useSession';
import { useAuthStore } from '../../store/useAuthStore';
import { Button, Input, Card } from '../../components/ui';
import Container from '../../components/ui/Container';
import AnimatedCard from '../../components/ui/AnimatedCard';
import GradientText from '../../components/ui/GradientText';
import type { SessionType, SupportedLanguage, SessionDifficulty } from '../../types';

const sessionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(100, 'Titre trop long'),
  session_type: z.enum(['presentation', 'conversation', 'pronunciation', 'reading'] as const),
  language: z.enum(['en', 'fr'] as const),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced'] as const),
  duration_target: z.number().min(5).max(120),
  description: z.string().optional(),
  custom_prompt: z.string().optional(),
});

type SessionFormData = z.infer<typeof sessionSchema>;

const ModernNewSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const createSessionMutation = useCreateSession();
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [step, setStep] = useState<'type' | 'details' | 'config'>('type');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues
  } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      session_type: (searchParams.get('type') as SessionType) || 'presentation',
      language: 'fr',
      difficulty: 'intermediate',
      duration_target: 30,
    }
  });

  const watchedSessionType = watch('session_type');
  const watchedLanguage = watch('language');

  const sessionTypes = [
    {
      id: 'presentation' as const,
      title: 'Présentation',
      description: 'Perfectionner vos présentations professionnelles',
      icon: Mic,
      color: 'from-blue-500 to-blue-600',
      features: ['Analyse du débit', 'Détection des hésitations', 'Structure du discours']
    },
    {
      id: 'conversation' as const,
      title: 'Conversation',
      description: 'Améliorer votre expression orale spontanée',
      icon: Users,
      color: 'from-green-500 to-green-600',
      features: ['Fluidité naturelle', 'Interaction dynamique', 'Réactivité']
    },
    {
      id: 'pronunciation' as const,
      title: 'Prononciation',
      description: 'Travailler votre accent et articulation',
      icon: Target,
      color: 'from-purple-500 to-purple-600',
      features: ['Phonétique précise', 'Accents régionaux', 'Clarté vocale']
    },
    {
      id: 'reading' as const,
      title: 'Lecture',
      description: 'Maîtriser la lecture à voix haute',
      icon: BookOpen,
      color: 'from-orange-500 to-orange-600',
      features: ['Intonation', 'Rythme de lecture', 'Expression']
    }
  ];

  const focusAreas = [
    'Réduction du stress', 'Amélioration du débit', 'Clarté vocale',
    'Gestion des pauses', 'Intonation', 'Langage corporel',
    'Engagement du public', 'Structure narrative'
  ];

  const onSubmit = async (data: SessionFormData) => {
    try {
      if (!user?.id) {
        console.error('User not authenticated');
        return;
      }

      const sessionData = {
        user_id: user.id,
        title: data.title,
        description: data.description,
        session_type: data.session_type,
        language: data.language,
        difficulty: data.difficulty,
        duration_target: data.duration_target,
        focus_areas: selectedFocusAreas,
        custom_prompt: data.custom_prompt,
        config: {
          realtime_feedback: true,
          auto_transcription: true,
          voice_analysis: true,
          difficulty: data.difficulty,
          focus_areas: selectedFocusAreas,
          duration_target: data.duration_target * 60,
          custom_prompt: data.custom_prompt || undefined
        }
      };

      const newSession = await createSessionMutation.mutateAsync(sessionData);
      navigate(`/sessions/${newSession.id}`);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const toggleFocusArea = (area: string) => {
    const newAreas = selectedFocusAreas.includes(area)
      ? selectedFocusAreas.filter(a => a !== area)
      : [...selectedFocusAreas, area];
    setSelectedFocusAreas(newAreas);
  };

  const nextStep = () => {
    if (step === 'type') setStep('details');
    else if (step === 'details') setStep('config');
  };

  const prevStep = () => {
    if (step === 'config') setStep('details');
    else if (step === 'details') setStep('type');
  };

  const renderStepContent = () => {
    switch (step) {
      case 'type':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                Quel type de session souhaitez-vous créer ?
              </h2>
              <p className="text-gray-600">
                Choisissez le format qui correspond le mieux à vos objectifs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sessionTypes.map((type) => {
                const isSelected = watchedSessionType === type.id;
                return (
                  <motion.div
                    key={type.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setValue('session_type', type.id)}
                  >
                    <Card className={`p-6 h-full ${isSelected ? 'border-blue-500 bg-blue-50' : 'hover:shadow-lg'}`}>
                      <div className="flex items-start space-x-4">
                        <div className={`w-12 h-12 bg-gradient-to-br ${type.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <type.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-100 mb-2">
                            {type.title}
                          </h3>
                          <p className="text-gray-600 mb-4">
                            {type.description}
                          </p>
                          <div className="space-y-1">
                            {type.features.map((feature, index) => (
                              <div key={index} className="flex items-center text-sm text-gray-500">
                                <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                                {feature}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );

      case 'details':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                Détails de votre session
              </h2>
              <p className="text-gray-600">
                Personnalisez votre session selon vos besoins
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Titre de la session
                  </label>
                  <Input
                    {...register('title')}
                    placeholder="Ma session d'entraînement"
                    error={errors.title?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description (optionnel)
                  </label>
                  <textarea
                    {...register('description')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Décrivez vos objectifs pour cette session..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Langue
                    </label>
                    <select
                      {...register('language')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Niveau
                    </label>
                    <select
                      {...register('difficulty')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="beginner">Débutant</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="advanced">Avancé</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Durée cible (minutes)
                  </label>
                  <input
                    type="number"
                    {...register('duration_target', { valueAsNumber: true })}
                    min="5"
                    max="120"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Domaines de focus
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {focusAreas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleFocusArea(area)}
                      className={`text-left p-3 rounded-lg border text-sm transition-all ${
                        selectedFocusAreas.includes(area)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-slate-900 border-gray-300 text-slate-300 hover:border-gray-400'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'config':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                Configuration avancée
              </h2>
              <p className="text-gray-600">
                Personnalisez l'analyse et les retours
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <AnimatedCard>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-100">Analyse en temps réel</h3>
                      <p className="text-sm text-gray-600">Retours instantanés pendant l'enregistrement</p>
                    </div>
                  </div>
                  <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
                    ✓ Activé par défaut
                  </div>
                </AnimatedCard>

                <AnimatedCard>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-100">IA Avancée</h3>
                      <p className="text-sm text-gray-600">Analyse approfondie avec Gemini</p>
                    </div>
                  </div>
                  <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                    ✓ Activé par défaut
                  </div>
                </AnimatedCard>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Instructions personnalisées (optionnel)
                </label>
                <textarea
                  {...register('custom_prompt')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={6}
                  placeholder="Ajoutez des instructions spécifiques pour l'IA..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Exemple: "Concentre-toi sur l'intonation et la gestion du stress"
                </p>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Container className="py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-slate-100">
              Créer une <GradientText>nouvelle session</GradientText>
            </h1>
            <div className="text-sm text-gray-500">
              Étape {step === 'type' ? 1 : step === 'details' ? 2 : 3} sur 3
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: step === 'type' ? '33%' : step === 'details' ? '66%' : '100%' 
              }}
            />
          </div>
        </div>

        {/* Content */}
        <AnimatedCard className="mb-8">
          {renderStepContent()}
        </AnimatedCard>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={step === 'type' ? () => navigate('/dashboard') : prevStep}
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 'type' ? 'Annuler' : 'Précédent'}
          </Button>

          {step === 'config' ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmit(onSubmit)}
              loading={createSessionMutation.isPending}
              className="flex items-center"
            >
              Créer la session
              <CheckCircle className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={nextStep}
              className="flex items-center"
            >
              Suivant
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
};

export default ModernNewSessionPage;