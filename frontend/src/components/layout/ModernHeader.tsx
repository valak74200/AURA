import React from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  User, 
  ChevronDown,
  Mic,
  BarChart3,
  Settings,
  Calendar,
  Award,
  LayoutDashboard,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { ModernButton, ModernBadge } from '../ui/modern';

const ModernHeader: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { t } = useLanguage();

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/dashboard':
        return { title: t('nav.dashboard'), icon: LayoutDashboard, subtitle: t('dashboard.subtitle') };
      case '/sessions':
        return { title: t('nav.sessions'), icon: Mic, subtitle: 'Gérez vos sessions d\'entraînement' };
      case '/sessions/new':
        return { title: t('nav.newSession'), icon: Mic, subtitle: 'Créez une session personnalisée' };
      case '/analytics':
        return { title: t('nav.analytics'), icon: BarChart3, subtitle: 'Analysez vos performances' };
      case '/settings':
        return { title: t('nav.settings'), icon: Settings, subtitle: 'Configurez votre compte' };
      case '/calendar':
        return { title: 'Calendrier', icon: Calendar, subtitle: 'Planifiez vos sessions' };
      case '/achievements':
        return { title: 'Succès', icon: Award, subtitle: 'Vos accomplissements' };
      default:
        if (location.pathname.startsWith('/sessions/')) {
          return { title: 'Session', icon: Mic, subtitle: 'Session d\'entraînement' };
        }
        return { title: 'AURA', icon: Sparkles, subtitle: 'Coach vocal IA' };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="glass border-b border-slate-700/50 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Page Info */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center space-x-4"
        >
          <motion.div
            className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <pageInfo.icon className="w-6 h-6 text-blue-400" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-white">{pageInfo.title}</h1>
            <p className="text-sm text-slate-400">{pageInfo.subtitle}</p>
          </div>
        </motion.div>

        {/* Right Side */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative hidden md:block"
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher..."
              className="block w-64 pl-10 pr-3 py-2.5 border border-slate-600 rounded-xl leading-5 bg-slate-800/50 backdrop-blur-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ModernButton
              variant="ghost"
              size="sm"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </ModernButton>
          </motion.div>

          {/* User Menu */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center space-x-3 p-2 rounded-xl hover:bg-slate-800/50 transition-all duration-200 group"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold text-white">
                  {user?.username || 'Utilisateur'}
                </div>
                <ModernBadge variant="success" size="sm">
                  En ligne
                </ModernBadge>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </header>
  );
};

export default ModernHeader;