import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Mic, 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  Settings, 
  BarChart3, 
  MessageSquare,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  ArrowLeft
} from 'lucide-react';
import { 
  useSession, 
  useSessionFeedback, 
  useUploadAudio, 
  useAnalyzeAudioChunk,
  useUpdateSession 
} from '../../hooks/useSession';
import { useSessionStore } from '../../store/useSessionStore';
import { Button, Card, Badge, LoadingSpinner } from '../../components/ui';

// Helper function to convert audio blob to WAV format using Web Audio API
const convertToWav = async (audioBlob: Blob, filename: string): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Create audio context (will resample to 16kHz later)
    const audioContext = new AudioContext();
    const fileReader = new FileReader();
    
    fileReader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Resample to 16kHz if needed
        if (audioBuffer.sampleRate !== 16000) {
          console.log(`Resampling from ${audioBuffer.sampleRate}Hz to 16000Hz`);
          audioBuffer = await resampleAudioBuffer(audioContext, audioBuffer, 16000);
        }
        
        // Convert to mono if needed
        if (audioBuffer.numberOfChannels > 1) {
          console.log('Converting to mono');
          audioBuffer = convertToMono(audioBuffer);
        }
        
        // Convert to 16-bit PCM WAV
        const wavBuffer = audioBufferToWav(audioBuffer);
        const wavFile = new File([wavBuffer], filename, { type: 'audio/wav' });
        
        console.log(`WAV conversion complete: ${audioBuffer.length} samples at ${audioBuffer.sampleRate}Hz`);
        audioContext.close();
        resolve(wavFile);
      } catch (error) {
        audioContext.close();
        reject(error);
      }
    };
    
    fileReader.onerror = () => {
      audioContext.close();
      reject(new Error('Failed to read audio blob'));
    };
    
    fileReader.readAsArrayBuffer(audioBlob);
  });
};

// Helper function to resample AudioBuffer to target sample rate
const resampleAudioBuffer = async (audioContext: AudioContext, buffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> => {
  if (buffer.sampleRate === targetSampleRate) {
    return buffer;
  }
  
  const ratio = targetSampleRate / buffer.sampleRate;
  const newLength = Math.round(buffer.length * ratio);
  const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, newLength, targetSampleRate);
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const oldData = buffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < newLength; i++) {
      const oldIndex = i / ratio;
      const index1 = Math.floor(oldIndex);
      const index2 = Math.min(index1 + 1, oldData.length - 1);
      const fraction = oldIndex - index1;
      
      // Linear interpolation
      newData[i] = oldData[index1] * (1 - fraction) + oldData[index2] * fraction;
    }
  }
  
  return newBuffer;
};

// Helper function to convert stereo AudioBuffer to mono
const convertToMono = (buffer: AudioBuffer): AudioBuffer => {
  if (buffer.numberOfChannels === 1) {
    return buffer;
  }
  
  // Create a temporary audio context for buffer creation
  const tempContext = new AudioContext();
  const monoBuffer = tempContext.createBuffer(1, buffer.length, buffer.sampleRate);
  tempContext.close(); // Clean up immediately
  
  const monoData = monoBuffer.getChannelData(0);
  
  // Mix all channels to mono
  for (let i = 0; i < buffer.length; i++) {
    let sum = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      sum += buffer.getChannelData(channel)[i];
    }
    monoData[i] = sum / buffer.numberOfChannels;
  }
  
  return monoBuffer;
};

