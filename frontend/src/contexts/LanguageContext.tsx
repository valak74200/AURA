import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage } from '../types';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Traductions
const translations = {
  fr: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.sessions': 'Sessions',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Paramètres',
    'nav.logout': 'Se déconnecter',
    'nav.newSession': 'Nouvelle session',
    
    // Dashboard
    'dashboard.welcome': 'Bonjour',
    'dashboard.subtitle': 'Prêt à perfectionner votre élocution aujourd\'hui ?',
    'dashboard.totalSessions': 'Sessions totales',
    'dashboard.trainingTime': 'Temps d\'entraînement',
    'dashboard.averageScore': 'Score moyen',
    'dashboard.achievedGoals': 'Objectifs atteints',
    'dashboard.quickActions': 'Actions rapides',
    'dashboard.recentSessions': 'Sessions récentes',
    'dashboard.noSessions': 'Aucune session encore',
    'dashboard.createFirst': 'Commencez votre première session d\'entraînement !',
    'dashboard.createSession': 'Créer une session',
    'dashboard.weeklyProgress': 'Progression hebdomadaire',
    'dashboard.lastAchievement': 'Dernier succès',
    'dashboard.tipOfDay': 'Conseil du jour',
    'dashboard.tip': 'Prenez une pause de 2 secondes entre vos phrases pour améliorer la clarté de votre discours.',
    
    // Auth
    'auth.welcome': 'Bon retour sur',
    'auth.join': 'Rejoignez',
    'auth.loginSubtitle': 'Connectez-vous pour continuer votre progression',
    'auth.registerSubtitle': 'Commencez votre parcours vers une meilleure élocution',
    'auth.login': 'Se connecter',
    'auth.register': 'Créer mon compte',
    'auth.hasAccount': 'Déjà un compte ?',
    'auth.noAccount': 'Pas encore de compte ?',
    'auth.createAccount': 'Créer un compte',
    
    // Sessions
    'session.express': 'Session Express',
    'session.expressDesc': 'Entraînement rapide de 10 minutes',
    'session.presentation': 'Présentation',
    'session.presentationDesc': 'Préparer une présentation importante',
    'session.conversation': 'Conversation',
    'session.conversationDesc': 'Améliorer votre conversation',
    'session.viewAnalytics': 'Voir Analytics',
    'session.viewAnalyticsDesc': 'Analyser vos progrès détaillés',
    
    // Settings
    'settings.title': 'Paramètres',
    'settings.subtitle': 'Gérez votre compte et vos préférences',
    'settings.language': 'Langue',
    'settings.french': 'Français',
    'settings.english': 'English',
    'settings.updated': 'Préférences mises à jour !',
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.sessions': 'Sessions',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    'nav.logout': 'Sign out',
    'nav.newSession': 'New session',
    
    // Dashboard
    'dashboard.welcome': 'Hello',
    'dashboard.subtitle': 'Ready to perfect your speech today?',
    'dashboard.totalSessions': 'Total sessions',
    'dashboard.trainingTime': 'Training time',
    'dashboard.averageScore': 'Average score',
    'dashboard.achievedGoals': 'Goals achieved',
    'dashboard.quickActions': 'Quick actions',
    'dashboard.recentSessions': 'Recent sessions',
    'dashboard.noSessions': 'No sessions yet',
    'dashboard.createFirst': 'Start your first training session!',
    'dashboard.createSession': 'Create session',
    'dashboard.weeklyProgress': 'Weekly progress',
    'dashboard.lastAchievement': 'Last achievement',
    'dashboard.tipOfDay': 'Tip of the day',
    'dashboard.tip': 'Take a 2-second pause between sentences to improve speech clarity.',
    
    // Auth
    'auth.welcome': 'Welcome back to',
    'auth.join': 'Join',
    'auth.loginSubtitle': 'Sign in to continue your progress',
    'auth.registerSubtitle': 'Start your journey to better speech',
    'auth.login': 'Sign in',
    'auth.register': 'Create account',
    'auth.hasAccount': 'Already have an account?',
    'auth.noAccount': 'Don\'t have an account?',
    'auth.createAccount': 'Create account',
    
    // Sessions
    'session.express': 'Express Session',
    'session.expressDesc': '10-minute quick training',
    'session.presentation': 'Presentation',
    'session.presentationDesc': 'Prepare an important presentation',
    'session.conversation': 'Conversation',
    'session.conversationDesc': 'Improve your conversation skills',
    'session.viewAnalytics': 'View Analytics',
    'session.viewAnalyticsDesc': 'Analyze your detailed progress',
    
    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your account and preferences',
    'settings.language': 'Language',
    'settings.french': 'Français',
    'settings.english': 'English',
    'settings.updated': 'Preferences updated!',
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('fr');

  useEffect(() => {
    // Récupérer la langue depuis localStorage ou les préférences utilisateur
    const savedLanguage = localStorage.getItem('aura_language') as SupportedLanguage;
    if (savedLanguage && ['fr', 'en'].includes(savedLanguage)) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('aura_language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};