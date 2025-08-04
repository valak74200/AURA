"""
Tests d'intégration avec de vraies APIs externes.

Ces tests utilisent de vraies clés API et font de vrais appels aux services externes.
Ils peuvent être exécutés séparément avec: pytest -m real_services

ATTENTION: Ces tests consomment des quotas API réels.
"""

import pytest
import asyncio
import os
from typing import Dict, Any
from dotenv import load_dotenv

# Charger le fichier .env pour accéder aux clés API
load_dotenv()

# Marqueur pour identifier les tests avec vraies APIs
pytestmark = pytest.mark.real_services


class TestGeminiRealAPI:
    """Tests avec la vraie API Gemini."""
    
    @pytest.mark.asyncio
    async def test_gemini_text_generation(self):
        """Test génération de texte avec vraie API Gemini."""
        
        # Vérifier que la clé API est disponible
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            pytest.skip("GEMINI_API_KEY non configurée - skipping test with real API")
        
        # Import des services réels
        from services.gemini_service import GeminiService
        from app.config import get_settings
        
        settings = get_settings()
        gemini_service = GeminiService(settings)
        
        # Simuler des données d'analyse vocale
        voice_metrics = {
            "speech_rate": 150,  # mots par minute
            "avg_volume": 0.7,
            "voice_activity_ratio": 0.85,
            "pauses_count": 12,
            "overall_quality": "good"
        }
        
        context = {
            "session_type": "practice",
            "language": "fr",
            "presentation_type": "business",
            "duration_minutes": 3
        }
        
        try:
            response = await gemini_service.generate_presentation_feedback(
                voice_metrics=voice_metrics,
                transcript="Test de présentation pour améliorer les compétences de communication.",
                context=context,
                language="fr"
            )
            
            # Vérifications
            assert response is not None
            assert isinstance(response, dict)
            assert "feedback" in response or "analysis" in response or "suggestions" in response
            
            print(f"✅ Gemini API Response: {str(response)[:100]}...")
            
        except Exception as e:
            pytest.fail(f"Gemini API call failed: {e}")
    
    @pytest.mark.asyncio
    async def test_gemini_audio_feedback_generation(self, real_audio_file):
        """Test génération de feedback audio avec vraie API Gemini."""
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            pytest.skip("GEMINI_API_KEY non configurée")
        
        from services.gemini_service import GeminiService
        from services.audio_service import AudioService
        from app.config import get_settings
        
        settings = get_settings()
        gemini_service = GeminiService(settings)
        audio_service = AudioService()
        
        try:
            # 1. Analyser l'audio d'abord
            audio_analysis = await audio_service.process_audio_file(
                audio_data=real_audio_file,
                filename="test_feedback.wav",
                session_id="gemini-test-session"
            )
            
            # 2. Générer un feedback avec Gemini basé sur l'analyse
            voice_metrics = audio_analysis.get('voice_metrics', {})
            context = {
                "session_type": "practice",
                "language": "fr",
                "presentation_type": "coaching"
            }
            
            feedback = await gemini_service.generate_presentation_feedback(
                voice_metrics=voice_metrics,
                transcript="Analyse de test pour feedback vocal",
                context=context,
                language="fr"
            )
            
            # Vérifications
            assert feedback is not None
            assert isinstance(feedback, dict)
            
            print(f"✅ Gemini Feedback Generated: {str(feedback)[:150]}...")
            
        except Exception as e:
            pytest.fail(f"Gemini audio feedback generation failed: {e}")
    
    @pytest.mark.asyncio
    async def test_gemini_coaching_suggestions(self):
        """Test suggestions de coaching avec vraie API Gemini."""
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            pytest.skip("GEMINI_API_KEY non configurée")
        
        from services.gemini_service import GeminiService
        from app.config import get_settings
        
        settings = get_settings()
        gemini_service = GeminiService(settings)
        
        # Simulation d'une session de présentation
        voice_metrics = {
            "speech_rate": 120,  # Débit lent
            "avg_volume": 0.4,   # Volume faible
            "voice_activity_ratio": 0.6,  # Beaucoup de pauses
            "pauses_count": 25,
            "overall_quality": "needs_improvement"
        }
        
        context = {
            "session_type": "practice",
            "language": "fr", 
            "presentation_type": "business",
            "difficulty_level": "intermediate",
            "duration_minutes": 5
        }
        
        try:
            coaching_response = await gemini_service.generate_presentation_feedback(
                voice_metrics=voice_metrics,
                transcript="Présentation de test avec plusieurs défis à améliorer.",
                context=context,
                language="fr"
            )
            
            # Vérifications
            assert coaching_response is not None
            assert isinstance(coaching_response, dict)
            
            print(f"✅ Gemini Coaching: {str(coaching_response)[:200]}...")
            
        except Exception as e:
            pytest.fail(f"Gemini coaching generation failed: {e}")


