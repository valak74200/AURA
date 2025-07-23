import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Mic, 
  BarChart3, 
  Clock, 
  TrendingUp, 
  Award,
  Calendar,
  Target,
  Zap,
  ChevronRight,
  Play,
  Users,
  Book
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useSessions } from '../hooks/useSession';
import { Button, Badge, LoadingSpinner } from '../components/ui';
import Container from '../components/ui/Container';
import AnimatedCard from '../components/ui/AnimatedCard';
import { SessionStatus, SessionType } from '../types';

const ModernDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: sessions, isLoading } = useSessions({ limit: 5 });

  // Calculate real statistics from session data
  const totalSessions = sessions?.data?.length || 0;
  const completedSessions = sessions?.data?.filter(s => s.status === 'completed').length || 0;
  // For now, calculate a mock average score based on completed sessions
  const averageScore = completedSessions > 0 ? 
    Math.min(7 + (completedSessions * 0.3), 10) 
    : 0;

  const stats = [
    {
      label: t('dashboard.totalSessions'),
      value: totalSessions,
      icon: Mic,
      color: 'from-blue-500 to-blue-600',
      change: totalSessions > 0 ? `+${Math.round((totalSessions / 30) * 100)}%` : '0%'
    },
    {
      label: t('dashboard.trainingTime'),
      value: `${Math.round(completedSessions * 0.5)}h`,
      icon: Clock,
      color: 'from-green-500 to-green-600',
      change: completedSessions > 0 ? '+8%' : '0%'
    },
    {
      label: t('dashboard.averageScore'),
      value: averageScore > 0 ? averageScore.toFixed(1) : '0',
      icon: Target,
      color: 'from-purple-500 to-purple-600',
      change: averageScore > 7 ? '+15%' : '0%'
    },
    {
      label: t('dashboard.achievedGoals'),
      value: Math.floor(completedSessions / 2),
      icon: Award,
      color: 'from-orange-500 to-orange-600',
      change: completedSessions > 4 ? '+23%' : '0%'
    }
  ];

  const quickActions = [
    {
      title: t('session.express'),
      description: t('session.expressDesc'),
      icon: Zap,
      color: 'from-yellow-400 to-orange-500',
      action: () => navigate('/sessions/new')
    },
    {
      title: t('session.presentation'),
      description: t('session.presentationDesc'),
      icon: Mic,
      color: 'from-blue-500 to-purple-600',
      action: () => navigate('/sessions/new?type=presentation')
    },
    {
      title: t('session.conversation'),
      description: t('session.conversationDesc'),
      icon: Users,
      color: 'from-green-500 to-teal-600',
      action: () => navigate('/sessions/new?type=conversation')
    },
    {
      title: t('session.viewAnalytics'),
      description: t('session.viewAnalyticsDesc'),
      icon: BarChart3,
      color: 'from-purple-500 to-pink-600',
      action: () => navigate('/analytics')
    }
  ];

  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: SessionType) => {
    switch (type) {
      case 'presentation': return Mic;
      case 'conversation': return Users;
      case 'pronunciation': return Target;
      case 'reading': return Book;
      default: return Mic;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Container className="py-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">
                {t('dashboard.welcome')} {user?.username || 'Utilisateur'} ! 👋
              </h1>
              <p className="text-blue-100 mb-6 text-lg">
                {t('dashboard.subtitle')}
              </p>
              
              <Button 
                size="lg"
                variant="secondary" 
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
                onClick={() => navigate('/sessions/new')}
              >
                <Play className="w-5 h-5 mr-2" />
                {t('dashboard.createSession')}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <AnimatedCard 
              key={index} 
              delay={index * 0.1}
              className="text-center relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -mr-8 -mt-8`}></div>
              <div className="relative">
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-slate-100 mb-1">{stat.value}</div>
                <div className="text-sm text-slate-400 mb-2">{stat.label}</div>
                <div className="text-xs text-green-600 font-medium">
                  {stat.change} ce mois
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <AnimatedCard className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-100">
                  {t('dashboard.quickActions')}
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="cursor-pointer"
                    onClick={action.action}
                  >
                    <div className="p-4 rounded-xl border border-slate-700 hover:border-slate-600 hover:shadow-md transition-all duration-200 bg-slate-900/30">
                      <div className="flex items-start space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${action.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <action.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-100 mb-1">
                            {action.title}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {action.description}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatedCard>

            {/* Recent Sessions */}
            <AnimatedCard delay={0.3}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-100">
                  {t('dashboard.recentSessions')}
                </h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/sessions')}
                >
                  Voir tout
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {sessions?.data && sessions.data.length > 0 ? (
                <div className="space-y-3">
                  {sessions.data.slice(0, 3).map((session, index) => {
                    const IconComponent = getTypeIcon(session.session_type);
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/sessions/${session.id}`)}
                      >
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-100 truncate">
                            {session.title}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {new Date(session.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Mic className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-100 mb-2">
                    {t('dashboard.noSessions')}
                  </h3>
                  <p className="text-slate-400 mb-4">
                    {t('dashboard.createFirst')}
                  </p>
                  <Button 
                    variant="primary"
                    onClick={() => navigate('/sessions/new')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('dashboard.createSession')}
                  </Button>
                </div>
              )}
            </AnimatedCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Card */}
            <AnimatedCard delay={0.4}>
              <h3 className="font-semibold text-slate-100 mb-4">
                {t('dashboard.weeklyProgress')}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Objectif: 5 sessions</span>
                    <span className="font-medium text-slate-200">3/5</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Temps: 2h</span>
                    <span className="font-medium text-slate-200">1.5h/2h</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-green-500 to-teal-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </div>
            </AnimatedCard>

            {/* Achievement Card */}
            <AnimatedCard delay={0.5}>
              <h3 className="font-semibold text-slate-100 mb-4">
                {t('dashboard.lastAchievement')}
              </h3>
              
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-100">
                    Orateur Confirmé
                  </h4>
                  <p className="text-sm text-slate-400">
                    10 sessions complétées
                  </p>
                </div>
              </div>
            </AnimatedCard>

            {/* Quick Tip */}
            <AnimatedCard delay={0.6} className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-300 mb-2">
                    {t('dashboard.tipOfDay')}
                  </h4>
                  <p className="text-sm text-blue-200">
                    {t('dashboard.tip')}
                  </p>
                </div>
              </div>
            </AnimatedCard>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default ModernDashboard;