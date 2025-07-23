import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, 
  BarChart3, 
  Users, 
  Zap, 
  CheckCircle, 
  Star,
  ArrowRight,
  Play,
  Globe,
  Brain,
  Target
} from 'lucide-react';
import { Button } from '../components/ui';
import Container from '../components/ui/Container';
import AnimatedCard from '../components/ui/AnimatedCard';
import GradientText from '../components/ui/GradientText';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: 'IA Avancée',
      description: 'Analyse intelligente de votre élocution avec des retours personnalisés en temps réel.'
    },
    {
      icon: Globe,
      title: 'Multilingue',
      description: 'Entraînement en français et anglais avec adaptation culturelle.'
    },
    {
      icon: Target,
      title: 'Objectifs Personnalisés',
      description: 'Plans d\'entraînement adaptés à vos besoins spécifiques.'
    },
    {
      icon: BarChart3,
      title: 'Analyse Détaillée',
      description: 'Métriques complètes sur votre progression et vos performances.'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Martin',
      role: 'Directrice Marketing',
      content: 'AURA m\'a aidée à perfectionner mes présentations. Mes collègues ont remarqué la différence !',
      rating: 5
    },
    {
      name: 'Thomas Dubois',
      role: 'Consultant',
      content: 'L\'analyse en temps réel est impressionnante. C\'est comme avoir un coach personnel.',
      rating: 5
    },
    {
      name: 'Marie Chen',
      role: 'Étudiante',
      content: 'Parfait pour améliorer mon anglais. L\'interface est intuitive et motivante.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-gray-100 z-50">
        <Container className="flex items-center justify-between py-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">AURA</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login')}
            >
              Se connecter
            </Button>
            <Button 
              variant="primary"
              onClick={() => navigate('/register')}
            >
              Commencer gratuitement
            </Button>
          </div>
        </Container>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Container>
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Perfectionnez votre{' '}
                <GradientText>élocution</GradientText>
                {' '}avec l'IA
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                AURA utilise l'intelligence artificielle pour analyser votre discours en temps réel 
                et vous aider à devenir un orateur plus confiant et efficace.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  variant="primary"
                  className="text-lg px-8 py-4"
                  onClick={() => navigate('/register')}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Essayer gratuitement
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-4"
                >
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Voir la démo
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-16"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl"></div>
                <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-8">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-semibold text-gray-900">Session d'entraînement</div>
                      <div className="text-gray-600">Analyse en temps réel</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">95%</div>
                      <div className="text-sm text-gray-600">Clarté</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">120</div>
                      <div className="text-sm text-gray-600">Mots/min</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">8.5</div>
                      <div className="text-sm text-gray-600">Score</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <Container>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Pourquoi choisir <GradientText>AURA</GradientText> ?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Notre plateforme combine technologies avancées et pédagogie moderne 
              pour une expérience d'apprentissage unique.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <AnimatedCard key={index} delay={index * 0.1} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </AnimatedCard>
            ))}
          </div>
        </Container>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <Container>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Ce que disent nos utilisateurs
            </h2>
            <p className="text-xl text-gray-600">
              Rejoignez des milliers d'utilisateurs qui ont transformé leur élocution avec AURA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <AnimatedCard key={index} delay={index * 0.15}>
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "{testimonial.content}"
                </p>
                <div className="border-t pt-4">
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-600">
        <Container>
          <div className="text-center text-white">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Prêt à transformer votre élocution ?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Commencez votre parcours vers une communication plus efficace dès aujourd'hui.
              </p>
              
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8 py-4 bg-white text-blue-600 hover:bg-blue-50"
                onClick={() => navigate('/register')}
              >
                Commencer maintenant
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <Container>
          <div className="text-center text-gray-400">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AURA</span>
            </div>
            <p>&copy; 2024 AURA. Tous droits réservés.</p>
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default LandingPage;