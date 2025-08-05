import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  User, 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Globe, 
  Palette,
  Mic,
  Volume2,
  AlertCircle,
  CheckCircle,
  Save,
  Trash2
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../contexts/LanguageContext';
import { Button, Card, Input, Badge } from '../components/ui';
import { SupportedLanguage } from '../types';
import AudioSettings from '../components/settings/AudioSettings';

const profileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email'),
  current_password: z.string().optional(),
  new_password: z.string().optional(),
  confirm_password: z.string().optional(),
}).refine((data) => {
  if (data.new_password && !data.current_password) {
    return false;
  }
  if (data.new_password && data.new_password !== data.confirm_password) {
    return false;
  }
  return true;
}, {
  message: "Password confirmation doesn't match",
  path: ['confirm_password'],
});

type ProfileFormData = z.infer<typeof profileSchema>;

const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'audio' | 'privacy'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [audioInputDevice, setAudioInputDevice] = useState<string>('');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Audio settings state
  const [audioSettings, setAudioSettings] = useState({
    microphoneId: '',
    speakerId: '',
    microphoneSensitivity: 50,
    speakerVolume: 80,
    noiseReduction: true,
    autoGainControl: true,
    echoCancellation: true,
    sampleRate: 44100,
    bitDepth: 16
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
    }
  });

  // Load audio devices
  React.useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        
        // Set default device
        if (audioInputs.length > 0 && !audioInputDevice) {
          setAudioInputDevice(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to load audio devices:', error);
      }
    };

    loadAudioDevices();
  }, [audioInputDevice]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // In a real app, this would make an API call
      updateUser({
        username: data.username,
        email: data.email,
      });
      
      setSaveMessage('Profile updated successfully!');
      
      // Clear password fields
      reset({
        ...data,
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error) {
      setSaveMessage('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handleLanguageChange = (newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage);
    setSaveMessage(t('settings.updated'));
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { deviceId: audioInputDevice || undefined } 
      });
      
      // Simple audio level test
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      let testDuration = 3000; // 3 seconds
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        console.log('Audio level:', average);
        
        testDuration -= 100;
        if (testDuration <= 0) {
          clearInterval(interval);
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
          setSaveMessage('Microphone test completed successfully!');
          setTimeout(() => setSaveMessage(null), 3000);
        }
      }, 100);
      
    } catch (error) {
      console.error('Microphone test failed:', error);
      setSaveMessage('Microphone test failed. Please check permissions.');
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Profile Information</h3>
              <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Username *
                    </label>
                    <Input
                      {...register('username')}
                      error={errors.username?.message}
                      disabled={isSaving}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email *
                    </label>
                    <Input
                      {...register('email')}
                      type="email"
                      error={errors.email?.message}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium text-slate-100 mb-4">Change Password</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Current Password
                      </label>
                      <Input
                        {...register('current_password')}
                        type="password"
                        placeholder="Enter current password"
                        disabled={isSaving}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          New Password
                        </label>
                        <Input
                          {...register('new_password')}
                          type="password"
                          placeholder="Enter new password"
                          disabled={isSaving}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Confirm New Password
                        </label>
                        <Input
                          {...register('confirm_password')}
                          type="password"
                          placeholder="Confirm new password"
                          error={errors.confirm_password?.message}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    variant="primary"
                    loading={isSaving}
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 dark:text-gray-100 mb-4">Apparence & Localisation</h3>
              <div className="space-y-6">
                {/* Theme Settings */}
                <div>
                  <p className="text-sm text-slate-400">Mode sombre activé par défaut</p>
                </div>

                {/* Language Settings */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-gray-300 mb-3">
                    {t('settings.language')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'en' as SupportedLanguage, label: 'English', flag: '🇺🇸' },
                      { value: 'fr' as SupportedLanguage, label: 'Français', flag: '🇫🇷' }
                    ].map((lang) => (
                      <div
                        key={lang.value}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          language === lang.value
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleLanguageChange(lang.value)}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{lang.flag}</span>
                          <div>
                            <h4 className="font-medium text-slate-100">{lang.value === 'en' ? t('settings.english') : t('settings.french')}</h4>
                            <p className="text-sm text-gray-600">
                              {lang.value === 'en' ? 'Interface and coaching in English' : 'Interface et coaching en français'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Coaching Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-100">Real-time Feedback</h4>
                    <p className="text-sm text-gray-600">Receive instant feedback during recording</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-100">Auto Transcription</h4>
                    <p className="text-sm text-gray-600">Automatically transcribe your speech</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-100">Voice Analysis</h4>
                    <p className="text-sm text-gray-600">Analyze tone, pace, and clarity</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-6">
            <AudioSettings
              settings={audioSettings}
              onSettingsChange={setAudioSettings}
            />
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Privacy & Data</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-100">Data Collection</h4>
                    <p className="text-sm text-gray-600">Allow collection of usage data for improvement</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-100">Audio Storage</h4>
                    <p className="text-sm text-gray-600">Store audio recordings for analysis</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Data Management</h3>
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Export Your Data</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Download all your session data, feedback, and analytics in JSON format.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3">
                        Export Data
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-900">Delete Account</h4>
                      <p className="text-sm text-red-700 mt-1">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                      <Button variant="secondary" size="sm" className="mt-3 bg-red-500 hover:bg-red-600 text-white">
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
    { id: 'audio', label: 'Audio', icon: Mic },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ] as const;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">{t('settings.title')}</h1>
        <p className="text-gray-600">{t('settings.subtitle')}</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className="mb-6">
          <div className={`flex items-center space-x-2 p-3 rounded-lg ${
            saveMessage.includes('successfully') || saveMessage.includes('updated')
              ? 'text-green-600 bg-green-50 border border-green-200'
              : 'text-red-600 bg-red-50 border border-red-200'
          }`}>
            {saveMessage.includes('successfully') || saveMessage.includes('updated') ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-sm">{saveMessage}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card className="p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            {renderTabContent()}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;