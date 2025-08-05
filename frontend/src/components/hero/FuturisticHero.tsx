import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, 
  Mic, 
  Globe, 
  BarChart3,
  Play,
  ArrowRight,
  Zap
} from 'lucide-react';

interface FuturisticHeroProps {
  onStartTrial?: () => void;
  onWatchDemo?: () => void;
}

const FuturisticHero: React.FC<FuturisticHeroProps> = ({
  onStartTrial,
  onWatchDemo
}) => {
  const { t } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut'
      }
    }
  };

  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  const features = [
    {
      icon: Sparkles,
      key: 'ai_coaching',
      color: 'text-accent-400'
    },
    {
      icon: Zap,
      key: 'realtime_feedback',
      color: 'text-neon-blue'
    },
    {
      icon: Globe,
      key: 'multilingual',
      color: 'text-secondary-400'
    },
    {
      icon: BarChart3,
      key: 'analytics',
      color: 'text-neon-purple'
    }
  ];

  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900">
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Neural Pattern Background */}
        <div className="absolute inset-0 bg-neural-pattern opacity-20" />
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-secondary-500/20 rounded-full blur-3xl animate-pulse-slow delay-500" />
        
        {/* Animated Grid Lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-400 to-transparent h-px top-1/4 animate-shimmer" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-400 to-transparent h-px top-3/4 animate-shimmer delay-1000" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary-400 to-transparent w-px left-1/4 animate-shimmer delay-500" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-blue to-transparent w-px right-1/4 animate-shimmer delay-1500" />
        </div>
      </div>

      <div className="relative container mx-auto px-6 py-20 md:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-7xl mx-auto"
        >
          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              <motion.div variants={itemVariants} className="space-y-6">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-glass-gradient border border-glass-300 backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 text-accent-400" />
                  <span className="text-sm font-medium text-gray-200">
                    {t('hero.features.ai_coaching')}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-white via-primary-200 to-accent-300 bg-clip-text text-transparent animate-gradient-shift bg-size-200">
                    {t('hero.title')}
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg md:text-xl text-gray-300 leading-relaxed max-w-2xl">
                  {t('hero.subtitle')}
                </p>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onStartTrial}
                  className="group relative px-8 py-4 bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl font-semibold text-white transition-all duration-300 hover:shadow-neon hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                  aria-label={t('hero.cta.primary')}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {t('hero.cta.primary')}
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>

                <button
                  onClick={onWatchDemo}
                  className="group px-8 py-4 bg-glass-gradient border border-glass-300 backdrop-blur-md rounded-2xl font-semibold text-white transition-all duration-300 hover:bg-glass-200 hover:border-glass-400 focus:outline-none focus:ring-2 focus:ring-glass-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                  aria-label={t('hero.cta.secondary')}
                >
                  <span className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    {t('hero.cta.secondary')}
                  </span>
                </button>
              </motion.div>

              {/* Feature Pills */}
              <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
                {features.map((feature, index) => (
                  <div
                    key={feature.key}
                    className="flex items-center gap-2 px-4 py-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-full"
                  >
                    <feature.icon className={`w-4 h-4 ${feature.color}`} />
                    <span className="text-sm text-gray-300">
                      {t(`hero.features.${feature.key}`)}
                    </span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right Column - Interactive Demo */}
            <motion.div
              variants={itemVariants}
              className="relative"
            >
              {/* Glassmorphism Container */}
              <div className="relative p-8 bg-glass-gradient border border-glass-300 backdrop-blur-xl rounded-3xl shadow-glass">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                  <div className="text-xs text-gray-400 font-mono">AI-Coach v2.1</div>
                </div>

                {/* Demo Content */}
                <div className="space-y-6">
                  {/* Voice Waveform Visualization */}
                  <div className="h-32 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-2xl p-4 flex items-center justify-center">
                    <div className="flex items-end gap-1 h-16">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-2 bg-gradient-to-t from-primary-500 to-accent-400 rounded-full"
                          initial={{ height: '20%' }}
                          animate={{ 
                            height: `${Math.random() * 80 + 20}%`,
                          }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            repeatType: 'reverse',
                            delay: i * 0.1
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                        <Mic className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-white">AI Coach</span>
                      <div className="flex gap-1">
                        <motion.div
                          className="w-1 h-1 bg-accent-400 rounded-full"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        <motion.div
                          className="w-1 h-1 bg-accent-400 rounded-full"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-1 h-1 bg-accent-400 rounded-full"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-2xl p-4">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        "Excellent pacing! Your clarity has improved by 23% in this session. 
                        Try emphasizing key words for better impact."
                      </p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Clarity', value: '92%', color: 'text-green-400' },
                      { label: 'Pace', value: '87%', color: 'text-blue-400' },
                      { label: 'Volume', value: '95%', color: 'text-purple-400' }
                    ].map((metric) => (
                      <div key={metric.label} className="text-center">
                        <div className={`text-2xl font-bold ${metric.color}`}>
                          {metric.value}
                        </div>
                        <div className="text-xs text-gray-400">{metric.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Elements */}
                <motion.div
                  variants={floatingVariants}
                  animate="animate"
                  className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-accent-500 to-primary-500 rounded-full opacity-80 blur-sm"
                />
                <motion.div
                  variants={floatingVariants}
                  animate="animate"
                  className="absolute -bottom-2 -left-2 w-6 h-6 bg-gradient-to-r from-secondary-500 to-accent-500 rounded-full opacity-60 blur-sm"
                  style={{ animationDelay: '2s' }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            {t('hero.cta.learn_more')}
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-glass-400 rounded-full flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-primary-400 rounded-full mt-2"
            />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default FuturisticHero;