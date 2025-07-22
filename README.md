# AURA - AI-Powered Presentation Coach 🎤

AURA est un coach de présentation alimenté par l'IA qui fournit un feedback en temps réel sur la livraison vocale, la structure et les compétences de présentation en utilisant la bibliothèque GenAI Processors de Google.

## 🚀 Fonctionnalités

- **Analyse vocale temps réel** : Analyse du rythme, volume, clarté et intonation
- **Feedback IA personnalisé** : Génération de conseils avec Google Gemini
- **Pipeline de traitement avancé** : Utilisation de GenAI Processors pour l'orchestration
- **API REST complète** : Gestion des sessions et traitement audio
- **WebSocket temps réel** : Communication bidirectionnelle pour le feedback instantané
- **Métriques de performance** : Suivi des progrès et benchmarking

## 🏗️ Architecture

```
backend/
├── app/                    # Application FastAPI principale
│   ├── main.py            # Point d'entrée de l'application
│   ├── config.py          # Configuration et paramètres
│   └── api/               # Endpoints REST et WebSocket
├── processors/            # Processeurs GenAI personnalisés
│   ├── aura_pipeline.py   # Pipeline principal d'orchestration
│   ├── analysis_processor.py    # Analyse vocale temps réel
│   ├── feedback_processor.py    # Génération de feedback IA
│   └── metrics_processor.py     # Calcul des métriques de performance
├── models/                # Modèles Pydantic pour validation
├── services/              # Services métier
├── utils/                 # Utilitaires et helpers
└── tests/                 # Tests complets
```

## 🛠️ Technologies

- **Python 3.11+** : Langage principal
- **FastAPI** : Framework web moderne et rapide
- **GenAI Processors** : Pipeline de traitement IA de Google
- **Google Gemini** : Modèle IA pour génération de feedback
- **Pydantic v2** : Validation et sérialisation de données
- **Librosa** : Analyse audio et traitement du signal
- **asyncio** : Programmation asynchrone pour les performances

## 📋 Prérequis

- Python 3.11 ou supérieur
- Clé API Google Gemini
- Projet Google Cloud configuré

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/valak74200/AURA.git
cd AURA
```

### 2. Configurer l'environnement Python

```bash
cd backend
python3.11 -m venv venv311
source venv311/bin/activate  # Linux/Mac
# ou
venv311\Scripts\activate     # Windows
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configuration

Copiez le fichier de configuration d'exemple :

```bash
cp .env.example .env
```

Éditez `.env` et ajoutez vos clés API :

```bash
GEMINI_API_KEY=votre_clé_api_gemini
GOOGLE_CLOUD_PROJECT=votre_projet_google_cloud
```

### 5. Lancer le serveur

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Le serveur sera accessible à l'adresse : `http://localhost:8000`

## 📚 API Documentation

Une fois le serveur lancé, accédez à la documentation interactive :

- **Swagger UI** : `http://localhost:8000/docs`
- **ReDoc** : `http://localhost:8000/redoc`

### Endpoints principaux

- `GET /api/v1/health` : Vérification de l'état du système
- `POST /api/v1/sessions` : Créer une nouvelle session
- `GET /api/v1/sessions/{id}` : Récupérer une session
- `POST /api/v1/sessions/{id}/audio/upload` : Upload et analyse d'un fichier audio
- `POST /api/v1/sessions/{id}/audio/analyze` : Analyser un chunk audio en temps réel
- `WS /ws/session/{id}` : WebSocket pour communication temps réel

## 🧪 Tests

Le projet inclut une suite de tests complète :

### Tests unitaires et d'intégration
```bash
python test_error_recovery.py      # Tests de gestion d'erreurs
python test_performance_load.py    # Tests de performance et charge
```

### Résultats des tests

- ✅ **Intégration Gemini** : 100% fonctionnel
- ✅ **Gestion d'erreurs** : 90% des cas gérés
- ✅ **Performance** : <5ms pour les endpoints critiques
- ✅ **Charge** : Supporte 20+ utilisateurs simultanés

## 🔧 Développement

### Structure du code

- **Processeurs personnalisés** : Héritent de la classe `Processor` de GenAI
- **Programmation asynchrone** : Utilisation systématique d'`async/await`
- **Types stricts** : Type hints obligatoires pour toutes les fonctions
- **Logging structuré** : Utilisation de `structlog` pour les logs détaillés

### Standards de qualité

- **PEP 8** : Formatage avec Black (ligne max: 88 caractères)
- **Validation** : Pydantic v2 pour tous les modèles de données
- **Tests** : Couverture minimale de 80%
- **Documentation** : Docstrings complètes pour toutes les API publiques

## 🚀 Déploiement

### Variables d'environnement de production

```bash
DEBUG=false
LOG_LEVEL=INFO
MAX_SESSION_DURATION=1800
MAX_CONCURRENT_SESSIONS=100
```

### Considérations de performance

- **Latence cible** : <50ms pour le traitement audio
- **Débit** : >100 requêtes/seconde
- **Mémoire** : Nettoyage automatique des sessions expirées
- **Sécurité** : Validation stricte de tous les inputs

## 🤝 Contribution

1. Fork le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commitez vos changements (`git commit -am 'Ajouter nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- **Google GenAI Processors** : Framework de pipeline IA
- **FastAPI** : Framework web moderne
- **Librosa** : Bibliothèque d'analyse audio

---

**AURA** - Transformez vos présentations avec l'intelligence artificielle ! 🎯