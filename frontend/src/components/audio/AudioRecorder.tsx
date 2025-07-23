import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Play, Pause, Volume2 } from 'lucide-react';
import { Button } from '../ui';

export interface AudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number; // in seconds
  className?: string;
  disabled?: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  maxDuration = 300, // 5 minutes default
  className = '',
  disabled = false,
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check microphone permission
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissionGranted(true);
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('Microphone permission denied:', error);
        setPermissionGranted(false);
      }
    };

    checkPermission();
  }, []);

  // Audio level monitoring
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    
    setRecordingState(prev => ({ ...prev, audioLevel: normalizedLevel }));
    
    if (recordingState.isRecording && !recordingState.isPaused) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [recordingState.isRecording, recordingState.isPaused]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      // Setup audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Setup MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onRecordingComplete?.(audioBlob, recordingState.duration);
        onRecordingStop?.();
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
      }));

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecordingState(prev => {
          const newDuration = prev.duration + 1;
          
          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            stopRecording();
            return prev;
          }
          
          return { ...prev, duration: newDuration };
        });
      }, 1000);

      // Start audio level monitoring
      updateAudioLevel();
      onRecordingStart?.();

    } catch (error) {
      console.error('Failed to start recording:', error);
      setPermissionGranted(false);
    }
  }, [maxDuration, onRecordingComplete, onRecordingStart, onRecordingStop, recordingState.duration, updateAudioLevel]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setRecordingState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      audioLevel: 0,
    }));
  }, [recordingState.isRecording]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (recordingState.isPaused) {
      mediaRecorderRef.current.resume();
      updateAudioLevel();
    } else {
      mediaRecorderRef.current.pause();
    }

    setRecordingState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, [recordingState.isPaused, updateAudioLevel]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingState.isRecording) {
        stopRecording();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  if (permissionGranted === false) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <div className="flex items-center space-x-2 text-red-700">
          <MicOff className="w-5 h-5" />
          <span className="text-sm">
            Accès au microphone refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 border border-gray-200 rounded-lg bg-white ${className}`}>
      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        {!recordingState.isRecording ? (
          <Button
            onClick={startRecording}
            disabled={disabled || permissionGranted === null}
            variant="primary"
            size="lg"
            className="flex items-center space-x-2"
          >
            <Mic className="w-5 h-5" />
            <span>Commencer l'enregistrement</span>
          </Button>
        ) : (
          <div className="flex items-center space-x-2">
            <Button
              onClick={togglePause}
              variant="secondary"
              size="lg"
            >
              {recordingState.isPaused ? (
                <Play className="w-5 h-5" />
              ) : (
                <Pause className="w-5 h-5" />
              )}
            </Button>
            
            <Button
              onClick={stopRecording}
              variant="primary"
              size="lg"
              className="bg-red-600 hover:bg-red-700"
            >
              <Square className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Recording Status */}
      {recordingState.isRecording && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${recordingState.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-lg font-mono font-semibold">
              {formatDuration(recordingState.duration)}
            </span>
            <span className="text-sm text-gray-500">
              / {formatDuration(maxDuration)}
            </span>
          </div>

          {/* Audio Level Indicator */}
          <div className="flex items-center justify-center space-x-2">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-100"
                style={{ width: `${recordingState.audioLevel * 100}%` }}
              />
            </div>
          </div>

          {recordingState.isPaused && (
            <p className="text-sm text-yellow-600">Enregistrement en pause</p>
          )}
        </div>
      )}

      {/* Playback */}
      {audioUrl && !recordingState.isRecording && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Dernier enregistrement:</h4>
          <audio controls className="w-full">
            <source src={audioUrl} type="audio/webm" />
            Votre navigateur ne supporte pas l'élément audio.
          </audio>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;