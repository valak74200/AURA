import React from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Mic, 
  BarChart3, 
  Settings, 
  LogOut,
  User,
  Zap,
  Waves
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { ModernButton } from '../ui/modern';

const ModernSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { t } = useLanguage();

  const menuItems = [
    {
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      path: '/dashboard',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      label: t('nav.sessions'),
      icon: Mic,
      path: '/sessions',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      label: t('nav.analytics'),
      icon: BarChart3,
      path: '/analytics',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      label: t('nav.settings'),
      icon: Settings,
      path: '/settings',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="w-72 h-full glass-strong border-r border-slate-700/50 flex flex-col">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 border-b border-slate-700/50"
      >
        <div className="flex items-center space-x-3">
          <motion.div
            className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Waves className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-gradient">AURA</h1>
            <p className="text-xs text-slate-400 font-medium">AI Voice Coach</p>
          </div>
        </div>
      </motion.div>

      {/* User Info */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 border-b border-slate-700/50"
      >
        <div className="flex items-center space-x-3">
          <motion.div
            className="w-12 h-12 bg-gradient-to-r from-slate-700 to-slate-600 rounded-xl flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
          >
            <User className="w-6 h-6 text-slate-300" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {user?.username || 'Utilisateur'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.email || 'user@example.com'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick Action */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 border-b border-slate-700/50"
      >
        <ModernButton
          variant="primary"
          fullWidth
          glow
          icon={<Zap className="w-5 h-5" />}
          onClick={() => navigate('/sessions/new')}
          className="justify-center"
        >
          {t('nav.newSession')}
        </ModernButton>
      </motion.div>

      {/* Navigation */}
      <nav className="flex-1 p-6">
        <div className="space-y-2">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ x: 8, scale: 1.04, boxShadow: "0 4px 24px 0 rgba(80,80,255,0.10)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 group shadow-none ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-white border border-blue-500/40 shadow-xl ring-2 ring-blue-400/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 hover:shadow-lg'
                }`}
                style={{
                  backdropFilter: isActive ? "blur(6px)" : undefined,
                  WebkitBackdropFilter: isActive ? "blur(6px)" : undefined,
                }}
              >
                <motion.div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? `bg-gradient-to-r ${item.gradient} shadow-lg`
                      : 'bg-slate-800 group-hover:bg-slate-700'
                  }`}
                  whileHover={isActive ? { scale: 1.08, rotate: 3 } : { scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                </motion.div>
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-2 h-2 bg-blue-400 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Logout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="p-6 border-t border-slate-700/50"
      >
        <motion.button
          whileHover={{ x: 4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-red-500/20 flex items-center justify-center transition-all duration-200">
            <LogOut className="w-5 h-5" />
          </div>
          <span className="font-medium">{t('nav.logout')}</span>
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ModernSidebar;