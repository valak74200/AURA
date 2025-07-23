import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { Button } from '../ui';

export interface SessionTimerProps {
  targetDuration?: number; // in seconds
  onTimeUpdate?: (currentTime: number, targetTime: number) => void;
  onComplete?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  autoStart?: boolean;
  className?: string;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentTime: number;
  isComplete: boolean;
}

const SessionTimer: React.FC<SessionTimerProps> = ({
  targetDuration = 1800, // 30 minutes default
  onTimeUpdate,
  onComplete,
  onStart,
  onPause,
  onStop,
  autoStart = false,
  className = '',
}) => {
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    isPaused: false,
    currentTime: 0,
    isComplete: false,
  });

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (autoStart) {
      startTimer();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoStart]);

  useEffect(() => {
    onTimeUpdate?.(timerState.currentTime, targetDuration);
    
    if (timerState.currentTime >= targetDuration && !timerState.isComplete) {
      setTimerState(prev => ({ ...prev, isComplete: true, isRunning: false }));
      onComplete?.();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [timerState.currentTime, targetDuration, timerState.isComplete, onTimeUpdate, onComplete]);

  const startTimer = () => {
    if (timerState.isComplete) return;

    setTimerState(prev => ({ ...prev, isRunning: true, isPaused: false }));
    onStart?.();

    intervalRef.current = setInterval(() => {
      setTimerState(prev => ({
        ...prev,
        currentTime: prev.currentTime + 1,
      }));
    }, 1000);
  };

  const pauseTimer = () => {
    setTimerState(prev => ({ ...prev, isRunning: false, isPaused: true }));
    onPause?.();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopTimer = () => {
    setTimerState(prev => ({ 
      ...prev, 
      isRunning: false, 
      isPaused: false,
      currentTime: 0,
      isComplete: false,
    }));
    onStop?.();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetTimer = () => {
    setTimerState({
      isRunning: false,
      isPaused: false,
      currentTime: 0,
      isComplete: false,
    });
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const toggleTimer = () => {
    if (timerState.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return Math.min((timerState.currentTime / targetDuration) * 100, 100);
  };

  const getRemainingTime = () => {
    return Math.max(0, targetDuration - timerState.currentTime);
  };

  const getTimerColor = () => {
    const percentage = getProgressPercentage();
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 75) return 'text-orange-500';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-blue-500';
  };

  const getProgressColor = () => {
    const percentage = getProgressPercentage();
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className={`p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Timer Display */}
      <div className="text-center mb-6">
        <div className={`text-4xl font-mono font-bold mb-2 ${getTimerColor()}`}>
          {formatTime(timerState.currentTime)}
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Objectif: {formatTime(targetDuration)}
          {!timerState.isComplete && (
            <span className="ml-2">
              (Restant: {formatTime(getRemainingTime())})
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>

        {/* Status */}
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div 
            className={`w-3 h-3 rounded-full ${
              timerState.isComplete 
                ? 'bg-green-500' 
                : timerState.isRunning 
                  ? 'bg-red-500 animate-pulse' 
                  : timerState.isPaused 
                    ? 'bg-yellow-500' 
                    : 'bg-gray-400'
            }`}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {timerState.isComplete 
              ? 'Session terminée' 
              : timerState.isRunning 
                ? 'En cours' 
                : timerState.isPaused 
                  ? 'En pause' 
                  : 'Prêt à commencer'
            }
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-3">
        {!timerState.isComplete && (
          <>
            <Button
              variant={timerState.isRunning ? "secondary" : "primary"}
              size="lg"
              onClick={toggleTimer}
              className="flex items-center space-x-2"
            >
              {timerState.isRunning ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              <span>{timerState.isRunning ? 'Pause' : timerState.isPaused ? 'Reprendre' : 'Commencer'}</span>
            </Button>

            {(timerState.isRunning || timerState.isPaused) && (
              <Button
                variant="outline"
                size="lg"
                onClick={stopTimer}
                className="flex items-center space-x-2"
              >
                <Square className="w-5 h-5" />
                <span>Arrêter</span>
              </Button>
            )}
          </>
        )}

        <Button
          variant="ghost"
          size="lg"
          onClick={resetTimer}
          className="flex items-center space-x-2"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Reset</span>
        </Button>
      </div>

      {/* Completion Message */}
      {timerState.isComplete && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
          <div className="text-green-700 dark:text-green-300 font-semibold mb-2">
            🎉 Félicitations !
          </div>
          <p className="text-sm text-green-600 dark:text-green-400">
            Vous avez atteint votre objectif de {formatTime(targetDuration)}
          </p>
        </div>
      )}

      {/* Overtime Warning */}
      {timerState.currentTime > targetDuration && !timerState.isComplete && (
        <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-center">
          <div className="text-orange-700 dark:text-orange-300 font-semibold mb-2">
            ⏰ Temps dépassé
          </div>
          <p className="text-sm text-orange-600 dark:text-orange-400">
            Dépassement de {formatTime(timerState.currentTime - targetDuration)}
          </p>
        </div>
      )}
    </div>
  );
};

export default SessionTimer;