class TestRealTimeGeminiIntegration:
    """Tests d'intégration temps réel avec Gemini."""
    
    @pytest.mark.asyncio
    async def test_real_time_feedback_pipeline(self, real_audio_file):
        """Test pipeline complet temps réel: audio → analyse → Gemini → feedback."""
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            pytest.skip("GEMINI_API_KEY non configurée")
        
        from services.gemini_service import GeminiService
        from services.audio_service import AudioService
        from app.config import get_settings
        import time
        
        settings = get_settings()
        gemini_service = GeminiService(settings)
        audio_service = AudioService()
        
        start_time = time.time()
        
        try:
            # 1. Créer une session de streaming audio
            session_id = "realtime-test-session"
            await audio_service.create_audio_stream(session_id)
            
            # 2. Simulation de chunks audio en temps réel
            chunk_size = len(real_audio_file) // 4  # Diviser en 4 chunks
            chunks_processed = 0
            
            for i in range(0, len(real_audio_file), chunk_size):
                chunk = real_audio_file[i:i+chunk_size]
                if len(chunk) < 1000:  # Skip too small chunks
                    continue
                
                # 3. Analyser le chunk
                chunk_analysis = await audio_service.process_audio_chunk(
                    session_id=session_id,
                    chunk_data=chunk,
                    chunk_index=chunks_processed
                )
                
                chunks_processed += 1
                
                # 4. Feedback temps réel toutes les 2 chunks
                if chunks_processed % 2 == 0 and chunk_analysis.get("status") != "buffering":
                    voice_metrics = chunk_analysis.get('voice_metrics', {})
                    context = {
                        "session_type": "realtime",
                        "language": "fr",
                        "chunk_index": chunks_processed
                    }
                    
                    real_time_feedback = await gemini_service.generate_presentation_feedback(
                        voice_metrics=voice_metrics,
                        transcript=f"Chunk temps réel {chunks_processed}",
                        context=context,
                        language="fr"
                    )
                    
                    assert real_time_feedback is not None
                    assert isinstance(real_time_feedback, dict)
                    
                    print(f"📢 Real-time feedback {chunks_processed}: {str(real_time_feedback)[:100]}")
            
            # 5. Nettoyer la session
            await audio_service.cleanup_audio_stream(session_id)
            
            total_time = time.time() - start_time
            
            # Vérifications de performance
            assert chunks_processed >= 2  # Au moins 2 chunks traités
            assert total_time < 60.0  # Traitement en moins de 60 secondes (plus généreux)
            
            print(f"⚡ Pipeline completed in {total_time:.2f}s, {chunks_processed} chunks processed")
            
        except Exception as e:
            pytest.fail(f"Real-time pipeline failed: {e}")
    
    @pytest.mark.asyncio
    async def test_gemini_performance_metrics(self):
        """Test métriques de performance de l'API Gemini."""
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            pytest.skip("GEMINI_API_KEY non configurée")
        
        from services.gemini_service import GeminiService
        from app.config import get_settings
        import time
        
        settings = get_settings()
        gemini_service = GeminiService(settings)
        
        # Test de latence avec différents scénarios
        test_scenarios = [
            {
                "voice_metrics": {"speech_rate": 130, "avg_volume": 0.6},
                "context": {"session_type": "quick_test", "language": "fr"}
            },
            {
                "voice_metrics": {"speech_rate": 180, "avg_volume": 0.8},
                "context": {"session_type": "performance", "language": "fr"}
            },
            {
                "voice_metrics": {"speech_rate": 100, "avg_volume": 0.3},
                "context": {"session_type": "improvement", "language": "fr"}
            }
        ]
        
        response_times = []
        successful_calls = 0
        
        for i, scenario in enumerate(test_scenarios):
            try:
                start_time = time.time()
                
                response = await gemini_service.generate_presentation_feedback(
                    voice_metrics=scenario["voice_metrics"],
                    transcript=f"Test performance {i+1}",
                    context=scenario["context"],
                    language="fr"
                )
                
                response_time = time.time() - start_time
                response_times.append(response_time)
                successful_calls += 1
                
                assert response is not None
                assert isinstance(response, dict)
                
                print(f"📊 Call {i+1}: {response_time:.2f}s - Response received")
                
            except Exception as e:
                print(f"❌ Call {i+1} failed: {e}")
        
        # Vérifications de performance
        assert successful_calls >= 2  # Au moins 2 appels réussis
        
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            
            # Les appels API ne devraient pas être trop lents
            assert avg_response_time < 15.0  # Moyenne < 15s (plus généreux)
            assert max_response_time < 25.0  # Max < 25s (plus généreux)
            
            print(f"📈 Performance: Avg={avg_response_time:.2f}s, Max={max_response_time:.2f}s")


