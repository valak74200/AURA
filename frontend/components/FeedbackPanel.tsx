'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, AlertTriangle, Info, AlertCircle, X } from 'lucide-react'
import { FeedbackItem, FeedbackSeverity } from '@/types'
import { useState } from 'react'

interface FeedbackPanelProps {
  feedback: FeedbackItem[]
  onDismiss?: (id: string) => void
  maxItems?: number
  className?: string
}

export default function FeedbackPanel({
  feedback,
  onDismiss,
  maxItems = 10,
  className = ''
}: FeedbackPanelProps) {
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())

  const visibleFeedback = feedback
    .filter(item => !dismissedItems.has(item.id))
    .slice(-maxItems)

  const handleDismiss = (id: string) => {
    setDismissedItems(prev => new Set([...prev, id]))
    onDismiss?.(id)
  }

  const getSeverityIcon = (severity: FeedbackSeverity) => {
    switch (severity) {
      case FeedbackSeverity.CRITICAL:
        return AlertCircle
      case FeedbackSeverity.WARNING:
        return AlertTriangle
      case FeedbackSeverity.INFO:
      default:
        return Info
    }
  }

  const getSeverityColor = (severity: FeedbackSeverity) => {
    switch (severity) {
      case FeedbackSeverity.CRITICAL:
        return 'border-red-500 bg-red-500/10 text-red-400'
      case FeedbackSeverity.WARNING:
        return 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
      case FeedbackSeverity.INFO:
      default:
        return 'border-blue-500 bg-blue-500/10 text-blue-400'
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      voice_pace: 'Rythme',
      voice_volume: 'Volume',
      voice_clarity: 'Clarté',
      filler_words: 'Mots de remplissage',
      pause_frequency: 'Pauses',
      structure: 'Structure',
      engagement: 'Engagement',
      confidence: 'Confiance'
    }
    return labels[type] || type
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <MessageSquare className="mr-2 w-5 h-5" />
          Feedback IA
        </h2>
        <div className="text-sm text-gray-400">
          {visibleFeedback.length} suggestion{visibleFeedback.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {visibleFeedback.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-gray-400 py-8"
            >
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Commencez à parler pour recevoir des suggestions personnalisées</p>
            </motion.div>
          ) : (
            visibleFeedback.map((item, index) => {
              const SeverityIcon = getSeverityIcon(item.severity)
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`p-4 rounded-lg border ${getSeverityColor(item.severity)} relative group`}
                >
                  {onDismiss && (
                    <button
                      onClick={() => handleDismiss(item.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <SeverityIcon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(item.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-300 mb-2 leading-relaxed">
                        {item.message}
                      </p>
                      
                      <p className="text-xs text-gray-400 leading-relaxed">
                        💡 {item.suggestion}
                      </p>
                      
                      {item.confidence && (
                        <div className="mt-2 flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Confiance:</span>
                          <div className="flex-1 bg-gray-700 rounded-full h-1">
                            <div
                              className="bg-current h-1 rounded-full transition-all duration-300"
                              style={{ width: `${item.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {visibleFeedback.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              {feedback.filter(f => f.severity === FeedbackSeverity.CRITICAL).length} critiques,{' '}
              {feedback.filter(f => f.severity === FeedbackSeverity.WARNING).length} avertissements,{' '}
              {feedback.filter(f => f.severity === FeedbackSeverity.INFO).length} infos
            </span>
            {dismissedItems.size > 0 && (
              <button
                onClick={() => setDismissedItems(new Set())}
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Tout afficher
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}