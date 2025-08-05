import React from 'react';
import { motion } from 'framer-motion';
import AnimatedBackground from './AnimatedBackground';
import ModernSidebar from './ModernSidebar';
import ModernHeader from './ModernHeader';
import LanguageSwitcher from '../ui/LanguageSwitcher';

interface ModernLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

const ModernLayout: React.FC<ModernLayoutProps> = ({ 
  children, 
  showSidebar = true 
}) => {
  return (
    <div className="min-h-screen flex relative">
      {/* Global Animated Background */}
      <AnimatedBackground />

      {/* Sidebar */}
      {showSidebar && (
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-y-0 left-0 z-50 lg:relative lg:inset-auto"
        >
          <ModernSidebar />
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ModernHeader />
        </motion.div>

        {/* Page Content */}
        <motion.main
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex-1 overflow-auto relative z-10"
        >
          <div className="p-6">
            {/* Language Switcher - positioned in top-right */}
            <div className="absolute top-4 right-4 z-20">
              <LanguageSwitcher
                variant="compact"
                size="sm"
                position="bottom-right"
              />
            </div>
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  );
};

export default ModernLayout;