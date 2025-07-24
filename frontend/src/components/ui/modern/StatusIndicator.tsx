import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Loader2,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useMotion } from '../../../contexts/EnhancedThemeContext';

export type StatusType = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'loading' 
  | 'pending'
  | 'online'
  | 'offline'
  | 'connecting';

export type StatusSize = 'xs' | 'sm' | 'md' | 'lg';

interface StatusIndicatorProps {
  status: StatusType;
  size?: StatusSize;
  label?: string;
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
  pulse?: boolean;
  value?: number; // Pour les indicateurs avec valeur (batterie, signal, etc.)
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  label,
  showLabel = false,
  animated = true,
  className,
  pulse = false,
  value
}) => {
  const { shouldAnimate } = useMotion();

  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  const iconSizes = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          color: 'bg-green-500',
          icon: <CheckCircle className={iconSizes[size]} />,
          label: label || 'Succès'
        };
      case 'warning':
        return {
          color: 'bg-yellow-500',
          icon: <AlertCircle className={iconSizes[size]} />,
          label: label || 'Attention'
        };
      case 'error':
        return {
          color: 'bg-red-500',
          icon: <XCircle className={iconSizes[size]} />,
          label: label || 'Erreur'
        };
      case 'info':
        return {
          color: 'bg-blue-500',
          icon: <AlertCircle className={iconSizes[size]} />,
          label: label || 'Information'
        };
      case 'loading':
        return {
          color: 'bg-blue-500',
          icon: <Loader2 className={cn(iconSizes[size], 'animate-spin')} />,
          label: label || 'Chargement'
        };
      case 'pending':
        return {
          color: 'bg-gray-500',
          icon: <Clock className={iconSizes[size]} />,
          label: label || 'En attente'
        };
      case 'online':
        return {
          color: 'bg-green-500',
          icon: <Wifi className={iconSizes[size]} />,
          label: label || 'En ligne'
        };
      case 'offline':
        return {
          color: 'bg-red-500',
          icon: <WifiOff className={iconSizes[size]} />,
          label: label || 'Hors ligne'
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          icon: <Wifi className={cn(iconSizes[size], 'animate-pulse')} />,
          label: label || 'Connexion'
        };
      default:
        return {
          color: 'bg-gray-500',
          icon: null,
          label: label || 'Inconnu'
        };
    }
  };

  const config = getStatusConfig();

  const pulseVariants = {
    initial: { scale: 1, opacity: 1 },
    animate: {
      scale: [1, 1.2, 1],
      opacity: [1, 0.7, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut' as const
      }
    }
  };

  const dotVariants = {
    initial: { scale: 0 },
    animate: { 
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 20
      }
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        {/* Dot indicator */}
        <motion.div
          variants={shouldAnimate && animated ? dotVariants : {}}
          initial="initial"
          animate="animate"
          className={cn(
            sizeClasses[size],
            config.color,
            'rounded-full flex items-center justify-center'
          )}
        >
          {config.icon}
        </motion.div>

        {/* Pulse effect */}
        {pulse && shouldAnimate && (
          <motion.div
            variants={pulseVariants}
            initial="initial"
            animate="animate"
            className={cn(
              'absolute inset-0 rounded-full',
              config.color,
              'opacity-30'
            )}
          />
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span className="text-sm text-slate-300">
          {config.label}
        </span>
      )}
    </div>
  );
};

// Composant pour les indicateurs de connexion réseau
export const NetworkStatus: React.FC<{
  isOnline: boolean;
  strength?: number; // 0-100
  className?: string;
}> = ({ isOnline, strength = 100, className }) => {
  const getSignalIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    
    if (strength >= 75) return <Signal className="w-4 h-4" />;
    if (strength >= 50) return <SignalHigh className="w-4 h-4" />;
    if (strength >= 25) return <SignalMedium className="w-4 h-4" />;
    return <SignalLow className="w-4 h-4" />;
  };

  const getColor = () => {
    if (!isOnline) return 'text-red-500';
    if (strength >= 75) return 'text-green-500';
    if (strength >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={getColor()}>
        {getSignalIcon()}
      </div>
      <span className="text-xs text-slate-400">
        {isOnline ? `${strength}%` : 'Hors ligne'}
      </span>
    </div>
  );
};

// Composant pour l'indicateur de batterie
export const BatteryStatus: React.FC<{
  level: number; // 0-100
  charging?: boolean;
  className?: string;
}> = ({ level, charging = false, className }) => {
  const getColor = () => {
    if (charging) return 'text-green-500';
    if (level <= 20) return 'text-red-500';
    if (level <= 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getIcon = () => {
    if (level <= 20) return <BatteryLow className="w-4 h-4" />;
    return <Battery className="w-4 h-4" />;
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(getColor(), charging && 'animate-pulse')}>
        {getIcon()}
      </div>
      <span className="text-xs text-slate-400">
        {level}%{charging && ' ⚡'}
      </span>
    </div>
  );
};

// Composant pour les indicateurs de statut système
export const SystemStatus: React.FC<{
  cpu?: number;
  memory?: number;
  disk?: number;
  className?: string;
}> = ({ cpu = 0, memory = 0, disk = 0, className }) => {
  const getStatusColor = (value: number) => {
    if (value >= 90) return 'text-red-500';
    if (value >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const StatusBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-slate-400 w-8 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full transition-colors',
            value >= 90 ? 'bg-red-500' : 
            value >= 70 ? 'bg-yellow-500' : 'bg-green-500'
          )}
        />
      </div>
      <span className={cn('text-xs w-8 text-right', getStatusColor(value))}>
        {value}%
      </span>
    </div>
  );

  return (
    <div className={cn('space-y-2', className)}>
      <StatusBar label="CPU" value={cpu} />
      <StatusBar label="RAM" value={memory} />
      <StatusBar label="Disk" value={disk} />
    </div>
  );
};

// Composant pour les indicateurs de statut en temps réel
export const LiveStatus: React.FC<{
  status: StatusType;
  lastUpdate?: Date;
  autoRefresh?: boolean;
  className?: string;
}> = ({ status, lastUpdate, autoRefresh = false, className }) => {
  const [isLive, setIsLive] = React.useState(autoRefresh);

  React.useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setIsLive(prev => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <StatusIndicator 
        status={status} 
        pulse={isLive}
        animated
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-white">
          Statut du système
        </span>
        {lastUpdate && (
          <span className="text-xs text-slate-400">
            Mis à jour: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>
      {autoRefresh && (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live
        </div>
      )}
    </div>
  );
};

export default StatusIndicator;