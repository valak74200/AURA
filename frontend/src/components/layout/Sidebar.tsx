import React from 'react';
import { clsx } from 'clsx';
import { 
  Home, 
  Mic, 
  BarChart3, 
  Settings, 
  FileAudio, 
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { useSessionStore } from '../../store/useSessionStore';
import { Badge } from '../ui';

export interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'New Session', href: '/sessions/new', icon: Mic },
  { name: 'Sessions', href: '/sessions', icon: FileAudio },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Progress', href: '/progress', icon: TrendingUp },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ 
  className, 
  isOpen = true, 
  onClose 
}) => {
  const { currentSession, isRecording, isConnected } = useSessionStore();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        className
      )}>
        <div className="flex flex-col h-full">
          {/* Current session status */}
          {currentSession && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">
                  Current Session
                </span>
                <div className="flex items-center space-x-2">
                  {isRecording && (
                    <Badge variant="error" size="sm">
                      Recording
                    </Badge>
                  )}
                  {isConnected && (
                    <Badge variant="success" size="sm">
                      Connected
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 truncate">
                {currentSession.title}
              </p>
              <p className="text-xs text-gray-500">
                {currentSession.session_type} • {currentSession.language}
              </p>
            </div>
          )}
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </a>
              );
            })}
          </nav>
          
          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              AURA Speech Coaching v1.0
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;