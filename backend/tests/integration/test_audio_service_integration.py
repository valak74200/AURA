"""
Tests d'intégration réels pour AudioService.

Tests avec de vrais fichiers audio et traitement complet.
"""

import pytest
import asyncio
from services.audio_service import AudioService
from models.session import SupportedLanguage
from utils.exceptions import AudioProcessingException, AudioTooLargeError


class TestAudioServiceIntegration:
    """Tests d'intégration pour le service audio avec de vrais fichiers."""
    
    @pytest.fixture
    def audio_service(self):
        """Instance réelle du service audio."""
        return AudioService()
    
    @pytest.mark.asyncio
    async def test_process_real_audio_file_french(self, audio_service, real_audio_file):
        """Test traitement d'un vrai fichier audio en français."""
        result = await audio_service.process_audio_file(
            audio_data=real_audio_file,
            filename="test_french.wav",
            session_id="test_session_fr",
            language=SupportedLanguage.FRENCH
        )
        
        # Vérifications du résultat
        assert result["status"] == "success"
        assert result["filename"] == "test_french.wav"
        assert result["session_id"] == "test_session_fr"
        assert "processing_time_ms" in result
        assert result["processing_time_ms"] > 0
        
        # Vérifications des métriques vocales
        voice_metrics = result["voice_metrics"]
        assert "duration" in voice_metrics
        assert voice_metrics["duration"] > 0
        assert "avg_volume" in voice_metrics
        assert "pace_wpm" in voice_metrics
        assert "clarity_score" in voice_metrics
        assert 0 <= voice_metrics["clarity_score"] <= 1
        
        # Vérifications des indicateurs de qualité
        quality = result["quality_indicators"]
        assert "overall_quality" in quality
        assert 0 <= quality["overall_quality"] <= 1
        assert "recommendations" in quality
        assert isinstance(quality["recommendations"], list)
        
        # Vérifications des informations audio
        audio_info = result["audio_info"]
        assert audio_info["format"] == "wav"
        assert audio_info["sample_rate"] == 16000
        assert audio_info["channels"] == 1
    
    @pytest.mark.asyncio
    async def test_process_real_audio_file_english(self, audio_service, real_audio_file):
        """Test traitement d'un vrai fichier audio en anglais."""
        result = await audio_service.process_audio_file(
            audio_data=real_audio_file,
            filename="test_english.wav",
            session_id="test_session_en",
            language=SupportedLanguage.ENGLISH
        )
        
        assert result["status"] == "success"
        assert result["session_id"] == "test_session_en"
        
        # Les métriques doivent être adaptées à l'anglais
        voice_metrics = result["voice_metrics"]
        assert "language_specific_score" in voice_metrics or "pace_wpm" in voice_metrics
    
    @pytest.mark.asyncio
    async def test_process_silence_audio(self, audio_service, silence_audio_file):
        """Test traitement d'un fichier audio avec du silence."""
        result = await audio_service.process_audio_file(
            audio_data=silence_audio_file,
            filename="silence.wav",
            session_id="test_silence"
        )
        
        assert result["status"] == "success"
        
        # Le silence devrait être détecté
        voice_metrics = result["voice_metrics"]
        assert voice_metrics["voice_activity_ratio"] < 0.5  # Peu d'activité vocale
        assert voice_metrics["avg_volume"] < 0.01  # Volume très faible
    
    @pytest.mark.asyncio
    async def test_audio_streaming_session(self, audio_service):
        """Test création et gestion d'une session de streaming audio."""
        session_id = "streaming_test_session"
        
        # Créer un buffer de streaming
        audio_buffer = await audio_service.create_audio_stream(session_id)
        
        assert audio_buffer is not None
        assert session_id in audio_service.active_buffers
        
        # Simuler des chunks audio
        chunk_data = b'\x00\x01' * 800  # 1600 bytes = 100ms à 16kHz
        
        result = await audio_service.process_audio_chunk(
            session_id=session_id,
            chunk_data=chunk_data,
            chunk_index=0
        )
        
        # Premier chunk pourrait être en buffering
        assert result["status"] in ["processed", "buffering"]
        assert result["session_id"] == session_id
        assert result["chunk_index"] == 0
        
        # Nettoyer la session
        cleanup_success = await audio_service.cleanup_session(session_id)
        assert cleanup_success is True
        assert session_id not in audio_service.active_buffers
    
    @pytest.mark.asyncio
    async def test_audio_file_too_large(self, audio_service):
        """Test gestion d'un fichier audio trop volumineux."""
        # Créer un fichier factice très volumineux
        large_audio_data = b'\x00' * (15 * 1024 * 1024)  # 15MB
        
        with pytest.raises(AudioTooLargeError) as exc_info:
            await audio_service.process_audio_file(
                audio_data=large_audio_data,
                filename="too_large.wav"
            )
        
        assert "exceeds maximum" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_invalid_audio_format(self, audio_service):
        """Test gestion d'un format audio invalide."""
        # Utiliser des données vraiment invalides qui ne peuvent pas être traitées
        invalid_data = b""  # Fichier vide
        
        with pytest.raises(AudioProcessingException) as exc_info:
            await audio_service.process_audio_file(
                audio_data=invalid_data,
                filename="empty.wav"
            )
        
        assert "empty" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_concurrent_audio_processing(self, audio_service, real_audio_file):
        """Test traitement audio concurrent."""
        # Lancer plusieurs traitements en parallèle
        tasks = []
        for i in range(3):
            task = audio_service.process_audio_file(
                audio_data=real_audio_file,
                filename=f"concurrent_{i}.wav",
                session_id=f"concurrent_session_{i}"
            )
            tasks.append(task)
        
        # Attendre que tous se terminent
        results = await asyncio.gather(*tasks)
        
        # Vérifier que tous ont réussi
        for i, result in enumerate(results):
            assert result["status"] == "success"
            assert result["filename"] == f"concurrent_{i}.wav"
            assert result["session_id"] == f"concurrent_session_{i}"
    
    @pytest.mark.asyncio
    async def test_audio_processing_stats(self, audio_service, real_audio_file):
        """Test récupération des statistiques de traitement."""
        # Traiter quelques fichiers
        await audio_service.process_audio_file(real_audio_file, "stats_test_1.wav")
        await audio_service.process_audio_file(real_audio_file, "stats_test_2.wav")
        
        # Récupérer les stats
        stats = await audio_service.get_processing_stats()
        
        assert "total_files_processed" in stats
        assert stats["total_files_processed"] >= 2
        assert "average_processing_time" in stats
        assert stats["average_processing_time"] > 0
        assert "active_sessions" in stats
        assert "timestamp" in stats
    
    @pytest.mark.asyncio
    async def test_audio_quality_assessment(self, audio_service, real_audio_file, silence_audio_file):
        """Test évaluation de la qualité audio."""
        # Test avec audio normal
        normal_result = await audio_service.process_audio_file(
            real_audio_file, "quality_normal.wav"
        )
        normal_quality = normal_result["quality_indicators"]["overall_quality"]
        
        # Test avec silence
        silence_result = await audio_service.process_audio_file(
            silence_audio_file, "quality_silence.wav"
        )
        silence_quality = silence_result["quality_indicators"]["overall_quality"]
        
        # L'audio normal devrait avoir une meilleure qualité que le silence
        assert normal_quality > silence_quality
        assert normal_quality > 0.3  # Seuil raisonnable pour audio généré
        assert silence_quality < 0.7  # Le silence ne devrait pas avoir une qualité parfaite