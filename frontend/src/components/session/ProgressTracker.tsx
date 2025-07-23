import React from 'react';
import { CheckCircle, Circle, Clock, Target, TrendingUp } from 'lucide-react';

export interface ProgressStep {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  isActive: boolean;
  duration?: number;
  score?: number;
}

export interface ProgressTrackerProps {
  steps: ProgressStep[];
  className?: string;
  variant?: 'vertical' | 'horizontal';
  showScores?: boolean;
  onStepClick?: (stepId: string) => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  steps,
  className = '',
  variant = 'vertical',
  showScores = false,
  onStepClick,
}) => {
  const completedSteps = steps.filter(step => step.isCompleted).length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const renderVerticalProgress = () => (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Progression de la session
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Target className="w-4 h-4" />
            <span>{completedSteps}/{totalSteps}</span>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {Math.round(progressPercentage)}% terminé
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
              step.isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                : step.isCompleted
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-gray-50 dark:bg-gray-800'
            } ${onStepClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}`}
            onClick={() => onStepClick?.(step.id)}
          >
            {/* Step Icon */}
            <div className="flex-shrink-0 mt-1">
              {step.isCompleted ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : step.isActive ? (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              ) : (
                <Circle className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className={`font-medium truncate ${
                  step.isActive
                    ? 'text-blue-700 dark:text-blue-300'
                    : step.isCompleted
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {step.title}
                </h4>
                
                {/* Duration and Score */}
                <div className="flex items-center space-x-3 text-xs">
                  {step.duration && (
                    <div className="flex items-center space-x-1 text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(step.duration)}</span>
                    </div>
                  )}
                  
                  {showScores && step.score !== undefined && (
                    <div className={`flex items-center space-x-1 ${getScoreColor(step.score)}`}>
                      <TrendingUp className="w-3 h-3" />
                      <span>{step.score}%</span>
                    </div>
                  )}
                </div>
              </div>
              
              {step.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHorizontalProgress = () => (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Progression: {completedSteps}/{totalSteps}
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {Math.round(progressPercentage)}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between space-x-2 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex-shrink-0 text-center p-3 rounded-lg min-w-0 ${
              step.isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                : step.isCompleted
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-gray-50 dark:bg-gray-800'
            } ${onStepClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}`}
            onClick={() => onStepClick?.(step.id)}
            style={{ minWidth: '120px' }}
          >
            {/* Step Icon */}
            <div className="flex justify-center mb-2">
              {step.isCompleted ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : step.isActive ? (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              ) : (
                <Circle className="w-6 h-6 text-gray-400" />
              )}
            </div>

            {/* Step Title */}
            <h4 className={`font-medium text-sm truncate mb-1 ${
              step.isActive
                ? 'text-blue-700 dark:text-blue-300'
                : step.isCompleted
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-gray-700 dark:text-gray-300'
            }`}>
              {step.title}
            </h4>

            {/* Metrics */}
            <div className="space-y-1">
              {step.duration && (
                <div className="flex items-center justify-center space-x-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(step.duration)}</span>
                </div>
              )}
              
              {showScores && step.score !== undefined && (
                <div className={`flex items-center justify-center space-x-1 text-xs ${getScoreColor(step.score)}`}>
                  <TrendingUp className="w-3 h-3" />
                  <span>{step.score}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {variant === 'vertical' ? renderVerticalProgress() : renderHorizontalProgress()}
    </div>
  );
};

export default ProgressTracker;