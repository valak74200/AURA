# AURA Frontend

Interface utilisateur moderne et animée pour AURA - AI Presentation Coach, construite avec React, Next.js 14 et Framer Motion.

## 🚀 Fonctionnalités

- **Interface moderne** avec animations fluides et micro-interactions
- **Design responsive** optimisé pour tous les appareils
- **Thème sombre** avec effets glassmorphism et gradients
- **Composants réutilisables** avec TypeScript strict
- **WebSocket temps réel** pour le coaching en direct
- **Visualisation audio** avec canvas et animations
- **Métriques interactives** avec graphiques Recharts
- **Gestion d'état** avec Zustand
- **Notifications** avec React Hot Toast

## 🛠️ Technologies

- **Next.js 14** - Framework React avec App Router
- **TypeScript** - Typage statique
- **Tailwind CSS** - Framework CSS utilitaire
- **Framer Motion** - Animations et transitions
- **Recharts** - Graphiques et visualisations
- **Radix UI** - Composants accessibles
- **Lucide React** - Icônes modernes
- **React Hot Toast** - Notifications
- **Zustand** - Gestion d'état légère

## 📁 Structure du Projet

```
frontend/
├── app/                    # Pages Next.js (App Router)
│   ├── globals.css        # Styles globaux et animations
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Page d'accueil
│   ├── session/           # Page de session de coaching
│   └── dashboard/         # Tableau de bord utilisateur
├── components/            # Composants réutilisables
│   ├── AudioVisualizer.tsx
│   ├── MetricsCard.tsx
│   └── FeedbackPanel.tsx
├── hooks/                 # Hooks personnalisés
│   ├── useWebSocket.ts
│   └── useAudioRecorder.ts
├── lib/                   # Utilitaires et helpers
│   └── utils.ts
├── types/                 # Définitions TypeScript
│   └── index.ts
└── public/               # Assets statiques
```

## 🎨 Design System

### Couleurs
- **Primary**: Bleu (#0ea5e9) - Actions principales
- **Accent**: Violet (#d946ef) - Éléments d'accentuation
- **Dark**: Gris foncé (#0f172a) - Arrière-plans
- **Success**: Vert (#10b981) - États positifs
- **Warning**: Jaune (#f59e0b) - Avertissements
- **Error**: Rouge (#ef4444) - Erreurs

### Animations
- **Fade In**: Apparition en fondu
- **Slide Up/Down**: Glissement vertical
- **Scale In**: Zoom d'apparition
- **Float**: Animation flottante
- **Pulse**: Pulsation pour les éléments actifs
- **Gradient**: Animation de dégradé

### Composants
- **Cards**: Effet glassmorphism avec bordures subtiles
- **Buttons**: Dégradés et transformations au survol
- **Inputs**: Focus states avec anneaux colorés
- **Modals**: Backdrop blur et animations d'entrée

## 🔧 Installation

1. **Installer les dépendances**
```bash
cd frontend
npm install
```

2. **Lancer le serveur de développement**
```bash
npm run dev
```

3. **Construire pour la production**
```bash
npm run build
npm start
```

## 🌐 Pages Principales

### Page d'Accueil (`/`)
- Hero section avec animations
- Présentation des fonctionnalités
- Témoignages clients
- Call-to-action

### Session de Coaching (`/session`)
- Interface d'enregistrement audio
- Métriques temps réel
- Feedback IA en direct
- Visualisation audio
- Contrôles de session

### Tableau de Bord (`/dashboard`)
- Statistiques de performance
- Graphiques de progression
- Historique des sessions
- Réalisations et badges

## 🎯 Fonctionnalités Clés

### Enregistrement Audio
- Accès microphone avec permissions
- Visualisation en temps réel
- Contrôles play/pause/stop
- Indicateur de niveau audio

### WebSocket Temps Réel
- Connexion automatique au backend
- Reconnexion automatique
- Gestion des erreurs
- Messages typés

### Métriques Vocales
- Rythme de parole (WPM)
- Consistance du volume
- Score de clarté
- Activité vocale

### Feedback IA
- Suggestions personnalisées
- Niveaux de sévérité
- Horodatage
- Actions de dismissal

## 🔌 Intégration Backend

Le frontend communique avec le backend AURA via :

- **REST API** : Gestion des sessions et données
- **WebSocket** : Communication temps réel
- **Audio Streaming** : Envoi des chunks audio

### Configuration WebSocket
```typescript
const wsUrl = `ws://localhost:8000/ws/session/${sessionId}`
```

### Format des Messages
```typescript
interface WebSocketMessage {
  type: string
  session_id?: string
  data?: any
  timestamp?: string
}
```

## 📱 Responsive Design

- **Mobile First** : Design optimisé mobile
- **Breakpoints** : sm (640px), md (768px), lg (1024px), xl (1280px)
- **Grid System** : CSS Grid et Flexbox
- **Touch Friendly** : Boutons et interactions tactiles

## ⚡ Performance

- **Code Splitting** : Chargement à la demande
- **Image Optimization** : Next.js Image component
- **Bundle Analysis** : Analyse de la taille des bundles
- **Lazy Loading** : Composants et routes

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🚀 Déploiement

### Vercel (Recommandé)
```bash
npm run build
vercel --prod
```

### Docker
```bash
docker build -t aura-frontend .
docker run -p 3000:3000 aura-frontend
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir le fichier LICENSE pour plus de détails.