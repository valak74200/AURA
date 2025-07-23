# 🎯 AURA - Assistant de Coaching de Présentation Alimenté par l'IA

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://postgresql.org)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-orange.svg)](https://ai.google.dev)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-red.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

**AURA** est une plateforme avancée de coaching vocal et de présentation qui combine l'intelligence artificielle moderne avec des techniques d'analyse audio en temps réel pour offrir une expérience de formation personnalisée et efficace.

## 🌟 Fonctionnalités Principales

### 🎤 **Analyse Audio Avancée**
- **Traitement temps réel** de chunks audio (100ms à 16kHz)
- **Métriques vocales complètes** : volume, clarté, rythme, tonalité, pauses
- **Support multi-format** : WAV, MP3, M4A, OGG (jusqu'à 10MB)
- **Détection d'activité vocale** et analyse de qualité automatique

### 🤖 **IA de Coaching Intelligente**
- **Feedback personnalisé** généré par Google Gemini AI
- **Suggestions temps réel** pendant la présentation
- **Analyse contextuelle** basée sur le type de session
- **Conseils actionnables** en français avec encouragement adaptatif

### 📊 **Analytics et Métriques**
- **Suivi de progression** avec tendances temporelles
- **Comparaisons benchmark** et objectifs personnels
- **Détection de jalons** d'amélioration
- **Rapports détaillés** avec visualisation des progrès

### ⚡ **Communication Temps Réel**
- **WebSocket streaming** pour feedback instantané
- **Pipeline de traitement** modulaire et extensible
- **Commandes de contrôle** : start/stop, pause, configuration
- **Notifications de performance** et alertes live

## 🏗️ Architecture du Système

```mermaid
graph TB
    subgraph "Client Layer"
        A[React Frontend] 
        B[Mobile App]
        C[Audio Input]
    end
    
    subgraph "API Gateway"
        D[FastAPI Server]
        E[WebSocket Handler]
        F[Authentication]
    end
    
    subgraph "Core Services"
        G[Audio Service]
        H[Storage Service]
        I[Gemini AI Service]
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
    B --> D
    C --> E
    D --> F
    E --> G
    F --> H
    G --> J
    J --> K
    K --> L
    M --> I
    J --> M
    K --> M
    L --> M
    H --> N
    G --> P
    I --> O
```

## 🔄 Pipeline de Traitement Audio

```mermaid
sequenceDiagram
    participant C as Client
    participant WS as WebSocket
    participant AP as AURA Pipeline
    participant AS as Audio Service
    participant FP as Feedback Processor
    participant AI as Gemini AI
    
    C->>WS: Audio Chunk (100ms)
    WS->>AP: ProcessorPart
    AP->>AS: Audio Analysis
    AS-->>AP: Voice Metrics
    AP->>FP: Analysis Results
    FP->>AI: Generate Feedback
    AI-->>FP: AI Suggestions
    FP-->>AP: Coaching Data
    AP->>WS: Real-time Results
    WS->>C: Live Feedback
    
    Note over AP: Parallel Processing
    Note over AI: French Coaching
    Note over C: Instant UI Update
```

## 🚀 Installation et Configuration

### Prérequis
- Python 3.11+
- PostgreSQL 15+
- Google Cloud Account (pour Gemini AI)

### 1. Cloner le Projet
```bash
git clone https://github.com/valak74200/AURA.git
cd AURA/backend
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
Créer un fichier `.env` :

```bash
# API Keys
GEMINI_API_KEY=votre_clé_gemini_ici
GOOGLE_CLOUD_PROJECT=votre_projet_gcp

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

### ⚡ WebSocket Endpoints
```http
WS /ws/session/{session_id}    # Connexion temps réel
WS /ws/test                    # Endpoint de test
```

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
├── conftest.py                 # Configuration pytest
├── test_api/
│   ├── test_auth.py           # Tests authentification
│   ├── test_sessions.py       # Tests sessions (24 tests)
│   └── test_websocket.py      # Tests WebSocket
├── test_services/
│   └── test_auth_service.py   # Tests services
└── test_processors/           # Tests pipeline
```

## 📊 Modèles de Données

### Session
```python
{
  "id": "uuid",
  "user_id": "string",
  "title": "string", 
  "session_type": "practice|presentation|training",
  "language": "fr|en",
  "status": "active|completed|paused",
  "config": {
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

### Feedback IA
```python
{
  "session_id": "uuid",
  "feedback_items": [
    {
      "type": "volume|pace|clarity",
      "category": "technique|delivery|content",
      "severity": "info|warning|critical",
      "message": "Votre volume est approprié",
      "score": 0.8,
      "suggestions": ["Continuez ainsi"]
    }
  ],
  "generated_at": "datetime"
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
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production
```bash
# Avec Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# Avec variables d'environnement production
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
- [ ] Interface React + Vite.js
- [ ] Capture microphone temps réel
- [ ] Dashboard analytics visuel
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
