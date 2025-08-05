# 🎯 AURA - Assistant de Coaching de Présentation Alimenté par l'IA

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://postgresql.org)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-orange.svg)](https://ai.google.dev)
[![ElevenLabs TTS](https://img.shields.io/badge/ElevenLabs-TTS-purple.svg)](https://api.elevenlabs.io)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-red.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

**AURA** est une plateforme avancée de coaching vocal et de présentation qui combine l'intelligence artificielle moderne avec des techniques d'analyse audio en temps réel pour offrir une expérience de formation personnalisée et efficace.

## 🌟 Fonctionnalités Principales

### 🌍 **Support Multilingue Avancé**
- **Langues supportées** : Français et Anglais avec adaptation culturelle complète
- **Analyse audio adaptative** : seuils et métriques optimisés par langue
- **Coaching culturel** : style français (structure/élégance) vs anglais (engagement/storytelling)
- **Benchmarks spécifiques** : comparaisons de performance par langue
- **Interface localisée** : messages et feedback dans la langue de session

### 🎤 **Analyse Audio Avancée**
- **Traitement temps réel** de chunks audio (100ms à 16kHz)
- **Métriques vocales complètes** : volume, clarté, rythme, tonalité, pauses
- **Support multi-format** : WAV, MP3, M4A, OGG (jusqu'à 10MB)
- **Détection d'activité vocale** et analyse de qualité automatique
- **Adaptation linguistique** : paramètres d'analyse optimisés par langue

### 🤖 **IA de Coaching Intelligente**
- **Feedback personnalisé** généré par Google Gemini AI
- **Prompts culturellement adaptés** : différents styles par langue
- **Suggestions temps réel** pendant la présentation
- **Analyse contextuelle** basée sur le type de session et la langue
- **Conseils actionnables** avec encouragement adaptatif culturel
- **Fonctionnement** : pipeline AURA qui agrège des métriques vocales côté serveur, structure des prompts et appelle le service LLM ([`GeminiService`](backend/services/gemini_service.py:1)) pour produire des feedbacks (realtime_suggestion, coaching_result, performance_update).

### 📊 **Analytics et Métriques Multilingues**
- **Métriques spécifiques par langue** : benchmarks culturels et comparaisons
- **Scoring adaptatif** : évaluation selon les attentes linguistiques
- **Suivi de progression** avec tendances temporelles par langue
- **Détection de jalons** d'amélioration culturellement pertinents
- **Rapports détaillés** avec insights linguistiques

### ⚡ **Communication Temps Réel**
- **WebSocket streaming** pour feedback instantané
- **Pipeline de traitement** modulaire et extensible
- **Commandes de contrôle** : start/stop, pause, configuration
- **Notifications de performance** et alertes live localisées

## 🏗️ Architecture du Système

```mermaid
graph TB
    subgraph "Client Layer"
        A[React Frontend]
        C[Audio Input]
        U[/Page /tts-test/]
    end
    
    subgraph "API Gateway"
        D[FastAPI Server]
        E[WebSocket Handler]
        F[Authentication]
        R[/REST API/]
    end
    
    subgraph "Core Services"
        G[Audio Service]
        H[Storage Service]
        I[Gemini AI Service]
        V[Voice/TTS Service]
    end
    
    subgraph "Processing Pipeline"
        J[Analysis Processor]
        K[Feedback Processor]
        L[Metrics Processor]
        M[AURA Pipeline]
    end
    
    subgraph "Data Layer"
        N[PostgreSQL]
        O[Session Storage]
        P[Audio Buffer]
    end
    
    A --> D
    U --> R
    C --> E
    D --> F
    R --> V
    E --> G
    F --> H
    G --> J
    J --> K
    K --> L
    J --> M
    K --> M
    L --> M
    M --> I
    H --> N
    G --> P
    I --> O
    V --> R
```

### 🔊 Sous-système TTS (HTTP vs WebSocket)

```mermaid
flowchart LR
    subgraph Frontend
      UI[/Page /tts-test/]
      MSE[MediaSource MP3]
    end

    subgraph Backend
      %% Utiliser des formes compatibles GitHub Mermaid:
      %% - Losange de décision: {...} peut provoquer des erreurs → utiliser ((...)) ou [text]
      %% - Sous-routine {{...}} n'est pas toujours supportée → utiliser [...]
      REST[POST /api/v1/tts-stream]
      WS((WS /ws/tts))
      ProxyHTTP[Proxy ElevenLabs HTTP]
      ProxyWS[Proxy ElevenLabs WS]
    end

    subgraph ElevenLabs
      %% Remplacer les accolades par parenthèses pour éviter DIAMOND_START
      ELHTTP[[POST /v1/text-to-speech/(voice_id)/stream]]
      ELWS[[wss://.../stream-input]]
    end

    UI -- HTTP --> REST --> ProxyHTTP --> ELHTTP
    ELHTTP --> ProxyHTTP --> REST --> UI
    UI -. WS .-> WS --> ProxyWS --> ELWS
    ELWS --> ProxyWS --> WS -. BINARY/visèmes .-> UI
    UI --> MSE
```

## 🔄 Pipeline de Traitement Audio et IA

```mermaid
sequenceDiagram
    participant C as Client
    participant WS as WebSocket
    participant REST as REST API
    participant AP as AURA Pipeline
    participant AS as Audio Service
    participant FP as Feedback Processor
    participant AI as Gemini AI
    
    C->>WS: Audio Chunk (100ms)
    WS->>AP: ProcessorPart(JSON)
    AP->>AS: Audio Analysis
    AS-->>AP: Voice Metrics
    AP->>FP: Analysis Results + Context
    FP->>AI: Prompt structuré (langue, style, métriques)
    AI-->>FP: Suggestions IA (FR/EN)
    FP-->>AP: Coaching Data (realtime_suggestion, coaching_result)
    AP->>WS: Real-time Results
    WS->>C: Live Feedback

    Note over AP: Throttling/parallelisme configurable
    Note over AI: Prompts culturels FR/EN
```

## 🚀 Installation et Configuration

### Prérequis
- Python 3.11+
- PostgreSQL 15+
- Google Cloud Account (pour Gemini AI)
- Compte ElevenLabs (clé HTTP “xi-api-key”; clé WS optionnelle si vous activez le stream-input)

### 1. Cloner le Projet
```bash
git clone https://github.com/valak74200/AURA.git
cd AURA
```

### 2. Environnement Virtuel
```bash
python -m venv venv311
source venv311/bin/activate  # Linux/Mac
# ou
venv311\Scripts\activate     # Windows
```

### 3. Installation des Dépendances
```bash
pip install -r requirements.txt
```

### 4. Configuration Environnement
Créer un fichier `.env` (backend/.env recommandé) :

```bash
# API Keys
GEMINI_API_KEY=votre_clé_gemini_ici
GOOGLE_CLOUD_PROJECT=votre_projet_gcp
# ElevenLabs
ELEVENLABS_API_KEY=votre_cle  # xi-api-key (HTTP). Pour WS stream-input: une clé Bearer est requise côté amont.
ELEVENLABS_DEFAULT_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL=eleven_multilingual_v2

# Base de Données
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/aura_db

# Configuration Serveur
DEBUG=false
LOG_LEVEL=INFO
SECRET_KEY=votre_clé_secrète_32_caractères_minimum

# Audio Processing
MAX_AUDIO_FILE_SIZE=10485760  # 10MB
AUDIO_SAMPLE_RATE=16000
AUDIO_CHUNK_SIZE=1600         # 100ms à 16kHz

# Modèles IA
DEFAULT_GEMINI_MODEL=gemini-2.5-flash
GEMINI_PRO_MODEL=gemini-2.5-pro
```

### 5. Base de Données
```bash
# Créer la base de données
python setup_database.py

# Démarrer le serveur
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📡 API Endpoints

### 🔐 Authentication
```http
POST /api/v1/auth/register    # Inscription utilisateur
POST /api/v1/auth/login       # Connexion
GET  /api/v1/user/profile     # Profil utilisateur
```

### 🎭 Session Management
```http
POST   /api/v1/sessions                    # Créer session
GET    /api/v1/sessions/{id}              # Récupérer session
PUT    /api/v1/sessions/{id}              # Mettre à jour
DELETE /api/v1/sessions/{id}              # Supprimer
GET    /api/v1/sessions?user_id=...       # Lister avec filtres
```

### 🎤 Audio Processing
```http
POST /api/v1/sessions/{id}/audio/upload   # Upload fichier audio
POST /api/v1/sessions/{id}/audio/analyze  # Analyse chunk temps réel
```

### 💬 Feedback & Analytics
```http
GET  /api/v1/sessions/{id}/feedback           # Récupérer feedback
POST /api/v1/sessions/{id}/feedback/generate  # Générer feedback custom
GET  /api/v1/sessions/{id}/analytics          # Analytics détaillées
```

### 🔧 System
```http
GET /api/v1/health    # Health check
GET /api/v1/test      # Tests d'intégration
```

### 🌍 Multilingual APIs
```http
# Sessions avec support linguistique
POST /api/v1/sessions
{
  "config": {
    "language": "fr|en",        # Langue de la session
    "session_type": "practice"
  }
}

# Analyse audio avec adaptation linguistique
POST /api/v1/sessions/{id}/audio/upload
# → Analyse automatiquement adaptée à la langue de session

# Feedback culturellement adapté
POST /api/v1/sessions/{id}/feedback/generate
# → Prompts et style adaptés à la langue
```

### ⚡ WebSocket Endpoints
```http
WS /ws/session/{session_id}    # Connexion temps réel
WS /ws/test                    # Endpoint de test
```

## 🔊 TTS (Synthèse Vocale) ElevenLabs

Deux modes sont supportés:
- HTTP streaming (fonctionnel par défaut)
- WebSocket “stream-input” (temps réel, nécessite une clé spécifique côté ElevenLabs)

### Endpoints backend
- HTTP proxy: `POST /api/v1/tts-stream` → proxy vers `POST /v1/text-to-speech/{voice_id}/stream`
- WebSocket proxy: `WS /ws/tts` → proxy vers `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`

### Authentification ElevenLabs
- HTTP: header amont `xi-api-key: <votre_cle_http>`
- WebSocket: header amont `Authorization: Bearer <votre_cle_ws>`
  - Si vous ne disposez que d’une clé “xi-api-key”, utilisez le mode HTTP (l’UI /tts-test est prévue pour fonctionner en HTTP par défaut).
  - En cas d’absence de clé WS, le WS renverra typiquement `invalid_authorization_header (code 1008)`.

### UI de test
- Page: `/tts-test` (frontend)
- Panneaux: Logs WS (client), Meta, Erreurs, Visèmes
- Lecture: MediaSource MP3 côté navigateur en mode HTTP

### Paramètres utiles
- Voice ID par défaut: `21m00Tcm4TlvDq8ikWAM` (Rachel). Utilisez des IDs de voix (pas des noms).
- Modèle par défaut: `eleven_multilingual_v2`
- Format: `mp3_44100_128`

## 🔌 Utilisation WebSocket

### Connexion et Messages
```javascript
// Connexion
const ws = new WebSocket('ws://localhost:8000/ws/session/123')

// Envoyer chunk audio
ws.send(JSON.stringify({
  type: 'audio_chunk',
  audio_data: base64AudioData,
  sample_rate: 16000,
  timestamp: Date.now()
}))

// Messages reçus
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  switch(data.type) {
    case 'coaching_result':
      // Résultats d'analyse complète
      break
    case 'realtime_feedback':
      // Suggestions instantanées
      break
    case 'milestone_achieved':
      // Jalons atteints
      break
  }
}
```

## 🧪 Tests

### Exécuter tous les Tests
```bash
# Tests complets
pytest tests/ -v

# Tests spécifiques
pytest tests/test_api/test_sessions.py -v
pytest tests/test_services/ -v

# Avec couverture
pytest tests/ --cov=app --cov-report=html
```

### Structure des Tests
```
tests/
├── conftest.py                    # Configuration pytest
├── test_api/
│   ├── test_auth.py              # Tests authentification
│   ├── test_sessions.py          # Tests sessions (24 tests)
│   └── test_websocket.py         # Tests WebSocket
├── test_services/
│   └── test_auth_service.py      # Tests services
├── test_processors/              # Tests pipeline
├── test_multilingual.py          # Tests intégration multilingue (15 tests)
└── test_multilingual_metrics.py  # Tests métriques multilingues (17 tests)
```

### Tests Multilingues
```bash
# Tests complets multilingues
pytest tests/test_multilingual.py -v
pytest tests/test_multilingual_metrics.py -v

# Tests par fonctionnalité
pytest tests/test_multilingual.py::TestLanguageConfiguration -v
pytest tests/test_multilingual.py::TestMultilingualAudioAnalysis -v
pytest tests/test_multilingual.py::TestGeminiMultilingual -v
```

## 📊 Modèles de Données

### Session Multilingue
```python
{
  "id": "uuid",
  "user_id": "string",
  "title": "string", 
  "session_type": "practice|presentation|training",
  "language": "fr|en",           # Langue de la session
  "status": "active|completed|paused",
  "config": {
    "language": "fr|en",         # Configuration linguistique
    "max_duration": 1800,
    "feedback_frequency": 5,
    "real_time_feedback": true,
    "ai_coaching": true
  },
  "created_at": "datetime",
  "started_at": "datetime",
  "ended_at": "datetime"
}
```

### Feedback IA Multilingue
```python
{
  "session_id": "uuid",
  "language": "fr|en",          # Langue du feedback
  "feedback_items": [
    {
      "type": "volume|pace|clarity|cultural_adaptation",
      "category": "technique|delivery|content|cultural",
      "severity": "info|warning|critical",
      "message": "Votre volume est approprié", # Localisé
      "score": 0.8,
      "suggestions": ["Continuez ainsi"],     # Culturellement adapté
      "cultural_context": "french_formality|english_engagement"
    }
  ],
  "cultural_adaptation_score": 0.85,  # Score d'adaptation culturelle
  "generated_at": "datetime"
}
```

### Métriques Multilingues
```python
{
  "language": "fr|en",
  "core_metrics": {
    "pace": {
      "wpm": 180,
      "optimal_wpm": 282,      # Différent par langue (fr: 282, en: 222)
      "score": 0.85,
      "feedback": "Rythme adapté au français"
    },
    "volume": {
      "level": 0.06,
      "target_level": 0.06,    # Optimisé par langue
      "score": 0.9
    },
    "clarity": {
      "raw_score": 0.85,
      "adjusted_score": 0.88,  # Pondéré par langue
      "weight_applied": 1.2
    }
  },
  "cultural_metrics": {
    "cultural_adaptation_score": 0.82,
    "cultural_factors": {
      "formality_level": 0.85,      # Important en français
      "engagement_style": 0.78,     # Important en anglais
      "directness_level": 0.60,
      "emotional_expression": 0.75
    }
  },
  "benchmark_comparison": {
    "overall_percentile": 75,        # Comparé aux locuteurs de cette langue
    "strengths": ["pace", "clarity"],
    "improvement_areas": ["pitch_variation"]
  },
  "language_insights": [
    {
      "type": "cultural",
      "level": "excellent",
      "title": "Maîtrise du Style Français",
      "message": "Vous maîtrisez les codes de présentation français",
      "action": "Continuez à cultiver cette élégance"
    }
  ]
}
```

## 🔧 Configuration Avancée

### Pipeline de Traitement
```python
# Configuré dans AuraPipeline
pipeline_config = {
    "enable_parallel_processing": True,
    "chunk_timeout_seconds": 5.0,
    "error_retry_count": 2,
    "feedback_throttling": True,
    "metrics_calculation_interval": 3,
    "quality_threshold": 0.5
}
```

### Modèles Gemini
```python
# Configuration IA
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"      # Rapide
GEMINI_PRO_MODEL = "gemini-2.5-pro"            # Qualité max
DEFAULT_THINKING_BUDGET = 1000                  # Tokens
```

## 🚀 Déploiement

### Docker (Recommandé)
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend ./backend
WORKDIR /app/backend
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production
```bash
# Avec Gunicorn (depuis /backend)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# Variables d'environnement production
export ENVIRONMENT=production
export DEBUG=false
export LOG_LEVEL=WARNING
```

## 📈 Monitoring et Performance

### Métriques Disponibles
- **Temps de traitement** par chunk audio
- **Taux de succès** du pipeline
- **Utilisation des services** (Storage, Audio, Gemini)
- **Erreurs et exceptions** avec traces complètes
- **Sessions actives** et statistiques d'usage

### Logs Structurés
```python
# Format JSON avec métadonnées complètes
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "logger": "aura.processors.pipeline",
  "message": "Pipeline processing completed",
  "session_id": "uuid",
  "chunk_number": 42,
  "processing_time_ms": 150.5
}
```

## 🤝 Contribution

### Structure du Code
```
app/
├── api/                 # Endpoints FastAPI
├── config.py           # Configuration
├── database.py         # Connexion DB
└── main.py             # Application principale

models/                 # Modèles Pydantic
├── session.py
├── feedback.py
├── analytics.py
└── user.py

processors/             # Pipeline de traitement
├── aura_pipeline.py    # Pipeline principal
├── analysis_processor.py
├── feedback_processor.py
└── metrics_processor.py

services/               # Services métier
├── audio_service.py
├── storage_service.py
├── gemini_service.py
└── auth_service.py

utils/                  # Utilitaires
├── logging.py
├── exceptions.py
└── audio_utils.py
```

### Standards de Code
- **Type hints** obligatoires
- **Docstrings** pour toutes les fonctions publiques
- **Tests** pour chaque nouvelle fonctionnalité
- **Logging** structuré avec contexte
- **Gestion d'erreurs** avec exceptions custom

## 📝 Roadmap

### ✅ Complété
- [x] Architecture FastAPI complète
- [x] Pipeline audio temps réel
- [x] Intégration Gemini AI
- [x] WebSocket streaming
- [x] Tests complets (88 tests passants)
- [x] Analytics avancées
- [x] Documentation API

### 🔄 En Cours
- [ ] Interface React + Vite.js (frontend/)
- [ ] Capture microphone temps réel (frontend/components/audio)
- [ ] Dashboard analytics visuel
- [ ] HTTP TTS par défaut (WS activé quand clé Bearer est disponible)
- [ ] Observabilité /api/v1/tts-stream (octets, durée, statut amont)
- [ ] Améliorations pipeline IA (prompts et coûts)
- [ ] Mobile app

### 🚀 Futur
- [ ] Support multi-langues (EN, ES)
- [ ] Intégration vidéo
- [ ] Analytics prédictives
- [ ] API publique avec rate limiting
- [ ] Déploiement cloud (AWS/GCP)

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🆘 Support

- **Documentation API** : http://localhost:8000/docs (Swagger)
- **Issues** : [GitHub Issues](https://github.com/valak74200/AURA/issues)

---

<div align="center">
  <strong>🎯 AURA - Transformez vos présentations avec l'IA</strong><br/>
  Développé avec ❤️ pour l'excellence oratoire
</div>
