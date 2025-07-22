import { useState, useRef, useCallback } from 'react'
import { toast } from 'react-hot-toast'

interface UseAudioRecorderOptions {
  onDataAvailable?: (audioData: Blob) => void
  onStart?: () => void
  onStop?: () => void
  onPause?: () => void
  onResume?: () => void
  onError?: (error: Error) => void
  sampleRate?: number
  mimeType?: string
  timeslice?: number
}

interface UseAudioRecorderReturn {
  isRecording: boolean
  isPaused: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  recordingTime: number
  audioLevel: number
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const {
    onDataAvailable,
    onStart,
    onStop,
    onPause,
    onResume,
    onError,
    sampleRate = 16000,
    mimeType = 'audio/webm;codecs=opus',
    timeslice = 100
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current)
      
      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i] * dataArrayRef.current[i]
      }
      const rms = Math.sqrt(sum / dataArrayRef.current.length)
      const level = rms / 255 // Normalize to 0-1
      
      setAudioLevel(level)
      
      if (isRecording && !isPaused) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
    }
  }, [isRecording, isPaused])

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: sampleRate
        }
      })

      streamRef.current = stream

      // Set up audio analysis
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext
      
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      
      const bufferLength = analyser.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)
      
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onDataAvailable?.(event.data)
        }
      }

      mediaRecorder.onstart = () => {
        setIsRecording(true)
        setIsPaused(false)
        setRecordingTime(0)
        
        // Start recording timer
        intervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
        
        // Start audio level monitoring
        updateAudioLevel()
        
        onStart?.()
        toast.success('Enregistrement démarré')
      }

      mediaRecorder.onstop = () => {
        setIsRecording(false)
        setIsPaused(false)
        setAudioLevel(0)
        
        // Clean up timer
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        
        // Clean up animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        
        onStop?.()
        toast.success('Enregistrement arrêté')
      }

      mediaRecorder.onpause = () => {
        setIsPaused(true)
        onPause?.()
        toast.success('Enregistrement en pause')
      }

      mediaRecorder.onresume = () => {
        setIsPaused(false)
        updateAudioLevel()
        onResume?.()
        toast.success('Enregistrement repris')
      }

      mediaRecorder.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${event}`)
        onError?.(error)
        toast.error('Erreur d\'enregistrement')
      }

      // Start recording
      mediaRecorder.start(timeslice)

    } catch (error) {
      const err = error as Error
      console.error('Failed to start recording:', err)
      onError?.(err)
      toast.error('Impossible d\'accéder au microphone')
    }
  }, [sampleRate, mimeType, timeslice, onDataAvailable, onStart, onError, updateAudioLevel])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Clean up refs
    analyserRef.current = null
    dataArrayRef.current = null
  }, [isRecording])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
    }
  }, [isRecording, isPaused])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
    }
  }, [isRecording, isPaused])

  return {
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordingTime,
    audioLevel
  }
}