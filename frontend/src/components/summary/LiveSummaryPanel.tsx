import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Brain,
  MessageSquare,
  Volume2,
  Clock,
  TrendingUp,
  Eye,
  Zap,
  Copy,
  Download,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export interface TranscriptSegment {
  id: string;
  timestamp: number;
  text: string;
  speaker: 'user' | 'ai';
  confidence: number;
  emotions?: string[];
  keywords?: string[];
}

export interface LiveInsight {
  id: string;
  type: 'pace' | 'clarity' | 'volume' | 'emotion' | 'keyword';
  title: string;
  value: string | number;
  change: number;
  description: string;
  timestamp: number;
}

export interface FeedbackItem {
  id: string;
  type: 'suggestion' | 'improvement' | 'achievement';
  title: string;
  message: string;
  timestamp: number;
  priority: 'low' | 'medium' | 'high';
}

export interface LiveSummaryPanelProps {
  transcript: TranscriptSegment[];
  insights: LiveInsight[];
  feedback: FeedbackItem[];
  isRecording?: boolean;
  onTranscriptPause?: () => void;
  onTranscriptResume?: () => void;
  onTranscriptClear?: () => void;
  onExportTranscript?: () => void;
  className?: string;
}

const LiveSummaryPanel: React.FC<LiveSummaryPanelProps> = ({
  transcript = [],
  insights = [],
  feedback = [],
  isRecording = false,
  onTranscriptPause,
  onTranscriptResume,
  onTranscriptClear,
  onExportTranscript,
  className = ''
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'transcript' | 'insights' | 'feedback'>('transcript');
  const [isPaused, setIsPaused] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of transcript
  useEffect(() => {
    if (activeTab === 'transcript' && !isPaused) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, activeTab, isPaused]);

  // Mock data for demonstration
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRecording && !isPaused) {
        // This would be replaced with real-time data from WebSocket
        console.log('Live transcript update...');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      onTranscriptResume?.();
    } else {
      setIsPaused(true);
      onTranscriptPause?.();
    }
  };

  const toggleInsightExpanded = (insightId: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  };

  const getInsightIcon = (type: LiveInsight['type']) => {
    switch (type) {
      case 'pace':
        return Clock;
      case 'clarity':
        return Eye;
      case 'volume':
        return Volume2;
      case 'emotion':
        return Brain;
      case 'keyword':
        return Zap;
      default:
        return TrendingUp;
    }
  };

  const getInsightColor = (type: LiveInsight['type']) => {
    switch (type) {
      case 'pace':
        return 'text-blue-400';
      case 'clarity':
        return 'text-green-400';
      case 'volume':
        return 'text-purple-400';
      case 'emotion':
        return 'text-pink-400';
      case 'keyword':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getFeedbackColor = (type: FeedbackItem['type']) => {
    switch (type) {
      case 'achievement':
        return 'border-green-400 bg-green-400/10';
      case 'improvement':
        return 'border-yellow-400 bg-yellow-400/10';
      case 'suggestion':
        return 'border-blue-400 bg-blue-400/10';
      default:
        return 'border-gray-400 bg-gray-400/10';
    }
  };

  const tabs = [
    { id: 'transcript', label: t('summary.tabs.transcript'), icon: FileText },
    { id: 'insights', label: t('summary.tabs.insights'), icon: Brain },
    { id: 'feedback', label: t('summary.tabs.feedback'), icon: MessageSquare }
  ] as const;

  return (
    <div className={`bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-3xl shadow-glass overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-glass-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{t('summary.title')}</h3>
            <p className="text-gray-400">{t('summary.subtitle')}</p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePauseResume}
              className="p-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
              aria-label={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <Play className="w-4 h-4 text-green-400" />
              ) : (
                <Pause className="w-4 h-4 text-yellow-400" />
              )}
            </button>
            
            <button
              onClick={onTranscriptClear}
              className="p-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label="Clear transcript"
            >
              <RotateCcw className="w-4 h-4 text-red-400" />
            </button>
            
            <button
              onClick={onExportTranscript}
              className="p-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
              aria-label="Export transcript"
            >
              <Download className="w-4 h-4 text-primary-400" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800/50 rounded-xl p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-glass-300'
                }`}
                aria-label={tab.label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="h-96 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'transcript' && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto p-6 space-y-4"
            >
              {transcript.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center space-y-2">
                    <FileText className="w-12 h-12 mx-auto opacity-50" />
                    <p>{t('summary.transcript.empty')}</p>
                  </div>
                </div>
              ) : (
                <>
                  {transcript.map((segment, index) => (
                    <motion.div
                      key={segment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex gap-3 ${
                        segment.speaker === 'ai' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        segment.speaker === 'ai' 
                          ? 'bg-gradient-to-r from-primary-500 to-accent-500' 
                          : 'bg-gradient-to-r from-gray-600 to-gray-500'
                      }`}>
                        {segment.speaker === 'ai' ? (
                          <Brain className="w-4 h-4 text-white" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 max-w-xs ${
                        segment.speaker === 'ai' ? 'text-right' : ''
                      }`}>
                        <div className={`inline-block p-3 rounded-2xl ${
                          segment.speaker === 'ai'
                            ? 'bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-primary-500/30'
                            : 'bg-gray-800/50 border border-gray-700/50'
                        }`}>
                          <p className="text-white text-sm leading-relaxed">
                            {segment.text}
                          </p>
                          
                          {/* Metadata */}
                          <div className={`flex items-center gap-2 mt-2 text-xs text-gray-400 ${
                            segment.speaker === 'ai' ? 'justify-end' : ''
                          }`}>
                            <span>{formatTime(segment.timestamp)}</span>
                            <span>•</span>
                            <span>{Math.round(segment.confidence * 100)}% {t('summary.transcript.confidence')}</span>
                            {segment.emotions && segment.emotions.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-pink-400">{segment.emotions.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto p-6 space-y-4"
            >
              {insights.map((insight) => {
                const Icon = getInsightIcon(insight.type);
                const isExpanded = expandedInsights.has(insight.id);
                
                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4"
                  >
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleInsightExpanded(insight.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gray-800/50 ${getInsightColor(insight.type)}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{insight.title}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-white">{insight.value}</span>
                            <span className={`text-sm font-medium ${
                              insight.change >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {insight.change >= 0 ? '+' : ''}{insight.change}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {formatTime(insight.timestamp)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t border-gray-700/50"
                        >
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {insight.description}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {activeTab === 'feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto p-6 space-y-4"
            >
              {feedback.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border ${getFeedbackColor(item.type)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-white">{item.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === 'high' ? 'bg-red-400/20 text-red-400' :
                        item.priority === 'medium' ? 'bg-yellow-400/20 text-yellow-400' :
                        'bg-gray-400/20 text-gray-400'
                      }`}>
                        {item.priority}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {item.message}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-glass-300">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400 animate-pulse' : 'bg-gray-600'}`} />
              <span>{isRecording ? 'Recording' : 'Stopped'}</span>
            </div>
            {isPaused && (
              <div className="flex items-center gap-1">
                <Pause className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400">Paused</span>
              </div>
            )}
          </div>
          <div>
            {transcript.length > 0 && (
              <span>{transcript.length} segments • Last update: {formatTime(Date.now())}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSummaryPanel;