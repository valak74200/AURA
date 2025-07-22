'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Mic, 
  Calendar,
  Award,
  Target,
  ArrowLeft,
  Play,
  MoreVertical,
  Download
} from 'lucide-react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

// Mock data for demonstration
const performanceData = [
  { date: '2024-01-01', clarity: 75, pace: 68, volume: 82 },
  { date: '2024-01-02', clarity: 78, pace: 72, volume: 85 },
  { date: '2024-01-03', clarity: 82, pace: 75, volume: 88 },
  { date: '2024-01-04', clarity: 85, pace: 78, volume: 90 },
  { date: '2024-01-05', clarity: 88, pace: 82, volume: 92 },
  { date: '2024-01-06', clarity: 90, pace: 85, volume: 94 },
  { date: '2024-01-07', clarity: 92, pace: 88, volume: 96 },
]

const recentSessions = [
  {
    id: 1,
    title: 'Présentation Projet Q4',
    date: '2024-01-07',
    duration: '12:34',
    score: 92,
    status: 'completed'
  },
  {
    id: 2,
    title: 'Formation Équipe',
    date: '2024-01-06',
    duration: '08:45',
    score: 88,
    status: 'completed'
  },
  {
    id: 3,
    title: 'Pitch Client',
    date: '2024-01-05',
    duration: '15:22',
    score: 85,
    status: 'completed'
  },
  {
    id: 4,
    title: 'Réunion Mensuelle',
    date: '2024-01-04',
    duration: '06:18',
    score: 78,
    status: 'completed'
  }
]

const achievements = [
  {
    id: 1,
    title: 'Premier Pas',
    description: 'Complétez votre première session',
    icon: '🎯',
    unlocked: true,
    date: '2024-01-01'
  },
  {
    id: 2,
    title: 'Orateur Consistant',
    description: '7 jours consécutifs de pratique',
    icon: '🔥',
    unlocked: true,
    date: '2024-01-07'
  },
  {
    id: 3,
    title: 'Maître de la Clarté',
    description: 'Atteignez 90% de clarté',
    icon: '💎',
    unlocked: true,
    date: '2024-01-06'
  },
  {
    id: 4,
    title: 'Marathon Orateur',
    description: 'Session de plus de 30 minutes',
    icon: '🏃‍♂️',
    unlocked: false,
    date: null
  }
]

export default function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [stats, setStats] = useState({
    totalSessions: 24,
    totalTime: '4h 32m',
    averageScore: 87,
    improvement: '+12%'
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 75) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="btn-secondary p-2">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Tableau de Bord</h1>
              <p className="text-gray-400">Suivez vos progrès et performances</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">3 derniers mois</option>
            </select>
            <Link href="/session" className="btn-primary">
              <Play className="mr-2 w-4 h-4" />
              Nouvelle Session
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Sessions Totales</p>
                <p className="text-2xl font-bold text-white">{stats.totalSessions}</p>
              </div>
              <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                <Mic className="w-6 h-6 text-primary-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Temps Total</p>
                <p className="text-2xl font-bold text-white">{stats.totalTime}</p>
              </div>
              <div className="w-12 h-12 bg-accent-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Score Moyen</p>
                <p className="text-2xl font-bold text-white">{stats.averageScore}%</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Amélioration</p>
                <p className="text-2xl font-bold text-green-400">{stats.improvement}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Performance Chart */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <BarChart3 className="mr-2 w-5 h-5" />
                  Évolution des Performances
                </h2>
                <button className="btn-secondary p-2">
                  <Download className="w-4 h-4" />
                </button>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      stroke="#9CA3AF"
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="clarity" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      name="Clarté"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pace" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      name="Rythme"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="volume" 
                      stroke="#8B5CF6" 
                      strokeWidth={2}
                      name="Volume"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Recent Sessions */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <Calendar className="mr-2 w-5 h-5" />
                  Sessions Récentes
                </h2>
                <button className="btn-secondary p-2">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {recentSessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-medium text-sm">{session.title}</h3>
                      <span className={`text-sm font-semibold ${getScoreColor(session.score)}`}>
                        {session.score}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{formatDate(session.date)}</span>
                      <span>{session.duration}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button className="w-full mt-4 text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                Voir toutes les sessions
              </button>
            </motion.div>
          </div>
        </div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Award className="mr-2 w-5 h-5" />
              Réalisations
            </h2>
            <span className="text-sm text-gray-400">
              {achievements.filter(a => a.unlocked).length} / {achievements.length} débloquées
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className={`p-4 rounded-lg border transition-all ${
                  achievement.unlocked
                    ? 'bg-gradient-to-br from-primary-500/20 to-accent-500/20 border-primary-500/30'
                    : 'bg-gray-500/10 border-gray-500/20'
                }`}
              >
                <div className="text-center">
                  <div className={`text-3xl mb-2 ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
                    {achievement.icon}
                  </div>
                  <h3 className={`font-semibold mb-1 ${achievement.unlocked ? 'text-white' : 'text-gray-400'}`}>
                    {achievement.title}
                  </h3>
                  <p className="text-xs text-gray-400 mb-2">
                    {achievement.description}
                  </p>
                  {achievement.unlocked && achievement.date && (
                    <p className="text-xs text-primary-400">
                      Débloqué le {formatDate(achievement.date)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}