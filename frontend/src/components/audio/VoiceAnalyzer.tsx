import React, { useRef, useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export interface VoiceMetrics {
  pitch: number; // Hz
  volume: number; // 0-1
  clarity: number; // 0-1 (measure of how clear the speech is)
  pace: number; // words per minute estimate
  timestamp: number;
}

export interface VoiceAnalyzerProps {
  audioStream?: MediaStream;
  onMetricsUpdate?: (metrics: VoiceMetrics) => void;
  isActive?: boolean;
  className?: string;
}

const VoiceAnalyzer: React.FC<VoiceAnalyzerProps> = ({
  audioStream,
  onMetricsUpdate,
  isActive = false,
  className = '',
}) => {
  const [currentMetrics, setCurrentMetrics] = useState<VoiceMetrics>({
    pitch: 0,
    volume: 0,
    clarity: 0,
    pace: 0,
    timestamp: Date.now(),
  });

  const [averageMetrics, setAverageMetrics] = useState<VoiceMetrics>({
    pitch: 0,
    volume: 0,
    clarity: 0,
    pace: 0,
    timestamp: Date.now(),
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const metricsHistoryRef = useRef<VoiceMetrics[]>([]);

  useEffect(() => {
    if (!audioStream || !isActive) {
      stopAnalysis();
      return;
    }

    startAnalysis();
    return () => stopAnalysis();
  }, [audioStream, isActive]);

  const startAnalysis = async () => {
    if (!audioStream) return;

    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      analyzeAudio();
    } catch (error) {
      console.error('Failed to start voice analysis:', error);
    }
  };

  const stopAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const freqArray = new Float32Array(bufferLength);
    
    analyserRef.current.getByteTimeDomainData(dataArray);
    analyserRef.current.getFloatFrequencyData(freqArray);

    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const volume = Math.sqrt(sum / bufferLength);

    // Calculate dominant frequency (simple pitch estimation)
    let maxAmp = -Infinity;
    let fundamentalFreq = 0;
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    
    for (let i = 0; i < bufferLength; i++) {
      if (freqArray[i] > maxAmp) {
        maxAmp = freqArray[i];
        fundamentalFreq = (i * sampleRate) / (2 * bufferLength);
      }
    }

    // Estimate clarity based on harmonic content
    const clarity = volume > 0.01 ? Math.min(maxAmp / -30, 1) : 0;

    // Simple pace estimation (based on volume changes)
    const pace = estimatePace(volume);

    const metrics: VoiceMetrics = {
      pitch: fundamentalFreq,
      volume: Math.min(volume * 10, 1), // Amplify for better visualization
      clarity: Math.max(clarity, 0),
      pace,
      timestamp: Date.now(),
    };

    setCurrentMetrics(metrics);
    updateAverageMetrics(metrics);
    onMetricsUpdate?.(metrics);

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  const estimatePace = (volume: number): number => {
    // Very simplified pace estimation based on volume threshold crossings
    // In a real implementation, you'd use more sophisticated speech detection
    return volume > 0.05 ? 120 : 0; // Assume 120 WPM when speaking
  };

  const updateAverageMetrics = (newMetrics: VoiceMetrics) => {
    metricsHistoryRef.current.push(newMetrics);
    
    // Keep only last 10 seconds of data (assuming ~60fps)
    const maxHistory = 600;
    if (metricsHistoryRef.current.length > maxHistory) {
      metricsHistoryRef.current = metricsHistoryRef.current.slice(-maxHistory);
    }

    // Calculate averages
    const history = metricsHistoryRef.current;
    const avgMetrics = history.reduce(
      (acc, metric) => ({
        pitch: acc.pitch + metric.pitch,
        volume: acc.volume + metric.volume,
        clarity: acc.clarity + metric.clarity,
        pace: acc.pace + metric.pace,
        timestamp: Date.now(),
      }),
      { pitch: 0, volume: 0, clarity: 0, pace: 0, timestamp: Date.now() }
    );

    const count = history.length;
    setAverageMetrics({
      pitch: avgMetrics.pitch / count,
      volume: avgMetrics.volume / count,
      clarity: avgMetrics.clarity / count,
      pace: avgMetrics.pace / count,
      timestamp: Date.now(),
    });
  };

  const getQualityColor = (value: number, type: 'volume' | 'clarity' | 'pace' | 'pitch') => {
    switch (type) {
      case 'volume':
        if (value < 0.1) return 'text-red-500';
        if (value < 0.3) return 'text-yellow-500';
        return 'text-green-500';
      case 'clarity':
        if (value < 0.3) return 'text-red-500';
        if (value < 0.7) return 'text-yellow-500';
        return 'text-green-500';
      case 'pace':
        if (value === 0) return 'text-gray-400';
        if (value < 100 || value > 180) return 'text-yellow-500';
        return 'text-green-500';
      case 'pitch':
        if (value < 80 || value > 300) return 'text-yellow-500';
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatPitch = (pitch: number) => {
    return pitch > 0 ? `${Math.round(pitch)} Hz` : '-- Hz';
  };

  const formatPace = (pace: number) => {
    return pace > 0 ? `${Math.round(pace)} mpm` : '-- mpm';
  };

  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Analyse Vocale
        </h3>
        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Volume</span>
            <span className={`text-sm font-semibold ${getQualityColor(currentMetrics.volume, 'volume')}`}>
              {Math.round(currentMetrics.volume * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${currentMetrics.volume * 100}%` }}
            />
          </div>
        </div>

        {/* Clarity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Clarté</span>
            <span className={`text-sm font-semibold ${getQualityColor(currentMetrics.clarity, 'clarity')}`}>
              {Math.round(currentMetrics.clarity * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${currentMetrics.clarity * 100}%` }}
            />
          </div>
        </div>

        {/* Pitch */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Hauteur</span>
            <span className={`text-sm font-semibold ${getQualityColor(currentMetrics.pitch, 'pitch')}`}>
              {formatPitch(currentMetrics.pitch)}
            </span>
          </div>
        </div>

        {/* Pace */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Rythme</span>
            <span className={`text-sm font-semibold ${getQualityColor(currentMetrics.pace, 'pace')}`}>
              {formatPace(currentMetrics.pace)}
            </span>
          </div>
        </div>
      </div>

      {/* Average Metrics */}
      {metricsHistoryRef.current.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <BarChart3 className="w-4 h-4 mr-1" />
            Moyennes de session
          </h4>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="text-gray-600">Volume</div>
              <div className="font-semibold">{Math.round(averageMetrics.volume * 100)}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Clarté</div>
              <div className="font-semibold">{Math.round(averageMetrics.clarity * 100)}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Hauteur</div>
              <div className="font-semibold">{formatPitch(averageMetrics.pitch)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Rythme</div>
              <div className="font-semibold">{formatPace(averageMetrics.pace)}</div>
            </div>
          </div>
        </div>
      )}

      {!isActive && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Analyse en pause
        </div>
      )}
    </div>
  );
};

export default VoiceAnalyzer;