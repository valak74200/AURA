import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FuturisticHero,
  DIDAgentInterface,
  LiveSummaryPanel,
  MetricsDashboard,
  AudioSettings,
  LanguageSwitcher,
  PricingCards,
  ContactForm
} from '../components';
import type { 
  TranscriptSegment, 
  LiveInsight, 
  FeedbackItem,
  MetricData 
} from '../components/summary/LiveSummaryPanel';

const ComponentsDemo: React.FC = () => {
  const { t } = useTranslation();
  const [selectedComponent, setSelectedComponent] = useState<string>('hero');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Mock data for components
  const mockTranscript: TranscriptSegment[] = [
    {
      id: '1',
      timestamp: Date.now() - 30000,
      text: "Hello, I'm ready to start my presentation training session.",
      speaker: 'user',
      confidence: 0.95,
      emotions: ['confident'],
      keywords: ['ready', 'presentation']
    },
    {
      id: '2',
      timestamp: Date.now() - 25000,
      text: "Great! I can see you're speaking clearly. Try to maintain this pace throughout your presentation.",
      speaker: 'ai',
      confidence: 0.98,
      emotions: ['encouraging'],
      keywords: ['clearly', 'pace']
    },
    {
      id: '3',
      timestamp: Date.now() - 20000,
      text: "I'll focus on my key points and remember to pause between sections.",
      speaker: 'user',
      confidence: 0.92,
      emotions: ['focused'],
      keywords: ['key points', 'pause']
    }
  ];

  const mockInsights: LiveInsight[] = [
    {
      id: '1',
      type: 'pace',
      title: 'Speaking Pace',
      value: '145 WPM',
      change: 12,
      description: 'Your speaking pace has improved by 12% since last session. You\'re maintaining an optimal rate for audience comprehension.',
      timestamp: Date.now() - 5000
    },
    {
      id: '2',
      type: 'clarity',
      title: 'Speech Clarity',
      value: '94%',
      change: 8,
      description: 'Excellent articulation! Your clarity score shows significant improvement in pronunciation and enunciation.',
      timestamp: Date.now() - 3000
    },
    {
      id: '3',
      type: 'volume',
      title: 'Volume Level',
      value: '78 dB',
      change: -2,
      description: 'Consider increasing your volume slightly to ensure all audience members can hear you clearly.',
      timestamp: Date.now() - 1000
    }
  ];

  const mockFeedback: FeedbackItem[] = [
    {
      id: '1',
      type: 'achievement',
      title: 'Great Improvement!',
      message: 'You\'ve successfully maintained consistent pacing throughout this section. This will help your audience follow along more easily.',
      timestamp: Date.now() - 10000,
      priority: 'high'
    },
    {
      id: '2',
      type: 'suggestion',
      title: 'Pause Technique',
      message: 'Try adding strategic pauses after key points to give your audience time to process important information.',
      timestamp: Date.now() - 8000,
      priority: 'medium'
    }
  ];

  const mockMetricsData: MetricData[] = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    clarity: Math.floor(Math.random() * 30) + 70,
    pace: Math.floor(Math.random() * 25) + 75,
    volume: Math.floor(Math.random() * 20) + 80,
    engagement: Math.floor(Math.random() * 35) + 65,
    overall: Math.floor(Math.random() * 20) + 80,
  }));

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

  const components = [
    { id: 'hero', name: 'Hero Section', description: 'Landing page hero with glassmorphism effects' },
    { id: 'agent', name: 'D-ID Agent Interface', description: 'Video/audio agent controls' },
    { id: 'summary', name: 'Live Summary Panel', description: 'Real-time transcript and insights' },
    { id: 'metrics', name: 'Metrics Dashboard', description: 'Charts and performance analytics' },
    { id: 'audio', name: 'Audio Settings', description: 'Device configuration and controls' },
    { id: 'language', name: 'Language Switcher', description: 'Multi-language support' },
    { id: 'pricing', name: 'Pricing Cards', description: 'Subscription plans with Stripe' },
    { id: 'forms', name: 'Accessible Forms', description: 'Form components with validation' }
  ];

  const handlePlanSelect = async (planId: string, priceId?: string) => {
    console.log('Selected plan:', planId, 'Price ID:', priceId);
    // Implement Stripe checkout here
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
  };

  const handleContactSubmit = async (data: any) => {
    console.log('Contact form data:', data);
    // Implement form submission here
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
  };

  const renderComponent = () => {
    switch (selectedComponent) {
      case 'hero':
        return (
          <FuturisticHero
            onStartTrial={() => console.log('Start trial clicked')}
            onWatchDemo={() => console.log('Watch demo clicked')}
          />
        );

      case 'agent':
        return (
          <div className="max-w-4xl mx-auto">
            <DIDAgentInterface
              sessionId="demo-session-123"
              onSessionStart={() => console.log('Session started')}
              onSessionStop={() => console.log('Session stopped')}
              onSessionPause={() => console.log('Session paused')}
              onSessionResume={() => console.log('Session resumed')}
              onMuteToggle={(muted) => console.log('Mute toggled:', muted)}
              onVolumeChange={(volume) => console.log('Volume changed:', volume)}
            />
          </div>
        );

      case 'summary':
        return (
          <div className="max-w-4xl mx-auto">
            <LiveSummaryPanel
              transcript={mockTranscript}
              insights={mockInsights}
              feedback={mockFeedback}
              isRecording={true}
              onTranscriptPause={() => console.log('Transcript paused')}
              onTranscriptResume={() => console.log('Transcript resumed')}
              onTranscriptClear={() => console.log('Transcript cleared')}
              onExportTranscript={() => console.log('Transcript exported')}
            />
          </div>
        );

      case 'metrics':
        return (
          <div className="max-w-7xl mx-auto">
            <MetricsDashboard
              data={mockMetricsData}
              timeRange="30d"
              onTimeRangeChange={(range) => console.log('Time range changed:', range)}
            />
          </div>
        );

      case 'audio':
        return (
          <div className="max-w-4xl mx-auto">
            <AudioSettings
              settings={audioSettings}
              onSettingsChange={setAudioSettings}
            />
          </div>
        );

      case 'language':
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-4">Language Switcher Variants</h3>
            </div>
            
            <div className="grid gap-8">
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white">Dropdown Variant</h4>
                <div className="flex justify-center">
                  <LanguageSwitcher variant="dropdown" size="md" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white">Full Toggle Variant</h4>
                <div className="flex justify-center">
                  <LanguageSwitcher variant="full" size="md" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white">Compact Variant</h4>
                <div className="flex justify-center">
                  <LanguageSwitcher variant="compact" size="md" />
                </div>
              </div>
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="max-w-7xl mx-auto">
            <PricingCards
              billingCycle={billingCycle}
              onBillingCycleChange={setBillingCycle}
              onSelectPlan={handlePlanSelect}
              currentPlan="free"
            />
          </div>
        );

      case 'forms':
        return (
          <div className="max-w-2xl mx-auto">
            <div className="bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-3xl shadow-glass p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Contact Us</h3>
                <p className="text-gray-400">Get in touch with our team</p>
              </div>
              
              <ContactForm
                onSubmit={handleContactSubmit}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-neural-pattern opacity-20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="container mx-auto px-6 py-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Components Showcase
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Interactive demonstration of all UI components with futuristic design, 
              glassmorphism effects, and full accessibility support.
            </p>
          </div>

          {/* Component Navigation */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {components.map((component) => (
              <button
                key={component.id}
                onClick={() => setSelectedComponent(component.id)}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                  selectedComponent === component.id
                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-neon'
                    : 'bg-glass-gradient border border-glass-300 text-gray-300 hover:text-white hover:bg-glass-200'
                }`}
                title={component.description}
              >
                {component.name}
              </button>
            ))}
          </div>
        </div>

        {/* Component Display */}
        <div className="container mx-auto px-6 pb-20">
          <motion.div
            key={selectedComponent}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {renderComponent()}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="bg-glass-gradient backdrop-blur-xl border border-glass-300 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Component Features
            </h3>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-400">
              <span>✨ Glassmorphism Effects</span>
              <span>🎨 Futuristic Design</span>
              <span>📱 Fully Responsive</span>
              <span>♿ WCAG 2.1 AA Compliant</span>
              <span>🌐 i18n Support (FR/EN)</span>
              <span>🎭 Framer Motion Animations</span>
              <span>⚡ TypeScript + Zod Validation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComponentsDemo;