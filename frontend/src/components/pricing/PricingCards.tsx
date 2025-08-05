import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Zap,
  Star,
  Crown,
  ArrowRight,
  Loader2,
  Sparkles,
  Shield,
  Users,
  Phone,
  Mail,
  MessageCircle
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  description: string;
  features: string[];
  popular?: boolean;
  premium?: boolean;
  stripePriceId?: string;
  buttonText: string;
  buttonVariant: 'primary' | 'secondary' | 'outline';
}

interface PricingCardsProps {
  billingCycle?: 'monthly' | 'yearly';
  onBillingCycleChange?: (cycle: 'monthly' | 'yearly') => void;
  onSelectPlan?: (planId: string, priceId?: string) => Promise<void>;
  currentPlan?: string;
  loading?: boolean;
  className?: string;
}

const PricingCards: React.FC<PricingCardsProps> = ({
  billingCycle = 'monthly',
  onBillingCycleChange,
  onSelectPlan,
  currentPlan,
  loading = false,
  className = ''
}) => {
  const { t } = useTranslation();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // Mock Stripe Price IDs - Replace with actual Stripe Price IDs
  const stripePriceIds = {
    pro_monthly: 'price_1234567890_monthly',
    pro_yearly: 'price_1234567890_yearly',
    enterprise_monthly: 'price_0987654321_monthly',
    enterprise_yearly: 'price_0987654321_yearly'
  };

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: t('pricing.plans.free.name'),
      price: t('pricing.plans.free.price'),
      description: t('pricing.plans.free.description'),
      features: t('pricing.plans.free.features', { returnObjects: true }) as string[],
      buttonText: t('pricing.cta.get_started'),
      buttonVariant: 'outline'
    },
    {
      id: 'pro',
      name: t('pricing.plans.pro.name'),
      price: billingCycle === 'monthly' ? t('pricing.plans.pro.price') : '€15',
      originalPrice: billingCycle === 'yearly' ? '€19' : undefined,
      description: t('pricing.plans.pro.description'),
      features: t('pricing.plans.pro.features', { returnObjects: true }) as string[],
      popular: true,
      stripePriceId: billingCycle === 'monthly' ? stripePriceIds.pro_monthly : stripePriceIds.pro_yearly,
      buttonText: currentPlan === 'pro' ? t('pricing.cta.current_plan') : t('pricing.cta.get_started'),
      buttonVariant: 'primary'
    },
    {
      id: 'enterprise',
      name: t('pricing.plans.enterprise.name'),
      price: t('pricing.plans.enterprise.price'),
      description: t('pricing.plans.enterprise.description'),
      features: t('pricing.plans.enterprise.features', { returnObjects: true }) as string[],
      premium: true,
      stripePriceId: billingCycle === 'monthly' ? stripePriceIds.enterprise_monthly : stripePriceIds.enterprise_yearly,
      buttonText: t('pricing.cta.contact_sales'),
      buttonVariant: 'secondary'
    }
  ];

  const handlePlanSelect = async (plan: PricingPlan) => {
    if (plan.id === currentPlan || !onSelectPlan) return;

    setProcessingPlan(plan.id);
    try {
      await onSelectPlan(plan.id, plan.stripePriceId);
    } catch (error) {
      console.error('Error selecting plan:', error);
    } finally {
      setProcessingPlan(null);
    }
  };

  const getPlanIcon = (plan: PricingPlan) => {
    if (plan.premium) return Crown;
    if (plan.popular) return Star;
    return Zap;
  };

  const getPlanGradient = (plan: PricingPlan) => {
    if (plan.premium) return 'from-yellow-400 to-orange-500';
    if (plan.popular) return 'from-primary-500 to-accent-500';
    return 'from-gray-600 to-gray-500';
  };

  const getCardClasses = (plan: PricingPlan) => {
    if (plan.premium) {
      return 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 shadow-neon';
    }
    if (plan.popular) {
      return 'bg-gradient-to-br from-primary-500/10 to-accent-500/10 border-primary-500/30 shadow-neon scale-105';
    }
    return 'bg-glass-gradient border-glass-300';
  };

  const getButtonClasses = (plan: PricingPlan) => {
    if (plan.id === currentPlan) {
      return 'bg-green-500/20 border-green-500/30 text-green-400 cursor-default';
    }
    
    switch (plan.buttonVariant) {
      case 'primary':
        return 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:shadow-neon hover:scale-105';
      case 'secondary':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:shadow-neon-purple hover:scale-105';
      case 'outline':
        return 'bg-glass-gradient border-glass-300 text-white hover:bg-glass-200';
      default:
        return 'bg-glass-gradient border-glass-300 text-white hover:bg-glass-200';
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          {t('pricing.title')}
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          {t('pricing.subtitle')}
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center">
        <div className="flex items-center bg-gray-800/50 rounded-xl p-1">
          <button
            onClick={() => onBillingCycleChange?.('monthly')}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              billingCycle === 'monthly'
                ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('pricing.billing.monthly')}
          </button>
          <button
            onClick={() => onBillingCycleChange?.('yearly')}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              billingCycle === 'yearly'
                ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('pricing.billing.yearly')}
            {billingCycle === 'yearly' && (
              <span className="ml-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                {t('pricing.billing.save', { percent: 20 })}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {plans.map((plan, index) => {
          const Icon = getPlanIcon(plan);
          const isProcessing = processingPlan === plan.id;
          const isCurrentPlan = currentPlan === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-8 rounded-3xl backdrop-blur-xl shadow-glass transition-all duration-300 hover:scale-105 ${getCardClasses(plan)}`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Premium Badge */}
              {plan.premium && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1">
                    <Crown className="w-4 h-4" />
                    Premium
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${getPlanGradient(plan)} mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm">{plan.description}</p>
                
                <div className="mt-6">
                  <div className="flex items-baseline justify-center gap-2">
                    {plan.originalPrice && (
                      <span className="text-gray-500 text-lg line-through">
                        {plan.originalPrice}
                      </span>
                    )}
                    <span className="text-4xl font-bold text-white">
                      {plan.price}
                    </span>
                    {plan.price !== 'Custom' && plan.price !== '0€' && (
                      <span className="text-gray-400">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>
                  {billingCycle === 'yearly' && plan.originalPrice && (
                    <p className="text-green-400 text-sm mt-2">
                      Save €{(19 - 15) * 12}/year
                    </p>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Check className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="text-gray-300 text-sm leading-relaxed">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handlePlanSelect(plan)}
                disabled={isCurrentPlan || isProcessing || loading}
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:cursor-not-allowed ${getButtonClasses(plan)}`}
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </div>
                ) : isCurrentPlan ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" />
                    {plan.buttonText}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    {plan.buttonText}
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </button>

              {/* Enterprise Contact Info */}
              {plan.id === 'enterprise' && (
                <div className="mt-6 pt-6 border-t border-gray-700/50 space-y-3">
                  <p className="text-gray-400 text-sm text-center mb-4">
                    Need a custom solution?
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <a
                      href="mailto:sales@aura.ai"
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">Email</span>
                    </a>
                    <a
                      href="tel:+1234567890"
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">Call</span>
                    </a>
                    <a
                      href="#"
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm">Chat</span>
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Trust Indicators */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-8 text-gray-400">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-sm">30-day money back</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <span className="text-sm">Instant activation</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span className="text-sm">24/7 support</span>
          </div>
        </div>
        
        <p className="text-gray-500 text-sm max-w-2xl mx-auto">
          All plans include SSL encryption, GDPR compliance, and regular security audits. 
          Cancel anytime with no hidden fees.
        </p>
      </div>
    </div>
  );
};

export default PricingCards;