class TestExternalServicesHealth:
    """Tests de santé des services externes."""
    
    @pytest.mark.asyncio
    async def test_gemini_api_health(self):
        """Test de santé de l'API Gemini."""
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            pytest.skip("GEMINI_API_KEY non configurée")
        
        from services.gemini_service import GeminiService
        from app.config import get_settings
        
        settings = get_settings()
        gemini_service = GeminiService(settings)
        
        try:
            # Test simple pour vérifier la connectivité
            voice_metrics = {"speech_rate": 140, "avg_volume": 0.5}
            context = {"session_type": "health_check", "language": "fr"}
            
            response = await gemini_service.generate_presentation_feedback(
                voice_metrics=voice_metrics,
                transcript="Test de connexion API Gemini",
                context=context,
                language="fr"
            )
            
            assert response is not None
            assert isinstance(response, dict)
            
            print(f"✅ Gemini API Health Check: Response received successfully")
            
        except Exception as e:
            pytest.fail(f"Gemini API health check failed: {e}")
    
    @pytest.mark.asyncio
    async def test_service_quotas_and_limits(self):
        """Test respect des quotas et limites de l'API."""
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            pytest.skip("GEMINI_API_KEY non configurée")
        
        from services.gemini_service import GeminiService
        from app.config import get_settings
        import asyncio
        
        settings = get_settings()
        gemini_service = GeminiService(settings)
        
        # Test de requêtes rapides successives
        test_requests = [
            {
                "voice_metrics": {"speech_rate": 120, "avg_volume": 0.4},
                "context": {"session_type": f"quota_test_{i}", "language": "fr"},
                "transcript": f"Test quota {i}"
            }
            for i in range(3)
        ]
        
        try:
            tasks = []
            for i, request in enumerate(test_requests):
                task = gemini_service.generate_presentation_feedback(
                    voice_metrics=request["voice_metrics"],
                    transcript=request["transcript"],
                    context=request["context"],
                    language="fr"
                )
                tasks.append(task)
                await asyncio.sleep(0.5)  # Délai court entre requêtes
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            successful_results = [r for r in results if isinstance(r, dict)]
            failed_results = [r for r in results if isinstance(r, Exception)]
            
            # Au moins une requête devrait réussir
            assert len(successful_results) >= 1
            
            print(f"📊 Quota test: {len(successful_results)} success, {len(failed_results)} failed")
            
            if failed_results:
                print(f"⚠️ Some requests failed (possibly due to rate limits): {failed_results[0]}")
            
        except Exception as e:
            pytest.fail(f"Service quota test failed: {e}")


# Configuration spéciale pour les tests avec services externes
@pytest.fixture(scope="session", autouse=True)
def configure_real_api_tests():
    """Configuration pour les tests avec vraies APIs."""
    
    # Vérifier les variables d'environnement nécessaires
    required_env_vars = ["GEMINI_API_KEY"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        pytest.skip(f"Variables d'environnement manquantes pour tests API réels: {missing_vars}")
    
    print("\n🌐 Configuration des tests avec vraies APIs externes")
    print("⚠️  ATTENTION: Ces tests consomment des quotas API réels")
    print(f"🔑 API Key configurée: {os.getenv('GEMINI_API_KEY', 'N/A')[:10]}...") 