'use client'

import { motion } from 'framer-motion'
import { Mic, Sparkles, TrendingUp, Users, ArrowRight, Play, Star, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const features = [
  {
    icon: Mic,
    title: 'Analyse Vocale Temps Réel',
    description: 'Analysez votre rythme, volume, clarté et intonation en temps réel avec notre IA avancée.',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Sparkles,
    title: 'Feedback IA Personnalisé',
    description: 'Recevez des conseils personnalisés générés par Gemini pour améliorer votre présentation.',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: TrendingUp,
    title: 'Métriques de Performance',
    description: 'Suivez vos progrès avec des métriques détaillées et des analyses de tendances.',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: Users,
    title: 'Coaching Interactif',
    description: 'Bénéficiez d\'un coaching interactif avec des suggestions en temps réel.',
    color: 'from-orange-500 to-red-500'
  }
]

const testimonials = [
  {
    name: 'Marie Dubois',
    role: 'Directrice Marketing',
    content: 'AURA a transformé ma façon de présenter. Les feedbacks en temps réel m\'ont aidée à gagner en confiance.',
    rating: 5,
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'
  },
  {
    name: 'Thomas Martin',
    role: 'Consultant',
    content: 'L\'analyse vocale est impressionnante. J\'ai amélioré mon débit et ma clarté en quelques sessions.',
    rating: 5,
    avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'
  },
  {
    name: 'Sophie Laurent',
    role: 'Formatrice',
    content: 'Un outil révolutionnaire pour tous ceux qui veulent exceller dans l\'art de la présentation.',
    rating: 5,
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'
  }
]

const stats = [
  { number: '10K+', label: 'Utilisateurs actifs' },
  { number: '50K+', label: 'Sessions complétées' },
  { number: '95%', label: 'Satisfaction client' },
  { number: '24/7', label: 'Support disponible' }
]

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AURA</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-4"
            >
              <Link href="/dashboard" className="btn-secondary">
                Tableau de bord
              </Link>
              <Link href="/session" className="btn-primary">
                Commencer
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                Maîtrisez l'art de la
                <span className="gradient-text block">Présentation</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                AURA utilise l'intelligence artificielle pour analyser votre voix en temps réel 
                et vous donner des conseils personnalisés pour devenir un orateur exceptionnel.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <Link href="/session" className="btn-primary text-lg px-8 py-4 group">
                Commencer maintenant
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="btn-secondary text-lg px-8 py-4 group">
                <Play className="mr-2 w-5 h-5" />
                Voir la démo
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                    {stat.number}
                  </div>
                  <div className="text-gray-400">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Fonctionnalités Avancées
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Découvrez comment AURA révolutionne l'apprentissage de la présentation 
              avec des technologies d'IA de pointe.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="card group hover:scale-105 cursor-pointer"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ce que disent nos utilisateurs
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Rejoignez des milliers de professionnels qui ont transformé 
              leurs compétences de présentation avec AURA.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="card"
              >
                <div className="flex items-center mb-4">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="text-white font-semibold">{testimonial.name}</h4>
                    <p className="text-gray-400 text-sm">{testimonial.role}</p>
                  </div>
                </div>
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 leading-relaxed">
                  "{testimonial.content}"
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="card text-center bg-gradient-to-r from-primary-600/20 to-accent-600/20 border-primary-500/30"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Prêt à transformer vos présentations ?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Rejoignez AURA dès aujourd'hui et découvrez comment l'IA peut 
              vous aider à devenir un orateur exceptionnel.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/session" className="btn-primary text-lg px-8 py-4">
                Commencer gratuitement
              </Link>
              <Link href="/pricing" className="btn-secondary text-lg px-8 py-4">
                Voir les tarifs
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AURA</span>
            </div>
            <div className="text-gray-400 text-center md:text-right">
              <p>&copy; 2024 AURA. Tous droits réservés.</p>
              <p className="text-sm mt-1">Propulsé par l'intelligence artificielle</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}