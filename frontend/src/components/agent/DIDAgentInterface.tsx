import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Pause,
  Square,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Activity,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export interface DIDAgentInterfaceProps {
  agentId?: string;
  sessionId: string;
  onSessionStart?: () => void;
  onSessionStop?: () => void;
  onSessionPause?: () => void;
  onSessionResume?: () => void;
  onMuteToggle?: (muted: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  className?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type SessionStatus = 'idle' | 'active' | 'paused';

const DIDAgentInterface: React.FC<DIDAgentInterfaceProps> = ({
  agentId,
  sessionId,
  onSessionStart,
  onSessionStop,
  onSessionPause,
  onSessionResume,
  onMuteToggle,
  onVolumeChange,
  className = ''
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  // Mock data for demonstration
  const [mockData, setMockData] = useState({
    agentName: "AURA Coach",
    sessionTime: 0,
    isListening: false
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionStatus === 'active') {
      interval = setInterval(() => {
        setMockData(prev => ({
          ...prev,
          sessionTime: prev.sessionTime + 1
        }));
        // Simulate audio level fluctuation
        setAudioLevel(Math.random() * 100);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionStatus]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSession = () => {
    setConnectionStatus('connecting');
    setTimeout(() => {
      setConnectionStatus('connected');
      setSessionStatus('active');
      onSessionStart?.();
    }, 2000);
  };

  const handleStopSession = () => {
    setSessionStatus('idle');
    setConnectionStatus('disconnected');
    setMockData(prev => ({ ...prev, sessionTime: 0 }));
    onSessionStop?.();
  };

  const handlePauseResume = () => {
    if (sessionStatus === 'active') {
      setSessionStatus('paused');
      onSessionPause?.();
    } else if (sessionStatus === 'paused') {
      setSessionStatus('active');
      onSessionResume?.();
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    onMuteToggle?.(newMutedState);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    onVolumeChange?.(newVolume);
  };

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return CheckCircle2;
      case 'connecting':
        return Loader2;
      case 'error':
        return AlertCircle;
      default:
        return Activity;
    }
  };

  return (
    <div className={`relative bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-3xl overflow-hidden shadow-glass ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-glass-300">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <motion.div
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${
                connectionStatus === 'connected' ? 'bg-green-400' :
                connectionStatus === 'connecting' ? 'bg-yellow-400' :
                connectionStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
              }`}
              animate={connectionStatus === 'connecting' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t('agent.title')}</h3>
            <p className="text-sm text-gray-400">{mockData.agentName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-full">
            {React.createElement(getStatusIcon(connectionStatus), {
              className: `w-4 h-4 ${getStatusColor(connectionStatus)} ${
                connectionStatus === 'connecting' ? 'animate-spin' : ''
              }`
            })}
            <span className={`text-xs font-medium ${getStatusColor(connectionStatus)}`}>
              {t(`agent.status.${connectionStatus}`)}
            </span>
          </div>

          {/* Settings */}
          <button
            className="p-2 hover:bg-glass-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
            aria-label={t('common.settings')}
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800">
        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted={isMuted}
          playsInline
        >
          {/* Placeholder for D-ID video stream */}
        </video>

        {/* Video Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Connection Status Overlay */}
        <AnimatePresence>
          {connectionStatus === 'connecting' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm"
            >
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto" />
                <p className="text-white font-medium">{t('agent.status.connecting')}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audio Level Indicator */}
        {sessionStatus === 'active' && (
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg">
              <Mic className="w-4 h-4 text-green-400" />
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-4 rounded-full transition-colors ${
                      audioLevel > (i * 20) ? 'bg-green-400' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Session Timer */}
        {sessionStatus !== 'idle' && (
          <div className="absolute top-4 left-4">
            <div className="px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg">
              <span className="text-white font-mono text-sm">
                {formatTime(mockData.sessionTime)}
              </span>
            </div>
          </div>
        )}

        {/* Control Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-0 left-0 right-0 p-6"
              onMouseLeave={() => sessionStatus === 'active' && setShowControls(false)}
            >
              <div className="flex items-center justify-between">
                {/* Main Controls */}
                <div className="flex items-center gap-3">
                  {sessionStatus === 'idle' ? (
                    <button
                      onClick={handleStartSession}
                      disabled={connectionStatus === 'connecting'}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold text-white transition-all duration-300 hover:shadow-neon hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-400"
                      aria-label={t('agent.controls.start')}
                    >
                      <Play className="w-5 h-5" />
                      {t('agent.controls.start')}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handlePauseResume}
                        className="p-3 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-xl transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
                        aria-label={sessionStatus === 'active' ? t('agent.controls.pause') : t('agent.controls.resume')}
                      >
                        {sessionStatus === 'active' ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white" />
                        )}
                      </button>

                      <button
                        onClick={handleStopSession}
                        className="p-3 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-xl transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                        aria-label={t('agent.controls.stop')}
                      >
                        <Square className="w-5 h-5 text-red-400" />
                      </button>
                    </>
                  )}
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center gap-3">
                  {/* Mute Toggle */}
                  <button
                    onClick={handleMuteToggle}
                    className="p-3 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-xl transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    aria-label={isMuted ? t('agent.controls.unmute') : t('agent.controls.mute')}
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-red-400" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>

                  {/* Volume Control */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-xl">
                    <Volume2 className="w-4 h-4 text-gray-400" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                      aria-label="Volume"
                    />
                    <span className="text-xs text-gray-400 w-8 text-right">{volume}%</span>
                  </div>

                  {/* Fullscreen Toggle */}
                  <button
                    onClick={handleFullscreenToggle}
                    className="p-3 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-xl transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    aria-label={isFullscreen ? t('agent.controls.exit_fullscreen') : t('agent.controls.fullscreen')}
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5 text-white" />
                    ) : (
                      <Maximize className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show controls on hover */}
        <div
          className="absolute inset-0"
          onMouseEnter={() => setShowControls(true)}
        />
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-glass-300">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Activity className="w-4 h-4" />
            <span>Session ID: {sessionId.substring(0, 8)}...</span>
          </div>
          <div className="text-gray-400">
            {t('agent.subtitle')}
          </div>
        </div>
      </div>

      {/* Custom CSS for range slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0087ff, #d946ef);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0087ff, #d946ef);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default DIDAgentInterface;