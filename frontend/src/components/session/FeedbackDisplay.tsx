import React, { useState } from 'react';
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  ChevronDown,
  ChevronUp,
  Volume2,
  Mic,
  Clock
} from 'lucide-react';
import { Badge } from '../ui';

export interface FeedbackItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  category: 'volume' | 'clarity' | 'pace' | 'pitch' | 'general';
  title: string;
  message: string;
  timestamp: number;
  score?: number;
  suggestion?: string;
  audioTimestamp?: number; // For audio playback reference
}

export interface FeedbackDisplayProps {
  feedbacks: FeedbackItem[];
  className?: string;
  maxVisible?: number;
  showCategories?: boolean;
  onFeedbackClick?: (feedback: FeedbackItem) => void;
  realTime?: boolean;
}

const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  feedbacks,
  className = '',
  maxVisible = 5,
  showCategories = true,
  onFeedbackClick,
  realTime = false,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const categories = [
    { id: 'all', label: 'Tous', icon: MessageSquare },
    { id: 'volume', label: 'Volume', icon: Volume2 },
    { id: 'clarity', label: 'Clarté', icon: Mic },
    { id: 'pace', label: 'Rythme', icon: Clock },
    { id: 'pitch', label: 'Intonation', icon: TrendingUp },
    { id: 'general', label: 'Général', icon: Info },
  ];

  const filteredFeedbacks = selectedCategory === 'all' 
    ? feedbacks 
    : feedbacks.filter(f => f.category === selectedCategory);

  const visibleFeedbacks = showAll 
    ? filteredFeedbacks 
    : filteredFeedbacks.slice(0, maxVisible);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'error':
        return 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800';
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800';
    }
  };

  const getScoreBadgeVariant = (score?: number) => {
    if (!score) return 'default';
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatAudioTimestamp = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Feedback {realTime && <span className="ml-2 text-xs text-green-500">(Temps réel)</span>}
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredFeedbacks.length} élément{filteredFeedbacks.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Categories Filter */}
        {showCategories && (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map(category => {
              const categoryCount = category.id === 'all' 
                ? feedbacks.length 
                : feedbacks.filter(f => f.category === category.id).length;
              
              const IconComponent = category.icon;
              
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <IconComponent className="w-3 h-3" />
                  <span>{category.label}</span>
                  {categoryCount > 0 && (
                    <span className="ml-1 px-1 bg-gray-200 dark:bg-gray-600 rounded">
                      {categoryCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Feedback List */}
      <div className="p-4">
        {visibleFeedbacks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucun feedback disponible</p>
            {realTime && (
              <p className="text-xs mt-1">Les commentaires apparaîtront ici en temps réel</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleFeedbacks.map((feedback) => {
              const isExpanded = expandedItems.has(feedback.id);
              
              return (
                <div
                  key={feedback.id}
                  className={`border rounded-lg p-3 transition-all ${getTypeColor(feedback.type)}`}
                >
                  <div 
                    className={`flex items-start space-x-3 ${
                      (feedback.suggestion || onFeedbackClick) ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => {
                      if (feedback.suggestion) {
                        toggleExpanded(feedback.id);
                      }
                      onFeedbackClick?.(feedback);
                    }}
                  >
                    {getTypeIcon(feedback.type)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {feedback.title}
                        </h4>
                        
                        <div className="flex items-center space-x-2">
                          {feedback.score !== undefined && (
                            <Badge variant={getScoreBadgeVariant(feedback.score)} size="sm">
                              {feedback.score}%
                            </Badge>
                          )}
                          
                          {feedback.audioTimestamp !== undefined && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {formatAudioTimestamp(feedback.audioTimestamp)}
                            </span>
                          )}
                          
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(feedback.timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {feedback.message}
                      </p>
                      
                      {feedback.suggestion && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            Suggestion disponible
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Suggestion */}
                  {isExpanded && feedback.suggestion && (
                    <div className="mt-3 pl-7 p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                      <h5 className="font-medium text-xs text-gray-700 dark:text-gray-300 mb-1">
                        💡 Suggestion d'amélioration:
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {feedback.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Show More/Less Button */}
        {filteredFeedbacks.length > maxVisible && (
          <div className="text-center mt-4">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              {showAll 
                ? `Voir moins` 
                : `Voir ${filteredFeedbacks.length - maxVisible} de plus`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackDisplay;