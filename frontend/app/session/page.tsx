'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  TrendingUp,
  Volume2,
  Clock,
  MessageSquare,
  BarChart3,
  Sparkles,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import useWebSocket, { ReadyState } from 'react-use-websocket'

interface VoiceMetrics {
  pace_wpm: number
  volume_consistency: number
  clarity_score: number
  voice_activity_ratio: number
}

interface FeedbackItem {
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  suggestion: string
  timestamp: string
}

export default function SessionPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [currentMetrics, setCurrentMetrics] = useState<VoiceMetrics>({
    pace_wpm: 0,
    volume_consistency: 0,
    clarity_score: 0,
    voice_activity_ratio: 0
  })
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [sessionId] = useState(() => `session_${Date.now()}`)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // WebSocket connection
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `ws://localhost:8000/ws/session/${sessionId}`,
    {
      shouldReconnect: () => true,
      reconnectAttempts: 10,
      reconnectInterval: 3000,
    }
  )

  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const data = JSON.parse(lastMessage.data)
        
        switch (data.type) {
          case 'session_initialized':
            toast.success('Session AURA initialisée !')
            break
          case 'coaching_feedback':
            // Handle coaching feedback
            break
          case 'realtime_suggestion':
            if (data.data && Array.isArray(data.data)) {
              const newFeedback = data.data.map((item: any) => ({
                type: item.type || 'general',
                severity: item.severity || 'info',
                message: item.message || '',
                suggestion: item.suggestion || '',
                timestamp: new Date().toISOString()
              }))
              setFeedback(prev => [...prev, ...newFeedback].slice(-10)) // Keep last 10 items
            }
            break
          case 'performance_metrics':
            // Handle performance metrics
            break
          case 'error':
            toast.error(`Erreur: ${data.error}`)
            break
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
  }, [lastMessage])

  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording, isPaused])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Convert blob to base64 and send via WebSocket
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64data = reader.result as string
            const audioData = base64data.split(',')[1] // Remove data:audio/webm;base64, prefix
            
            sendMessage(JSON.stringify({
              type: 'audio_chunk',
              audio_data: audioData,
              timestamp: new Date().toISOString(),
              sample_rate: 16000,
              sequence_number: Date.now()
            }))
          }
          reader.readAsDataURL(event.data)
        }
      }
      
      mediaRecorder.start(100) // Send data every 100ms
      setIsRecording(true)
      setIsPaused(false)
      
      // Send start session command
      sendMessage(JSON.stringify({
        type: 'control_command',
        command: 'start_session'
      }))
      
      toast.success('Enregistrement démarré !')
      
      // Simulate real-time metrics updates
      const metricsInterval = setInterval(() => {
        setCurrentMetrics({
          pace_wpm: 120 + Math.random() * 60,
          volume_consistency: 0.6 + Math.random() * 0.3,
          clarity_score: 0.7 + Math.random() * 0.2,
          voice_activity_ratio: 0.5 + Math.random() * 0.4
        })
      }, 2000)
      
      return () => clearInterval(metricsInterval)
      
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Impossible d\'accéder au microphone')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        setIsPaused(false)
        sendMessage(JSON.stringify({
          type: 'control_command',
          command: 'resume_session'
        }))
        toast.success('Enregistrement repris')
      } else {
        mediaRecorderRef.current.pause()
        setIsPaused(true)
        sendMessage(JSON.stringify({
          type: 'control_command',
          command: 'pause_session'
        }))
        toast.success('Enregistrement en pause')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    setIsRecording(false)
    setIsPaused(false)
    
    sendMessage(JSON.stringify({
      type: 'control_command',
      command: 'end_session'
    }))
    
    toast.success('Session terminée !')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getMetricColor = (value: number, type: string) => {
    switch (type) {
      case 'pace':
        if (value >= 120 && value <= 180) return 'text-green-400'
        if (value >= 100 && value <= 200) return 'text-yellow-400'
        return 'text-red-400'
      case 'consistency':
      case 'clarity':
      case 'activity':
        if (value >= 0.7) return 'text-green-400'
        if (value >= 0.5) return 'text-yellow-400'
        return 'text-red-400'
      default:
        return 'text-white'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-500/10'
      case 'warning': return 'border-yellow-500 bg-yellow-500/10'
      case 'info': return 'border-blue-500 bg-blue-500/10'
      default: return 'border-gray-500 bg-gray-500/10'
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="btn-secondary p-2">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Session de Coaching</h1>
              <p className="text-gray-400">Améliorez votre présentation en temps réel</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-white">
              <Clock className="w-5 h-5" />
              <span className="font-mono text-lg">{formatTime(sessionTime)}</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              readyState === ReadyState.OPEN ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {readyState === ReadyState.OPEN ? 'Connecté' : 'Déconnecté'}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
        {/* Main Recording Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recording Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card text-center"
          >
            <div className="mb-8">
              <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
                isRecording 
                  ? isPaused 
                    ? 'bg-yellow-500/20 border-4 border-yellow-500' 
                    : 'bg-red-500/20 border-4 border-red-500 pulse-record'
                  : 'bg-gray-500/20 border-4 border-gray-500'
              }`}>
                {isRecording ? (
                  isPaused ? (
                    <Pause className="w-12 h-12 text-yellow-400" />
                  ) : (
                    <Mic className="w-12 h-12 text-red-400" />
                  )
                ) : (
                  <MicOff className="w-12 h-12 text-gray-400" />
                )}
              </div>

              {/* Audio Visualization */}
              {isRecording && !isPaused && (
                <div className="flex justify-center items-center space-x-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="wave" />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center space-x-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="btn-primary text-lg px-8 py-4"
                >
                  <Play className="mr-2 w-5 h-5" />
                  Commencer
                </button>
              ) : (
                <>
                  <button
                    onClick={pauseRecording}
                    className="btn-secondary text-lg px-6 py-4"
                  >
                    {isPaused ? (
                      <>
                        <Play className="mr-2 w-5 h-5" />
                        Reprendre
                      </>
                    ) : (
                      <>
                        <Pause className="mr-2 w-5 h-5" />
                        Pause
                      </>
                    )}
                  </button>
                  <button
                    onClick={stopRecording}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
                  >
                    <Square className="mr-2 w-5 h-5" />
                    Arrêter
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {/* Real-time Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <BarChart3 className="mr-2 w-5 h-5" />
                Métriques Temps Réel
              </h2>
              <button className="btn-secondary p-2">
                <Settings className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Débit (mots/min)</div>
                <div className={`text-3xl font-bold ${getMetricColor(currentMetrics.pace_wpm, 'pace')}`}>
                  {Math.round(currentMetrics.pace_wpm)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Idéal: 120-180</div>
              </div>

              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Consistance Volume</div>
                <div className={`text-3xl font-bold ${getMetricColor(currentMetrics.volume_consistency, 'consistency')}`}>
                  {Math.round(currentMetrics.volume_consistency * 100)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Idéal: {'>'}70%</div>
              </div>

              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Clarté</div>
                <div className={`text-3xl font-bold ${getMetricColor(currentMetrics.clarity_score, 'clarity')}`}>
                  {Math.round(currentMetrics.clarity_score * 100)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Idéal: {'>'}70%</div>
              </div>

              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Activité Vocale</div>
                <div className={`text-3xl font-bold ${getMetricColor(currentMetrics.voice_activity_ratio, 'activity')}`}>
                  {Math.round(currentMetrics.voice_activity_ratio * 100)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Idéal: 60-80%</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Feedback */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Sparkles className="mr-2 w-5 h-5" />
                Feedback IA
              </h2>
              <div className="text-sm text-gray-400">
                {feedback.length} suggestions
              </div>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {feedback.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Commencez à parler pour recevoir des suggestions personnalisées</p>
                  </div>
                ) : (
                  feedback.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`p-4 rounded-lg border ${getSeverityColor(item.severity)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-white capitalize">
                          {item.type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                          item.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{item.message}</p>
                      <p className="text-xs text-gray-400">{item.suggestion}</p>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="mr-2 w-5 h-5" />
              Statistiques Session
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Durée</span>
                <span className="text-white font-mono">{formatTime(sessionTime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Mots estimés</span>
                <span className="text-white">{Math.round(currentMetrics.pace_wpm * sessionTime / 60)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Feedback reçus</span>
                <span className="text-white">{feedback.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Qualité globale</span>
                <span className="text-green-400 font-semibold">
                  {Math.round((currentMetrics.clarity_score + currentMetrics.volume_consistency) * 50)}%
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}