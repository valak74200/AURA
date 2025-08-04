import React from "react";
import TtsTester from "../components/TtsTester";

const TtsTestPage: React.FC = () => {
  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Démo TTS temps réel (WebSocket)</h1>
      <p className="text-sm text-gray-600 mb-6">
        Cette page teste le proxy /ws/tts côté backend avec ElevenLabs. Utilisez le champ texte puis cliquez sur
        "Démarrer" et "Parler". Les chunks audio MP3 sont lus en continu et les visèmes s’affichent ci-dessous.
      </p>
      <TtsTester />
    </div>
  );
};

export default TtsTestPage;