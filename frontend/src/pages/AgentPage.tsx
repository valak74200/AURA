import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Square,
  Pause,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  Brain
} from 'lucide-react';
import DIDAgentInterface from '../components/agent/DIDAgentInterface';
import LiveSummaryPanel, { 
  TranscriptSegment, 
  LiveInsight, 
  FeedbackItem 
} from '../components/summary/LiveSummaryPanel';
import { Button, Card, Badge } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';

const AgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'paused'>('idle');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Mock data for the live summary panel
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([
    {
      id: '1',
      timestamp: Date.now() - 30000,
      text: 'Hello, I\'d like to practice my presentation skills today.',
      speaker: 'user',
      confidence: 0.95,
      emotions: ['confident'],
      keywords: ['presentation', 'practice']
    },
    {
      id: '2',
      timestamp: Date.now() - 25000,
      text: 'Great! I can help you improve your presentation skills. Let\'s start with your opening.',
      speaker: 'ai',
      confidence: 0.98
    }
  ]);

  const [insights] = useState<LiveInsight[]>([
    {
      id: '1',
      type: 'pace',
      title: 'Speaking Pace',
      value: '145 WPM',
      change: 5,
      description: 'Your speaking pace is optimal for presentations. You\'ve improved by 5% since your last session.',
      timestamp: Date.now() - 10000
    },
    {
      id: '2',
      type: 'clarity',
      title: 'Speech Clarity',
      value: '92%',
      change: 8,
      description: 'Excellent articulation! Your clarity has improved significantly.',
      timestamp: Date.now() - 5000
    },
    {
      id: '3',
      type: 'volume',
      title: 'Volume Level',
      value: '78 dB',
      change: -2,
      description: 'Consider speaking slightly louder for better audience engagement.',
      timestamp: Date.now() - 2000
    }
  ]);

  const [feedback] = useState<FeedbackItem[]>([
    {
      id: '1',
      type: 'achievement',
      title: 'Great Progress!',
      message: 'You\'ve maintained consistent eye contact throughout the session.',
      timestamp: Date.now() - 15000,
      priority: 'low'
    },
    {
      id: '2',
      type: 'suggestion',
      title: 'Pacing Tip',
      message: 'Try adding brief pauses after key points to let the information sink in.',
      timestamp: Date.now() - 8000,
      priority: 'medium'
    },
    {
      id: '3',
      type: 'improvement',
      title: 'Volume Adjustment',
      message: 'Your volume dropped slightly during the last segment. Maintain consistent projection.',
      timestamp: Date.now() - 3000,
      priority: 'high'
    }
  ]);

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionStatus === 'active') {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionStatus]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSessionStart = () => {
    setConnectionStatus('connecting');
    setSessionStatus('active');
    setIsRecording(true);
    setTimeout(() => {
      setConnectionStatus('connected');
    }, 2000);
  };

  const handleSessionStop = () => {
    setSessionStatus('idle');
    setConnectionStatus('disconnected');
    setIsRecording(false);
    setSessionDuration(0);
  };

  const handleSessionPause = () => {
    setSessionStatus('paused');
    setIsRecording(false);
  };

  const handleSessionResume = () => {
    setSessionStatus('active');
    setIsRecording(true);
  };

  const handleMuteToggle = (muted: boolean) => {
    console.log('Mute toggled:', muted);
  };

  const handleVolumeChange = (volume: number) => {
    console.log('Volume changed:', volume);
  };

  const handleTranscriptPause = () => {
    console.log('Transcript paused');
  };

  const handleTranscriptResume = () => {
    console.log('Transcript resumed');
  };

  const handleTranscriptClear = () => {
    setTranscript([]);
  };

  const handleExportTranscript = () => {
    const transcriptData = JSON.stringify(transcript, null, 2);
    const blob = new Blob([transcriptData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${sessionId}_transcript.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900">
      {/* Header */}
      <div className="p-6 border-b border-glass-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              
              <div className="w-px h-6 bg-gray-600" />
              
              <div>
                <h1 className="text-2xl font-bold text-white">AI Agent Session</h1>
                <p className="text-gray-400">Interactive coaching with D-ID Avatar</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Session Status */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  sessionStatus === 'active' ? 'bg-green-400 animate-pulse' :
                  sessionStatus === 'paused' ? 'bg-yellow-400' : 'bg-gray-400'
                }`} />
                <span className="text-sm text-gray-300 capitalize">{sessionStatus}</span>
              </div>

              {/* Session Timer */}
              {sessionStatus !== 'idle' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-glass-gradient border border-glass-300 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-mono text-sm">
                    {formatDuration(sessionDuration)}
                  </span>
                </div>
              )}

              {/* Connection Status */}
              <Badge variant={
                connectionStatus === 'connected' ? 'success' :
                connectionStatus === 'connecting' ? 'warning' : 'default'
              }>
                <Activity className="w-3 h-3 mr-1" />
                {connectionStatus}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Agent Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agent Interface */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <DIDAgentInterface
                sessionId={sessionId}
                onSessionStart={handleSessionStart}
                onSessionStop={handleSessionStop}
                onSessionPause={handleSessionPause}
                onSessionResume={handleSessionResume}
                onMuteToggle={handleMuteToggle}
                onVolumeChange={handleVolumeChange}
                className="h-96"
              />
            </motion.div>

            {/* Session Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Session Controls</h3>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="p-4 bg-glass-gradient border border-glass-300 rounded-xl mb-2">
                      <Brain className="w-6 h-6 mx-auto text-purple-400" />
                    </div>
                    <p className="text-sm text-gray-400">AI Analysis</p>
                    <p className="text-white font-semibold">Active</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="p-4 bg-glass-gradient border border-glass-300 rounded-xl mb-2">
                      <Mic className="w-6 h-6 mx-auto text-green-400" />
                    </div>
                    <p className="text-sm text-gray-400">Recording</p>
                    <p className="text-white font-semibold">{isRecording ? 'On' : 'Off'}</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="p-4 bg-glass-gradient border border-glass-300 rounded-xl mb-2">
                      <Volume2 className="w-6 h-6 mx-auto text-blue-400" />
                    </div>
                    <p className="text-sm text-gray-400">Audio</p>
                    <p className="text-white font-semibold">85%</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="p-4 bg-glass-gradient border border-glass-300 rounded-xl mb-2">
                      <Activity className="w-6 h-6 mx-auto text-yellow-400" />
                    </div>
                    <p className="text-sm text-gray-400">Quality</p>
                    <p className="text-white font-semibold">HD</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Live Summary Panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="sticky top-6"
            >
              <LiveSummaryPanel
                transcript={transcript}
                insights={insights}
                feedback={feedback}
                isRecording={isRecording}
                onTranscriptPause={handleTranscriptPause}
                onTranscriptResume={handleTranscriptResume}
                onTranscriptClear={handleTranscriptClear}
                onExportTranscript={handleExportTranscript}
                className="h-[600px]"
              />
            </motion.div>
          </div>
        </div>

        {/* Bottom Section - Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8"
        >
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Session: {sessionId.slice(-8)}</h3>
                <p className="text-gray-400">
                  Started by {user?.username || 'User'} • {new Date().toLocaleString()}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/sessions')}
                >
                  View All Sessions
                </Button>
                
                <Button
                  variant="primary"
                  onClick={handleExportTranscript}
                  disabled={transcript.length === 0}
                >
                  Export Session Data
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AgentPage;