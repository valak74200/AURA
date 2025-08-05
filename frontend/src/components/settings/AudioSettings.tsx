import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  Volume2,
  Headphones,
  Settings,
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
  Sliders,
  Zap
} from 'lucide-react';

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId: string;
}

interface AudioSettings {
  microphoneId: string;
  speakerId: string;
  microphoneSensitivity: number;
  speakerVolume: number;
  noiseReduction: boolean;
  autoGainControl: boolean;
  echoCancellation: boolean;
  sampleRate: number;
  bitDepth: number;
}

export interface AudioSettingsProps {
  settings: AudioSettings;
  onSettingsChange: (settings: AudioSettings) => void;
  className?: string;
}

const AudioSettings: React.FC<AudioSettingsProps> = ({
  settings,
  onSettingsChange,
  className = ''
}) => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'loading'>('prompt');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    checkPermissions();
    enumerateDevices();
    
    return () => {
      stopMicrophoneTest();
      stopSpeakerTest();
    };
  }, []);

  const checkPermissions = async () => {
    setPermissionStatus('loading');
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setPermissionStatus(permission.state);
      
      permission.onchange = () => {
        setPermissionStatus(permission.state);
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionStatus('prompt');
    }
  };

  const enumerateDevices = async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: AudioDevice[] = deviceList
        .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 8)}`,
          kind: device.kind as 'audioinput' | 'audiooutput',
          groupId: device.groupId
        }));
      
      setDevices(audioDevices);
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  };

  const requestMicrophoneAccess = async () => {
    try {
      setPermissionStatus('loading');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately after getting permission
      setPermissionStatus('granted');
      await enumerateDevices(); // Re-enumerate to get device labels
    } catch (error) {
      console.error('Error requesting microphone access:', error);
      setPermissionStatus('denied');
    }
  };

  const startMicrophoneTest = async () => {
    try {
      setIsTestingMic(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.microphoneId ? { exact: settings.microphoneId } : undefined,
          autoGainControl: settings.autoGainControl,
          noiseSuppression: settings.noiseReduction,
          echoCancellation: settings.echoCancellation,
          sampleRate: settings.sampleRate
        }
      });

      setMediaStream(stream);

      const context = new AudioContext();
      const analyserNode = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      
      analyserNode.fftSize = 256;
      source.connect(analyserNode);

      setAudioContext(context);
      setAnalyser(analyserNode);

      const updateLevel = () => {
        if (analyserNode) {
          const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
          analyserNode.getByteFrequencyData(dataArray);
          
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = (average / 255) * 100;
          
          setMicrophoneLevel(normalizedLevel);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (error) {
      console.error('Error starting microphone test:', error);
      setIsTestingMic(false);
    }
  };

  const stopMicrophoneTest = () => {
    setIsTestingMic(false);
    setMicrophoneLevel(0);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
    
    setAnalyser(null);
  };

  const testSpeakers = () => {
    setIsTestingSpeaker(true);
    
    // Create a simple test tone
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.frequency.setValueAtTime(440, context.currentTime); // A4 note
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(settings.speakerVolume / 100 * 0.1, context.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 1);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 1);
    
    setTimeout(() => {
      setIsTestingSpeaker(false);
      context.close();
    }, 1000);
  };

  const updateSettings = (key: keyof AudioSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
  };

  const resetToDefaults = () => {
    const defaultSettings: AudioSettings = {
      microphoneId: '',
      speakerId: '',
      microphoneSensitivity: 50,
      speakerVolume: 80,
      noiseReduction: true,
      autoGainControl: true,
      echoCancellation: true,
      sampleRate: 44100,
      bitDepth: 16
    };
    onSettingsChange(defaultSettings);
  };

  const microphones = devices.filter(device => device.kind === 'audioinput');
  const speakers = devices.filter(device => device.kind === 'audiooutput');

  const sampleRateOptions = [
    { value: 44100, label: '44.1 kHz (CD Quality)' },
    { value: 48000, label: '48 kHz (Professional)' },
    { value: 96000, label: '96 kHz (High-Res)' }
  ];

  const bitDepthOptions = [
    { value: 16, label: '16-bit' },
    { value: 24, label: '24-bit' },
    { value: 32, label: '32-bit' }
  ];

  return (
    <div className={`bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-3xl shadow-glass overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-glass-300">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{t('settings.title')}</h3>
            <p className="text-gray-400">{t('settings.subtitle')}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Permission Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg">
              {permissionStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              ) : permissionStatus === 'granted' ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : permissionStatus === 'denied' ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <Activity className="w-4 h-4 text-yellow-400" />
              )}
              <span className="text-xs text-gray-300 capitalize">{permissionStatus}</span>
            </div>
            
            <button
              onClick={resetToDefaults}
              className="p-2 bg-glass-gradient border border-glass-300 backdrop-blur-sm rounded-lg transition-all duration-300 hover:bg-glass-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
              aria-label="Reset to defaults"
            >
              <RotateCcw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Permission Request */}
        {permissionStatus !== 'granted' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-white font-medium mb-1">Microphone Access Required</p>
                <p className="text-gray-300 text-sm">
                  Grant microphone access to test audio devices and configure settings.
                </p>
              </div>
              <button
                onClick={requestMicrophoneAccess}
                disabled={permissionStatus === 'loading'}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {permissionStatus === 'loading' ? 'Requesting...' : 'Grant Access'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Microphone Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Mic className="w-5 h-5 text-green-400" />
            </div>
            <h4 className="text-lg font-semibold text-white">{t('settings.microphone.title')}</h4>
          </div>

          <div className="grid gap-4">
            {/* Microphone Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.microphone.select')}
              </label>
              <select
                value={settings.microphoneId}
                onChange={(e) => updateSettings('microphoneId', e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                disabled={permissionStatus !== 'granted'}
              >
                <option value="">Default Microphone</option>
                {microphones.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Microphone Test */}
            <div className="flex items-center gap-4">
              <button
                onClick={isTestingMic ? stopMicrophoneTest : startMicrophoneTest}
                disabled={permissionStatus !== 'granted'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                  isTestingMic
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isTestingMic ? (
                  <>
                    <Square className="w-4 h-4" />
                    Stop Test
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('settings.microphone.test')}
                  </>
                )}
              </button>

              {/* Microphone Level Indicator */}
              <div className="flex-1 max-w-48">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-500 to-yellow-500"
                    style={{ width: `${microphoneLevel}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Level: {Math.round(microphoneLevel)}%
                </p>
              </div>
            </div>

            {/* Microphone Sensitivity */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.microphone.sensitivity')}: {settings.microphoneSensitivity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.microphoneSensitivity}
                onChange={(e) => updateSettings('microphoneSensitivity', Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Noise Reduction */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                {t('settings.microphone.noise_reduction')}
              </label>
              <button
                onClick={() => updateSettings('noiseReduction', !settings.noiseReduction)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  settings.noiseReduction ? 'bg-primary-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.noiseReduction ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Speaker Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Volume2 className="w-5 h-5 text-blue-400" />
            </div>
            <h4 className="text-lg font-semibold text-white">{t('settings.speaker.title')}</h4>
          </div>

          <div className="grid gap-4">
            {/* Speaker Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.speaker.select')}
              </label>
              <select
                value={settings.speakerId}
                onChange={(e) => updateSettings('speakerId', e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              >
                <option value="">Default Speaker</option>
                {speakers.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Speaker Test */}
            <div>
              <button
                onClick={testSpeakers}
                disabled={isTestingSpeaker}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                  isTestingSpeaker
                    ? 'bg-blue-500 text-white cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isTestingSpeaker ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('settings.speaker.test')}
                  </>
                )}
              </button>
            </div>

            {/* Speaker Volume */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.speaker.volume')}: {settings.speakerVolume}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.speakerVolume}
                onChange={(e) => updateSettings('speakerVolume', Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Sliders className="w-5 h-5 text-purple-400" />
            </div>
            <h4 className="text-lg font-semibold text-white">{t('settings.quality.title')}</h4>
          </div>

          <div className="grid gap-4">
            {/* Sample Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.quality.sample_rate')}
              </label>
              <select
                value={settings.sampleRate}
                onChange={(e) => updateSettings('sampleRate', Number(e.target.value))}
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              >
                {sampleRateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bit Depth */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.quality.bit_depth')}
              </label>
              <select
                value={settings.bitDepth}
                onChange={(e) => updateSettings('bitDepth', Number(e.target.value))}
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              >
                {bitDepthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto Gain Control */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                {t('settings.quality.auto_gain')}
              </label>
              <button
                onClick={() => updateSettings('autoGainControl', !settings.autoGainControl)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  settings.autoGainControl ? 'bg-primary-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.autoGainControl ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Echo Cancellation */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Echo Cancellation
              </label>
              <button
                onClick={() => updateSettings('echoCancellation', !settings.echoCancellation)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  settings.echoCancellation ? 'bg-primary-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    settings.echoCancellation ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for range sliders */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0087ff, #d946ef);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0087ff, #d946ef);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
};

export default AudioSettings;