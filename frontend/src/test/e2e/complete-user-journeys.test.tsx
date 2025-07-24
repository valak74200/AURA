/**
 * Tests End-to-End Frontend pour AURA
 * Tests complets des parcours utilisateurs depuis l'interface
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from '../../App.tsx';
import { AuthProvider } from '../../contexts/AuthContext.tsx';
import { ThemeProvider } from '../../contexts/ThemeContext.tsx';
import { LanguageProvider } from '../../contexts/LanguageContext.tsx';
import { SessionType, SupportedLanguage, SessionDifficulty } from '../../types/index.ts';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 100);
  }

  send(data: string) {
    // Simuler une réponse du serveur
    setTimeout(() => {
      if (this.onmessage) {
        const mockResponse = {
          type: 'coaching_result',
          data: {
            voice_analysis: {
              chunk_metrics: {
                pace_wpm: 150,
                volume_consistency: 0.8,
                clarity_score: 0.75
              },
              quality_assessment: {
                overall_quality: 0.8
              }
            },
            coaching_feedback: {
              ai_generated_feedback: {
                encouragement: 'Excellent travail !',
                next_focus: 'Continuez sur cette lancée'
              }
            }
          },
          session_id: 'test-session-id',
          timestamp: new Date().toISOString()
        };

        this.onmessage(new MessageEvent('message', {
          data: JSON.stringify(mockResponse)
        }));
      }
    }, 200);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// Mock MediaRecorder
class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: MediaStream;
  options?: MediaRecorderOptions;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.options = options;
  }

  start(timeslice?: number) {
    this.state = 'recording';
    if (this.onstart) {
      this.onstart(new Event('start'));
    }

    // Simuler des données audio
    const interval = setInterval(() => {
      if (this.state === 'recording' && this.ondataavailable) {
        const mockBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
        this.ondataavailable(new BlobEvent('dataavailable', { data: mockBlob }));
      } else {
        clearInterval(interval);
      }
    }, timeslice || 1000);
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop(new Event('stop'));
    }
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }
}

// Mock getUserMedia
const mockGetUserMedia = vi.fn(() => 
  Promise.resolve(new MediaStream())
);

// Configuration des mocks globaux
beforeEach(() => {
  (globalThis as any).WebSocket = MockWebSocket;
  (globalThis as any).MediaRecorder = MockMediaRecorder;
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia
    },
    writable: true
  });

  // Mock fetch pour les API calls
  (globalThis as any).fetch = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

// Composant wrapper pour les tests
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Parcours Utilisateur Complet - AURA', () => {
  
  describe('Parcours Session de Présentation', () => {
    it('devrait permettre de créer et exécuter une session de présentation complète', async () => {
      const user = userEvent.setup();

      // Mock des réponses API
      (globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'mock-token',
            user: { id: 'user-1', email: 'test@example.com' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'session-1',
            title: 'Ma Présentation',
            session_type: 'presentation',
            status: 'created'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'started' })
        });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // 1. Connexion utilisateur
      await waitFor(() => {
        expect(screen.getByText(/connexion/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/mot de passe/i);
      const loginButton = screen.getByRole('button', { name: /se connecter/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      // 2. Navigation vers création de session
      await waitFor(() => {
        expect(screen.getByText(/tableau de bord/i)).toBeInTheDocument();
      });

      const newSessionButton = screen.getByRole('button', { name: /nouvelle session/i });
      await user.click(newSessionButton);

      // 3. Configuration de la session de présentation
      await waitFor(() => {
        expect(screen.getByText(/créer une session/i)).toBeInTheDocument();
      });

      // Remplir le formulaire
      const titleInput = screen.getByLabelText(/titre/i);
      await user.type(titleInput, 'Ma Présentation Professionnelle');

      const typeSelect = screen.getByLabelText(/type de session/i);
      await user.selectOptions(typeSelect, 'presentation');

      const languageSelect = screen.getByLabelText(/langue/i);
      await user.selectOptions(languageSelect, 'fr');

      const difficultySelect = screen.getByLabelText(/niveau/i);
      await user.selectOptions(difficultySelect, 'intermediate');

      // Sélectionner les domaines de focus
      const focusAreas = screen.getByText(/domaines de focus/i);
      await user.click(focusAreas);
      
      const structureCheckbox = screen.getByLabelText(/structure/i);
      const stressCheckbox = screen.getByLabelText(/gestion du stress/i);
      await user.click(structureCheckbox);
      await user.click(stressCheckbox);

      // Ajouter une instruction personnalisée
      const customPromptTextarea = screen.getByLabelText(/instructions personnalisées/i);
      await user.type(customPromptTextarea, 'Je vais présenter un projet innovant à mon équipe de direction');

      // Créer la session
      const createButton = screen.getByRole('button', { name: /créer la session/i });
      await user.click(createButton);

      // 4. Démarrage de la session
      await waitFor(() => {
        expect(screen.getByText(/session créée/i)).toBeInTheDocument();
      });

      const startButton = screen.getByRole('button', { name: /démarrer/i });
      await user.click(startButton);

      // 5. Interface de session active
      await waitFor(() => {
        expect(screen.getByText(/session en cours/i)).toBeInTheDocument();
      });

      // Vérifier la présence des éléments de l'interface
      expect(screen.getByRole('button', { name: /commencer l'enregistrement/i })).toBeInTheDocument();
      expect(screen.getByText(/feedback en temps réel/i)).toBeInTheDocument();
      expect(screen.getByText(/métriques vocales/i)).toBeInTheDocument();

      // 6. Démarrer l'enregistrement
      const recordButton = screen.getByRole('button', { name: /commencer l'enregistrement/i });
      await user.click(recordButton);

      // Vérifier que l'enregistrement a commencé
      await waitFor(() => {
        expect(screen.getByText(/enregistrement en cours/i)).toBeInTheDocument();
      });

      // 7. Simuler la réception de feedback en temps réel
      await waitFor(() => {
        expect(screen.getByText(/excellent travail/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Vérifier les métriques affichées
      expect(screen.getByText(/150 mots\/min/i)).toBeInTheDocument();
      expect(screen.getByText(/80%/i)).toBeInTheDocument(); // Volume consistency

      // 8. Arrêter l'enregistrement
      const stopButton = screen.getByRole('button', { name: /arrêter/i });
      await user.click(stopButton);

      // 9. Terminer la session
      const endSessionButton = screen.getByRole('button', { name: /terminer la session/i });
      await user.click(endSessionButton);

      // 10. Vérifier le feedback post-session
      await waitFor(() => {
        expect(screen.getByText(/résumé de la session/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/analyse complète/i)).toBeInTheDocument();
      expect(screen.getByText(/recommandations/i)).toBeInTheDocument();
      expect(screen.getByText(/points forts/i)).toBeInTheDocument();
    });
  });

  describe('Parcours Session de Conversation', () => {
    it('devrait permettre une session de conversation interactive', async () => {
      const user = userEvent.setup();

      // Mock des réponses API pour conversation
      (globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'mock-token',
            user: { id: 'user-1', email: 'test@example.com' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'session-2',
            title: 'Conversation Professionnelle',
            session_type: 'conversation',
            status: 'created'
          })
        });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Connexion et navigation (similaire au test précédent)
      // ... (code de connexion)

      // Configuration spécifique à la conversation
      const typeSelect = screen.getByLabelText(/type de session/i);
      await user.selectOptions(typeSelect, 'conversation');

      const languageSelect = screen.getByLabelText(/langue/i);
      await user.selectOptions(languageSelect, 'en');

      // Domaines de focus spécifiques à la conversation
      const fluidityCheckbox = screen.getByLabelText(/fluidité/i);
      const reactivityCheckbox = screen.getByLabelText(/réactivité/i);
      await user.click(fluidityCheckbox);
      await user.click(reactivityCheckbox);

      // Instructions pour simulation d'entretien
      const customPromptTextarea = screen.getByLabelText(/instructions personnalisées/i);
      await user.type(customPromptTextarea, 'Simulation d\'entretien client pour négociation commerciale');

      // Créer et démarrer la session
      const createButton = screen.getByRole('button', { name: /créer la session/i });
      await user.click(createButton);

      // Vérifier les fonctionnalités spécifiques à la conversation
      await waitFor(() => {
        expect(screen.getByText(/mode conversation/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/timing de réponse/i)).toBeInTheDocument();
      expect(screen.getByText(/adaptabilité/i)).toBeInTheDocument();
      expect(screen.getByText(/écoute active/i)).toBeInTheDocument();
    });
  });

  describe('Parcours Session de Prononciation', () => {
    it('devrait permettre une session de prononciation avec feedback phonétique', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Configuration spécifique à la prononciation
      const typeSelect = screen.getByLabelText(/type de session/i);
      await user.selectOptions(typeSelect, 'pronunciation');

      const difficultySelect = screen.getByLabelText(/niveau/i);
      await user.selectOptions(difficultySelect, 'beginner');

      // Domaines de focus phonétiques
      const articulationCheckbox = screen.getByLabelText(/articulation/i);
      const intonationCheckbox = screen.getByLabelText(/intonation/i);
      await user.click(articulationCheckbox);
      await user.click(intonationCheckbox);

      // Vérifier les fonctionnalités spécifiques à la prononciation
      await waitFor(() => {
        expect(screen.getByText(/analyse phonétique/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/sons cibles/i)).toBeInTheDocument();
      expect(screen.getByText(/précision articulatoire/i)).toBeInTheDocument();
      expect(screen.getByText(/détection d'accent/i)).toBeInTheDocument();
    });
  });

  describe('Parcours Session de Lecture', () => {
    it('devrait permettre une session de lecture avec analyse de fluidité', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Configuration spécifique à la lecture
      const typeSelect = screen.getByLabelText(/type de session/i);
      await user.selectOptions(typeSelect, 'reading');

      const durationInput = screen.getByLabelText(/durée cible/i);
      await user.clear(durationInput);
      await user.type(durationInput, '10'); // 10 minutes

      // Domaines de focus pour la lecture
      const fluencyCheckbox = screen.getByLabelText(/fluidité de lecture/i);
      const expressionCheckbox = screen.getByLabelText(/expression vocale/i);
      await user.click(fluencyCheckbox);
      await user.click(expressionCheckbox);

      // Vérifier les fonctionnalités spécifiques à la lecture
      await waitFor(() => {
        expect(screen.getByText(/analyse de lecture/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/vitesse de lecture/i)).toBeInTheDocument();
      expect(screen.getByText(/précision/i)).toBeInTheDocument();
      expect(screen.getByText(/expression/i)).toBeInTheDocument();
    });
  });

  describe('Test des Paramètres Avancés', () => {
    it('devrait permettre de configurer tous les paramètres avancés', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Ouvrir les paramètres avancés
      const advancedButton = screen.getByRole('button', { name: /paramètres avancés/i });
      await user.click(advancedButton);

      // Configuration audio
      const sampleRateSelect = screen.getByLabelText(/fréquence d'échantillonnage/i);
      await user.selectOptions(sampleRateSelect, '44100');

      const noiseReductionCheckbox = screen.getByLabelText(/réduction de bruit/i);
      await user.click(noiseReductionCheckbox);

      const echoCancellationCheckbox = screen.getByLabelText(/annulation d'écho/i);
      await user.click(echoCancellationCheckbox);

      // Configuration feedback
      const realtimeFeedbackCheckbox = screen.getByLabelText(/feedback temps réel/i);
      await user.click(realtimeFeedbackCheckbox);

      const feedbackFrequencySlider = screen.getByLabelText(/fréquence feedback/i);
      fireEvent.change(feedbackFrequencySlider, { target: { value: '3' } });

      const aiCoachingCheckbox = screen.getByLabelText(/coaching ia/i);
      await user.click(aiCoachingCheckbox);

      // Configuration stockage
      const storeAudioCheckbox = screen.getByLabelText(/stocker audio/i);
      await user.click(storeAudioCheckbox);

      const shareAnalyticsCheckbox = screen.getByLabelText(/partager analytics/i);
      await user.click(shareAnalyticsCheckbox);

      // Vérifier que tous les paramètres sont pris en compte
      expect(sampleRateSelect).toHaveValue('44100');
      expect(noiseReductionCheckbox).toBeChecked();
      expect(echoCancellationCheckbox).toBeChecked();
      expect(realtimeFeedbackCheckbox).toBeChecked();
      expect(feedbackFrequencySlider).toHaveValue('3');
      expect(aiCoachingCheckbox).toBeChecked();
      expect(storeAudioCheckbox).toBeChecked();
      expect(shareAnalyticsCheckbox).toBeChecked();
    });
  });

  describe('Test de Gestion d\'Erreurs', () => {
    it('devrait gérer gracieusement les erreurs de connexion', async () => {
      const user = userEvent.setup();

      // Mock d'erreur réseau
      (globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      const loginButton = screen.getByRole('button', { name: /se connecter/i });
      await user.click(loginButton);

      // Vérifier l'affichage de l'erreur
      await waitFor(() => {
        expect(screen.getByText(/erreur de connexion/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
    });

    it('devrait gérer les erreurs de WebSocket', async () => {
      const user = userEvent.setup();

      // Mock WebSocket avec erreur
      class ErrorWebSocket extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'));
            }
          }, 500);
        }
      }

      (globalThis as any).WebSocket = ErrorWebSocket;

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Démarrer une session et vérifier la gestion d'erreur WebSocket
      // ... (code de création de session)

      await waitFor(() => {
        expect(screen.getByText(/problème de connexion/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /reconnecter/i })).toBeInTheDocument();
    });

    it('devrait gérer les erreurs de microphone', async () => {
      const user = userEvent.setup();

      // Mock getUserMedia avec erreur
      mockGetUserMedia.mockRejectedValueOnce(new Error('Microphone access denied'));

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Tenter de démarrer l'enregistrement
      const recordButton = screen.getByRole('button', { name: /commencer l'enregistrement/i });
      await user.click(recordButton);

      // Vérifier l'affichage de l'erreur microphone
      await waitFor(() => {
        expect(screen.getByText(/accès au microphone refusé/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/vérifiez les permissions/i)).toBeInTheDocument();
    });
  });

  describe('Test de Responsive Design', () => {
    it('devrait s\'adapter aux différentes tailles d\'écran', async () => {
      // Test mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Vérifier l'adaptation mobile
      expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument();

      // Test tablet
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      fireEvent(window, new Event('resize'));

      // Vérifier l'adaptation tablet
      await waitFor(() => {
        expect(screen.getByTestId('tablet-layout')).toBeInTheDocument();
      });

      // Test desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      fireEvent(window, new Event('resize'));

      // Vérifier l'adaptation desktop
      await waitFor(() => {
        expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      });
    });
  });

  describe('Test d\'Accessibilité', () => {
    it('devrait être accessible aux technologies d\'assistance', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Test navigation au clavier
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role', 'button');

      // Test des labels ARIA
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('aria-required', 'true');

      // Test des descriptions ARIA
      const passwordInput = screen.getByLabelText(/mot de passe/i);
      expect(passwordInput).toHaveAttribute('aria-describedby');

      // Test des annonces pour lecteurs d'écran
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Test de Performance', () => {
    it('devrait charger rapidement et être réactif', async () => {
      const startTime = performance.now();

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Vérifier le temps de chargement initial
      await waitFor(() => {
        expect(screen.getByText(/aura/i)).toBeInTheDocument();
      });

      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // Moins de 2 secondes

      // Test de réactivité des interactions
      const user = userEvent.setup();
      const interactionStart = performance.now();

      const button = screen.getByRole('button', { name: /se connecter/i });
      await user.click(button);

      const interactionTime = performance.now() - interactionStart;
      expect(interactionTime).toBeLessThan(100); // Moins de 100ms
    });
  });
});