import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Star,
  Crown,
  Shield,
  Zap,
  Users,
  MessageCircle,
  Phone,
  Mail,
  AlertCircle,
  CreditCard,
  Gift
} from 'lucide-react';
import PricingCards from '../components/pricing/PricingCards';
import { Button, Card, Badge } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  const handlePlanSelect = async (planId: string, priceId?: string) => {
    setLoading(true);
    try {
      // In a real app, this would integrate with Stripe or another payment processor
      console.log('Selected plan:', { planId, priceId });
      
      if (planId === 'free') {
        // For free plan, just redirect to registration or dashboard
        if (isAuthenticated) {
          navigate('/dashboard');
        } else {
          navigate('/register');
        }
      } else if (planId === 'enterprise') {
        // For enterprise, redirect to contact form or open modal
        window.open('mailto:sales@aura.ai?subject=Enterprise Plan Inquiry', '_blank');
      } else {
        // For paid plans, integrate with Stripe
        if (!isAuthenticated) {
          navigate('/register?plan=' + planId);
        } else {
          // Redirect to Stripe Checkout or show upgrade modal
          alert('Stripe integration would go here. Plan: ' + planId);
        }
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Crown,
      title: 'Premium Features',
      description: 'Access to all advanced coaching features and personalized feedback'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level encryption and GDPR compliance for your data protection'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Real-time AI analysis with sub-second response times'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Share sessions and progress with coaches and team members'
    }
  ];

  const faqs = [
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access to premium features until the end of your billing period.'
    },
    {
      question: 'Do you offer refunds?',
      answer: 'We offer a 30-day money-back guarantee. If you\'re not satisfied with AURA, contact us within 30 days for a full refund.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for enterprise customers.'
    },
    {
      question: 'Is there a free trial?',
      answer: 'Yes! Our free plan includes basic features. You can upgrade to Pro or Enterprise anytime to unlock advanced capabilities.'
    },
    {
      question: 'Can I change plans later?',
      answer: 'Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900">
      {/* Header */}
      <div className="p-6 border-b border-glass-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
              
              <div className="w-px h-6 bg-gray-600" />
              
              <div>
                <h1 className="text-2xl font-bold text-white">Pricing Plans</h1>
                <p className="text-gray-400">Choose the perfect plan for your needs</p>
              </div>
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <Badge variant="success">
                  <Users className="w-3 h-3 mr-1" />
                  Signed in as {user?.username}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Pricing Cards Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <PricingCards
            billingCycle={billingCycle}
            onBillingCycleChange={setBillingCycle}
            onSelectPlan={handlePlanSelect}
            currentPlan={user?.planId || undefined}
            loading={loading}
          />
        </motion.div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-16"
        >
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Why Choose AURA?
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Our platform combines cutting-edge AI technology with proven coaching methodologies 
              to deliver unprecedented results in speech improvement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 text-center h-full">
                  <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-16"
        >
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-400">
              Got questions? We've got answers.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {faq.answer}
                </p>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Support Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mb-16"
        >
          <Card className="p-8">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  Need Help Choosing a Plan?
                </h2>
                <p className="text-gray-400 max-w-2xl mx-auto">
                  Our team is here to help you find the perfect plan for your needs. 
                  Get in touch with us for personalized recommendations.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="primary"
                  onClick={() => window.open('mailto:support@aura.ai', '_blank')}
                  className="flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Email Support
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => window.open('tel:+1234567890', '_blank')}
                  className="flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Call Us
                </Button>
                
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Live Chat
                </Button>
              </div>

              <div className="pt-6 border-t border-gray-700">
                <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span>SSL Secured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span>Secure Payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-purple-400" />
                    <span>30-Day Guarantee</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Card className="p-8 bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-primary-500/30">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  Ready to Transform Your Speaking Skills?
                </h2>
                <p className="text-gray-300 max-w-2xl mx-auto">
                  Join thousands of users who have already improved their communication 
                  skills with AURA's AI-powered coaching platform.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => handlePlanSelect('pro')}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Star className="w-5 h-5" />
                  Start with Pro Plan
                </Button>
                
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handlePlanSelect('free')}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  Try Free Plan
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default PricingPage;