// Helper function to convert AudioBuffer to WAV format
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const length = buffer.length;
  const numberOfChannels = 1; // Force mono for backend compatibility
  const sampleRate = 16000; // Force 16kHz for backend compatibility
  const bytesPerSample = 2; // 16-bit samples
  const dataLength = length * bytesPerSample;
  const headerLength = 44;
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(arrayBuffer);
  
  // Write WAV header (standard RIFF format)
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // RIFF chunk descriptor
  writeString(0, 'RIFF');                    // ChunkID
  view.setUint32(4, headerLength + dataLength - 8, true); // ChunkSize
  writeString(8, 'WAVE');                    // Format
  
  // fmt sub-chunk
  writeString(12, 'fmt ');                   // Subchunk1ID
  view.setUint32(16, 16, true);              // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);               // AudioFormat (1 for PCM)
  view.setUint16(22, numberOfChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true);      // SampleRate
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true); // ByteRate
  view.setUint16(32, numberOfChannels * bytesPerSample, true); // BlockAlign
  view.setUint16(34, 16, true);              // BitsPerSample
  
  // data sub-chunk
  writeString(36, 'data');                   // Subchunk2ID
  view.setUint32(40, dataLength, true);      // Subchunk2Size
  
  // Write audio data (convert from float32 to int16)
  const channelData = buffer.getChannelData(0); // Get first channel
  let offset = headerLength;
  
  for (let i = 0; i < length; i++) {
    // Clamp and convert float32 [-1, 1] to int16 [-32768, 32767]
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    const intSample = Math.round(sample * 32767);
    view.setInt16(offset, intSample, true); // little-endian
    offset += 2;
  }
  
  return arrayBuffer;
};

// Helper function to get session-specific tips
const getSessionTips = (sessionType: string, language: string, focusAreas?: string[]) => {
  const tips: { [key: string]: string[] } = {
    presentation: [
      "Parlez clairement et prenez des pauses pour respirer",
      "Variez votre intonation pour captiver l'audience",
      "Maintenez un rythme constant et évitez de parler trop vite",
      "Utilisez des gestes pour renforcer vos propos"
    ],
    conversation: [
      "Écoutez activement et répondez de manière naturelle",
      "Posez des questions pour maintenir l'engagement",
      "Adaptez votre langage à votre interlocuteur",
      "Montrez de l'empathie dans vos réponses"
    ],
    pronunciation: [
      "Concentrez-vous sur la prononciation claire de chaque syllabe",
      "Répétez les mots difficiles plusieurs fois",
      "Enregistrez-vous et comparez avec des modèles natifs",
      "Pratiquez les sons spécifiques qui vous posent problème"
    ],
    reading: [
      "Lisez à voix haute en articulant bien",
      "Respectez la ponctuation pour les pauses",
      "Variez votre intonation selon le sens du texte",
      "Maintenez un rythme de lecture régulier"
    ]
  };

  const languageTips: { [key: string]: string[] } = {
    'en': [
      "Focus on clear consonant sounds",
      "Pay attention to word stress patterns",
      "Practice linking words together smoothly"
    ],
    'fr': [
      "Soignez la liaison entre les mots",
      "Accentuez la dernière syllabe des mots",
      "Travaillez l'intonation montante et descendante"
    ]
  };

  const baseSessionTips = tips[sessionType] || tips['presentation'];
  const langTips = languageTips[language] || [];
  
  return [...baseSessionTips.slice(0, 2), ...langTips.slice(0, 1)];
};

const SessionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Session store
  const { 
    currentSession,
    setCurrentSession,
    isRecording,
    setRecording,
    isConnected,
    connectWebSocket,
    disconnectWebSocket,
    audioLevel,
    setAudioLevel,
    realtimeFeedback,
    coachingResults,
    sendAudioChunk  // Add this to get the function reference
  } = useSessionStore();

  // API hooks
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession(id!);
  const { data: feedback } = useSessionFeedback(id!, {}, !!id);
  const uploadAudioMutation = useUploadAudio();
  const analyzeChunkMutation = useAnalyzeAudioChunk();
  const updateSessionMutation = useUpdateSession();

  // Audio recording state
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackAudio, setPlaybackAudio] = useState<HTMLAudioElement | null>(null);
  
  const intervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (session && session.id !== currentSession?.id) {
      setCurrentSession(session);
    }
  }, [session, currentSession, setCurrentSession]);

  useEffect(() => {
    if (id && !isConnected) {
      console.log('Attempting to connect WebSocket for session:', id);
      connectWebSocket(id)
        .then(() => {
          console.log('WebSocket connection successful for session:', id);
        })
        .catch((error) => {
          console.error('WebSocket connection failed for session:', id, error);
        });
    }

    return () => {
      if (isConnected) {
        console.log('Disconnecting WebSocket');
        disconnectWebSocket();
      }
    };
  }, [id, isConnected, connectWebSocket, disconnectWebSocket]);

  // Audio level monitoring
  useEffect(() => {
    if (isRecording && analyserRef.current) {
      const updateAudioLevel = () => {
        const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
        analyserRef.current!.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255 * 100);
        animationRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isRecording, setAudioLevel]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      
      setAudioStream(stream);

      // Setup audio analysis
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Use formats supported by backend's soundfile library
      // Priority: OGG/Opus (best soundfile support) -> WebM (as OGG fallback) -> MP4 (last resort)
      let options: MediaRecorderOptions = {};
      
      // OGG with Opus codec - best support in soundfile library
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options = { mimeType: 'audio/ogg;codecs=opus' };
        console.log('Using audio/ogg with Opus codec - optimal for soundfile backend');
      } 
      // Plain OGG
      else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: 'audio/ogg' };
        console.log('Using audio/ogg format - good soundfile compatibility');
      } 
      // WebM with Opus (same codec as OGG, can be renamed)
      else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
        console.log('Using WebM with Opus - will rename to OGG for backend compatibility');
      } 
      // Plain WebM
      else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
        console.log('Using WebM - will rename to OGG for backend compatibility');
      } 
      // MP4 as last resort (soundfile has limited M4A support)
      else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
        options = { mimeType: 'audio/mp4;codecs=mp4a.40.2' };
        console.warn('Using MP4 with AAC - limited soundfile support, may cause issues');
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
        console.warn('Using MP4 - limited soundfile support, may cause issues');
      } 
      else {
        console.error('No supported audio formats found!');
        // Set a default anyway
        options = { mimeType: 'audio/webm' };
      }
      
      const recorder = new MediaRecorder(stream, options);

      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      // Setup real-time analysis using modern AudioWorkletNode
      let realtimeProcessor: AudioWorkletNode | null = null;
      if (audioContextRef.current && analyserRef.current) {
        try {
          // Load AudioWorklet processor
          await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');
          
          realtimeProcessor = new AudioWorkletNode(audioContextRef.current, 'audio-analysis-processor');
          
          // Handle messages from AudioWorklet
          realtimeProcessor.port.onmessage = (event) => {
            if (event.data.type === 'audioData' && isConnected) {
              // Send audio chunk via WebSocket for real-time processing
              if (id && Math.random() < 0.3) { // ~30% chance for better real-time feedback
                console.log('Sending real-time audio chunk via WebSocket:', {
                  sessionId: id,
                  arrayLength: event.data.audioArray.length,
                  sampleRate: event.data.sampleRate,
                  duration: event.data.duration
                });
                
                // Convert audio array to base64 for WebSocket transmission
                const audioBytes = new Uint8Array(event.data.audioArray);
                const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(audioBytes)));
                
                // Send via WebSocket using the service
                const success = sendAudioChunk(base64Audio, event.data.sampleRate);
                if (!success) {
                  console.warn('Failed to send audio chunk via WebSocket');
                }
              }
            }
          };
          
          source.connect(realtimeProcessor);
          realtimeProcessor.connect(audioContextRef.current.destination);
        } catch (error) {
          console.warn('AudioWorklet not supported, falling back to ScriptProcessorNode:', error);
          // Fallback to ScriptProcessorNode for older browsers
          realtimeProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1) as any;
          
          (realtimeProcessor as any).onaudioprocess = (audioProcessingEvent: any) => {
            const inputBuffer = audioProcessingEvent.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            // Convert to unsigned byte array for backend analysis (0-255)
            const audioArray = new Uint8Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              // Convert from [-1, 1] float to [0, 255] uint8
              audioArray[i] = Math.max(0, Math.min(255, Math.round((inputData[i] + 1) * 127.5)));
            }
            
            // Send for real-time analysis via WebSocket with throttling
            if (id && isConnected && Math.random() < 0.1) {
              console.log('Sending real-time audio chunk via WebSocket (fallback):', {
                sessionId: id,
                arrayLength: audioArray.length,
                sampleRate: audioContextRef.current?.sampleRate || 16000,
                duration: inputData.length / (audioContextRef.current?.sampleRate || 16000)
              });
              
              // Convert to base64 for WebSocket transmission
              const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(audioArray)));
              
              const success = sendAudioChunk(
                base64Audio, 
                audioContextRef.current?.sampleRate || 16000
              );
              if (!success) {
                console.warn('Failed to send audio chunk via WebSocket (fallback)');
              }
            }
          };
          
          source.connect(realtimeProcessor as any);
          (realtimeProcessor as any).connect(audioContextRef.current.destination);
        }
      }

      recorder.onstop = async () => {
        // Clean up real-time processor
        if (realtimeProcessor) {
          realtimeProcessor.disconnect();
          if ('port' in realtimeProcessor) {
            // AudioWorkletNode cleanup
            realtimeProcessor.port.onmessage = null;
          }
          realtimeProcessor = null;
        }
        
        const mimeType = options.mimeType || 'audio/ogg';
        const audioBlob = new Blob(chunks, { type: mimeType });
        
        // Map to backend-supported extensions: .wav, .mp3, .m4a, .ogg
        let extension = 'ogg';
        let finalMimeType = mimeType;
        
        if (mimeType.includes('ogg')) {
          extension = 'ogg';
          finalMimeType = 'audio/ogg';
        } else if (mimeType.includes('webm')) {
          // WebM with Opus codec is very similar to OGG/Opus
          // Rename to .ogg for backend compatibility
          extension = 'ogg';
          finalMimeType = 'audio/ogg';
          console.log('Converting WebM to OGG format for backend compatibility');
        } else if (mimeType.includes('mp4')) {
          extension = 'm4a';
          finalMimeType = 'audio/mp4';
          console.warn('Using MP4 format - may have limited backend support');
        } else if (mimeType.includes('wav')) {
          extension = 'wav';
          finalMimeType = 'audio/wav';
        } else {
          // Unknown format - default to OGG
          extension = 'ogg';
          finalMimeType = 'audio/ogg';
          console.warn('Unknown audio format, defaulting to OGG');
        }
        
        console.log('Created audio file:', {
          name: `recording-${Date.now()}.${extension}`,
          type: finalMimeType,
          size: audioBlob.size,
          originalMimeType: mimeType
        });

        // Validate audio blob before creating file
        if (audioBlob.size === 0) {
          console.error('Audio blob is empty');
          alert('Erreur: L\'enregistrement audio est vide. Veuillez réessayer.');
          return;
        }

        if (audioBlob.size < 1000) {
          console.warn('Audio blob is very small:', audioBlob.size, 'bytes');
          alert('Attention: L\'enregistrement audio semble très court. Continuer quand même?');
        }

        // Convert audio to WAV format for maximum backend compatibility
        let audioFile: File;
        try {
          if (mimeType.includes('webm') || mimeType.includes('ogg') || mimeType.includes('mp4')) {
            console.log('Converting audio to WAV format for backend compatibility...');
            audioFile = await convertToWav(audioBlob, `recording-${Date.now()}.wav`);
          } else {
            audioFile = new File([audioBlob], `recording-${Date.now()}.${extension}`, {
              type: finalMimeType
            });
          }
        } catch (conversionError) {
          console.error('Audio conversion failed, uploading original:', conversionError);
          audioFile = new File([audioBlob], `recording-${Date.now()}.${extension}`, {
            type: finalMimeType
          });
        }

        // Upload the complete recording
        if (id) {
          try {
            console.log('Uploading audio file:', {
              sessionId: id,
              fileName: audioFile.name,
              fileSize: audioFile.size,
              fileType: audioFile.type,
              originalBlobType: audioBlob.type,
              originalBlobSize: audioBlob.size,
              recordingOptions: options,
              chunks: audioChunks.length,
              converted: audioFile.type === 'audio/wav' && audioBlob.type !== 'audio/wav'
            });
            
            // Upload with immediate processing and feedback generation
            const result = await uploadAudioMutation.mutateAsync({
              sessionId: id,
              file: audioFile,
              options: {
                processImmediately: true,  // Enable immediate processing
                generateFeedback: true     // Enable AI feedback generation
              }
            });
            
            console.log('Audio upload successful:', result);
          } catch (error: any) {
            console.error('Failed to upload audio:', error);
            console.error('Full error object:', JSON.stringify(error, null, 2));
            
            // Show detailed error to user
            const errorMessage = error?.message || 'Erreur inconnue lors de l\'upload audio';
            const errorDetails = error?.status ? `Code d'erreur: ${error.status}` : '';
            
            // Try to extract more specific error information
            let specificError = '';
            if (error?.message?.includes('Format not recognised')) {
              specificError = '\n\nLe backend ne peut pas reconnaître le format audio. Cela peut être dû à:\n- Format audio non supporté\n- Fichier audio corrompu\n- Codecs manquants sur le serveur';
            }
            
            alert(`Échec de l'upload audio: ${errorMessage}\n${errorDetails}${specificError}\n\nVérifiez la connexion au backend.`);
          }
        }

        setPlaybackAudio(new Audio(URL.createObjectURL(audioBlob)));
      };

      setMediaRecorder(recorder);
      recorder.start(1000); // Capture in 1-second chunks
      setRecording(true);
      setRecordingTime(0);
      
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      
      let errorMessage = 'Erreur inconnue lors de l\'accès au microphone';
      if (error?.name === 'NotAllowedError') {
        errorMessage = 'Accès au microphone refusé. Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.';
      } else if (error?.name === 'NotFoundError') {
        errorMessage = 'Aucun microphone détecté. Veuillez connecter un microphone et réessayer.';
      } else if (error?.name === 'NotSupportedError') {
        errorMessage = 'Votre navigateur ne supporte pas l\'enregistrement audio.';
      } else if (error?.name === 'NotReadableError') {
        errorMessage = 'Le microphone est déjà utilisé par une autre application.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setRecording(false);
      
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Update session status
      if (id) {
        updateSessionMutation.mutate({
          id,
          updates: { 
            status: 'completed',
            duration: recordingTime
          }
        });
      }
    }
  };

  const togglePlayback = () => {
    if (playbackAudio) {
      if (isPlaying) {
        playbackAudio.pause();
        setIsPlaying(false);
      } else {
        playbackAudio.play();
        setIsPlaying(true);
        
        playbackAudio.onended = () => setIsPlaying(false);
      }
    }
  };

  const saveSession = async () => {
    if (!id) return;
    
    try {
      // Marquer la session comme complétée
      await updateSessionMutation.mutateAsync({
        id,
        updates: {
          status: 'completed',
          ended_at: new Date().toISOString()
        }
      });
      
      // Afficher un message de succès
      alert('Session sauvegardée avec succès !');
      
      // Rediriger vers la liste des sessions
      navigate('/sessions');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la session');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Session not found</h3>
              <p className="text-sm text-red-500">
                {(sessionError as any)?.message || 'Session could not be loaded'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/sessions')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sessions
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{session.title}</h1>
            <div className="flex items-center space-x-3 mt-1">
              <Badge variant="default" className="capitalize">
                {session.session_type}
              </Badge>
              <Badge variant="info" className="uppercase">
                {session.language}
              </Badge>
              <Badge 
                variant={
                  session.status === 'completed' ? 'success' :
                  session.status === 'active' ? 'warning' : 'default'
                }
              >
                {session.status}
              </Badge>
              <span className="text-sm text-slate-400">
                {new Date(session.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Session Details */}
      {session.description && (
        <Card className="p-4">
          <h3 className="font-semibold text-slate-100 mb-2">Description</h3>
          <p className="text-slate-300 text-sm">{session.description}</p>
        </Card>
      )}

      {/* Session Configuration */}
      <Card className="p-4">
        <h3 className="font-semibold text-slate-100 mb-3">Configuration de session</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Type</p>
            <p className="text-sm text-slate-200 font-medium capitalize">{session.session_type}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Langue</p>
            <p className="text-sm text-slate-200 font-medium uppercase">{session.language}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Difficulté</p>
            <p className="text-sm text-slate-200 font-medium capitalize">{session.config?.difficulty || 'Medium'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Durée cible</p>
            <p className="text-sm text-slate-200 font-medium">{session.config?.duration_target || 5} min</p>
          </div>
        </div>
        
        {session.config?.focus_areas && session.config.focus_areas.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Focus Areas</p>
            <div className="flex flex-wrap gap-2">
              {session.config.focus_areas.map((area, index) => (
                <Badge key={index} variant="primary" size="sm">
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {session.config?.custom_prompt && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Instructions personnalisées</p>
            <p className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              {session.config.custom_prompt}
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recording Interface */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="text-center space-y-6">
              {/* Audio Visualizer */}
              <div className="relative">
                <div className="flex items-center justify-center space-x-2 h-24">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 bg-gradient-to-t from-primary-500 to-primary-300 rounded-full transition-all duration-150 ${
                        isRecording ? 'animate-wave' : ''
                      }`}
                      style={{
                        height: isRecording 
                          ? `${Math.random() * 60 + 10}px` 
                          : '10px',
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
                
                {/* Connection Status */}
                <div className="absolute top-0 right-0">
                  {isConnected ? (
                    <div className="flex items-center space-x-1 text-green-600 text-xs">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-red-600 text-xs">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span>Disconnected</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recording Time */}
              <div className="text-3xl font-mono font-bold text-slate-100">
                {formatTime(recordingTime)}
              </div>

              {/* Audio Level */}
              {isRecording && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    <Volume2 className="w-4 h-4 text-slate-400" />
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-red-500 transition-all duration-150"
                        style={{ width: `${audioLevel}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Audio level: {Math.round(audioLevel)}%</p>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex items-center justify-center space-x-4">
                {!isRecording ? (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={startRecording}
                    className="h-16 w-16 rounded-full p-0"
                  >
                    <Mic className="w-6 h-6" />
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={stopRecording}
                    className="h-16 w-16 rounded-full p-0 bg-red-500 hover:bg-red-600 text-white"
                  >
                    <Square className="w-6 h-6" />
                  </Button>
                )}

                {playbackAudio && (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={togglePlayback}
                      className="h-12 w-12 rounded-full p-0"
                    >
                      {isPlaying ? 
                        <Pause className="w-5 h-5" /> : 
                        <Play className="w-5 h-5" />
                      }
                    </Button>
                    
                    <Button
                      variant="success"
                      size="lg"
                      onClick={saveSession}
                      disabled={updateSessionMutation.isPending}
                      className="px-6 py-2"
                    >
                      {updateSessionMutation.isPending ? 'Sauvegarde...' : '✓ Valider l\'enregistrement'}
                    </Button>
                  </>
                )}
              </div>

              <div className="text-sm text-center space-y-2">
                <p className="text-slate-300">
                  {isRecording 
                    ? 'Enregistrement en cours... Cliquez sur stop pour terminer.'
                    : audioChunks.length > 0
                    ? 'Enregistrement terminé. Vous pouvez l\'écouter et cliquer sur "Valider l\'enregistrement" pour sauvegarder.'
                    : session.status === 'completed'
                    ? 'Cette session a été complétée.'
                    : 'Cliquez sur le microphone pour commencer l\'enregistrement.'
                  }
                </p>
                
                {!isConnected && (
                  <p className="text-yellow-400 text-xs">
                    ⚠️ Connexion WebSocket déconnectée - Le feedback temps réel n'est pas disponible
                  </p>
                )}
                
                {uploadAudioMutation.isPending && (
                  <p className="text-blue-400 text-xs">
                    📤 Upload de l'audio en cours...
                  </p>
                )}
                
                {analyzeChunkMutation.isPending && (
                  <p className="text-purple-400 text-xs">
                    🧠 Analyse en temps réel en cours...
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Session Info & Real-time Feedback */}
        <div className="space-y-6">
          {/* Session Details */}
          <Card className="p-4">
            <h3 className="font-semibold text-slate-100 mb-3">Session Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium capitalize">{session.session_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Language:</span>
                <span className="font-medium uppercase">{session.language}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Difficulty:</span>
                <span className="font-medium capitalize">{session.config?.difficulty || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Target Duration:</span>
                <span className="font-medium">
                  {session.config?.duration_target 
                    ? `${Math.round(session.config.duration_target / 60)}min` 
                    : 'N/A'
                  }
                </span>
              </div>
              {session.config?.focus_areas && session.config.focus_areas.length > 0 && (
                <div>
                  <span className="text-slate-400">Focus Areas:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {session.config.focus_areas.map((area: string) => (
                      <Badge key={area} variant="info" size="sm">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Personalized Tips */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100">Conseils personnalisés</h3>
              <Badge variant="primary" size="sm">
                {session.session_type}
              </Badge>
            </div>
            
            <div className="space-y-3">
              {getSessionTips(session.session_type, session.language, session.config?.focus_areas).map((tip, index) => (
                <div key={index} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-purple-200">
                      {tip}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Real-time Feedback */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100">Real-time Feedback</h3>
              <Badge variant={realtimeFeedback.length > 0 ? 'success' : 'default'} size="sm">
                {realtimeFeedback.length} insights
              </Badge>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {realtimeFeedback.length > 0 ? (
                realtimeFeedback.slice(-5).map((feedback, index) => (
                  <div key={index} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-blue-300 font-medium">
                          {feedback.feedback_type}
                        </p>
                        <p className="text-xs text-blue-200 mt-1">
                          {feedback.message}
                        </p>
                        {feedback.confidence && (
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="text-xs text-blue-400">
                              Confidence: {Math.round(feedback.confidence * 100)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  {isRecording 
                    ? 'Start speaking to receive real-time feedback...'
                    : 'No feedback available yet'
                  }
                </p>
              )}
            </div>
          </Card>

          {/* Coaching Results */}
          {coachingResults.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-100">Coaching Results</h3>
                <Badge variant="success" size="sm">
                  {coachingResults.length} results
                </Badge>
              </div>
              
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {coachingResults.slice(-3).map((result, index) => (
                  <div key={index} className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-emerald-300 font-medium">
                          {result.result_type}
                        </p>
                        <p className="text-xs text-emerald-200 mt-1">
                          {result.message}
                        </p>
                        {result.score && (
                          <div className="text-xs text-emerald-400 mt-1">
                            Score: {Math.round(result.score * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Session History/Feedback */}
      {feedback?.data && feedback.data.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Session Feedback</h2>
            <Button variant="outline" size="sm">
              <MessageSquare className="w-4 h-4 mr-2" />
              View All Feedback
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feedback.data.slice(0, 6).map((item: any) => (
              <div key={item.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="info" size="sm" className="capitalize">
                    {item.feedback_type}
                  </Badge>
                  {item.score && (
                    <span className="text-sm font-medium">
                      {Math.round(item.score * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700">
                  {item.content}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default SessionDetailPage;