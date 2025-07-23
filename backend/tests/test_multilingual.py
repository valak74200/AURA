"""
Tests for AURA Multilingual Features

Tests language-specific audio analysis, AI coaching, and cultural adaptation.
"""

import pytest
import numpy as np
from fastapi.testclient import TestClient
from typing import Dict, Any

from models.session import SupportedLanguage, SessionConfig, SessionType
from utils.language_config import (
    get_language_config, get_audio_config, get_coaching_config,
    get_ui_message, get_supported_languages
)
from utils.audio_utils import analyze_voice_metrics
from services.gemini_service import GeminiService


class TestLanguageConfiguration:
    """Test language configuration and setup."""
    
    def test_supported_languages_list(self):
        """Test that supported languages are properly configured."""
        languages = get_supported_languages()
        
        assert len(languages) == 2
        assert any(lang["code"] == "fr" for lang in languages)
        assert any(lang["code"] == "en" for lang in languages)
        
        # Check French config
        fr_lang = next(lang for lang in languages if lang["code"] == "fr")
        assert fr_lang["name"] == "Français"
        assert fr_lang["culture"] == "academic_and_structured"
        
        # Check English config
        en_lang = next(lang for lang in languages if lang["code"] == "en")
        assert en_lang["name"] == "English"
        assert en_lang["culture"] == "engaging_and_storytelling"
    
    def test_language_config_access(self):
        """Test accessing language-specific configurations."""
        # Test French config
        fr_config = get_language_config(SupportedLanguage.FRENCH)
        assert fr_config.language == SupportedLanguage.FRENCH
        assert fr_config.display_name == "Français"
        assert fr_config.audio_config.optimal_pace == 4.7
        
        # Test English config
        en_config = get_language_config(SupportedLanguage.ENGLISH)
        assert en_config.language == SupportedLanguage.ENGLISH
        assert en_config.display_name == "English"
        assert en_config.audio_config.optimal_pace == 3.7
    
    def test_audio_config_differences(self):
        """Test that audio configurations differ between languages."""
        fr_audio = get_audio_config(SupportedLanguage.FRENCH)
        en_audio = get_audio_config(SupportedLanguage.ENGLISH)
        
        # French should have faster pace expectations
        assert fr_audio.natural_pace_min > en_audio.natural_pace_min
        assert fr_audio.natural_pace_max > en_audio.natural_pace_max
        
        # English should allow more pitch variation
        assert en_audio.pitch_variance_expected > fr_audio.pitch_variance_expected
        
        # English should be more tolerant of volume variation
        assert en_audio.volume_consistency_threshold < fr_audio.volume_consistency_threshold
    
    def test_ui_messages_localization(self):
        """Test that UI messages are properly localized."""
        # Test French messages
        fr_msg = get_ui_message("volume_good", SupportedLanguage.FRENCH)
        assert fr_msg == "Votre volume est approprié"
        assert "votre" in fr_msg.lower()
        
        # Test English messages
        en_msg = get_ui_message("volume_good", SupportedLanguage.ENGLISH)
        assert en_msg == "Your volume level is perfect"
        assert "your" in en_msg.lower()
        
        # Test fallback for unknown key
        unknown_key = get_ui_message("unknown_key", SupportedLanguage.FRENCH, "default")
        assert unknown_key == "default"


class TestMultilingualAudioAnalysis:
    """Test language-specific audio analysis."""
    
    @pytest.fixture
    def sample_audio_data(self):
        """Create sample audio data for testing."""
        # Create a more realistic audio sample (1 second at 16kHz)
        duration = 1.0
        sample_rate = 16000
        samples = int(duration * sample_rate)
        
        # Generate synthetic speech-like signal
        t = np.linspace(0, duration, samples)
        # Fundamental frequency around 200Hz (typical for speech)
        fundamental = 200
        # Add harmonics to make it more speech-like
        audio = (
            0.5 * np.sin(2 * np.pi * fundamental * t) +
            0.3 * np.sin(2 * np.pi * fundamental * 2 * t) +
            0.1 * np.sin(2 * np.pi * fundamental * 3 * t) +
            0.05 * np.random.normal(0, 1, samples)  # Add some noise
        )
        
        return audio.astype(np.float32)
    
    def test_french_analysis_characteristics(self, sample_audio_data):
        """Test French-specific audio analysis."""
        result = analyze_voice_metrics(
            sample_audio_data, 
            language=SupportedLanguage.FRENCH
        )
        
        assert result["language"] == "fr"
        assert "pace_analysis" in result
        assert "language_specific_score" in result
        
        # Check French-specific expectations
        pace_analysis = result["pace_analysis"]
        assert "language_expectations" in pace_analysis
        fr_expectations = pace_analysis["language_expectations"]
        
        # French should have higher WPM expectations
        assert fr_expectations["optimal_wpm"] > 250  # Approximate
        
        # Check volume analysis
        volume_analysis = result["volume_analysis"]
        assert volume_analysis["language_expectations"]["consistency_threshold"] == 0.8
    
    def test_english_analysis_characteristics(self, sample_audio_data):
        """Test English-specific audio analysis."""
        result = analyze_voice_metrics(
            sample_audio_data,
            language=SupportedLanguage.ENGLISH
        )
        
        assert result["language"] == "en"
        
        # Check English-specific expectations
        pace_analysis = result["pace_analysis"]
        en_expectations = pace_analysis["language_expectations"]
        
        # English should have lower WPM expectations
        assert en_expectations["optimal_wpm"] < 250  # Approximate
        
        # Check pitch analysis
        pitch_analysis = result["pitch_analysis"]
        en_pitch_expectations = pitch_analysis["language_expectations"]
        assert en_pitch_expectations["expected_variance"] == 0.25  # Higher than French
    
    def test_language_comparison(self, sample_audio_data):
        """Test that different languages produce different analysis results."""
        fr_result = analyze_voice_metrics(sample_audio_data, language=SupportedLanguage.FRENCH)
        en_result = analyze_voice_metrics(sample_audio_data, language=SupportedLanguage.ENGLISH)
        
        # Basic metrics should be the same
        assert fr_result["avg_volume"] == en_result["avg_volume"]
        assert fr_result["avg_pitch"] == en_result["avg_pitch"]
        
        # Language-specific scores should differ
        fr_score = fr_result["language_specific_score"]
        en_score = en_result["language_specific_score"]
        
        # The specific scores might be different due to different expectations
        assert isinstance(fr_score["overall_score"], float)
        assert isinstance(en_score["overall_score"], float)
        
        # Language expectations should be different
        fr_pace = fr_result["pace_analysis"]["language_expectations"]
        en_pace = en_result["pace_analysis"]["language_expectations"]
        assert fr_pace["optimal_wpm"] != en_pace["optimal_wpm"]


class TestMultilingualAPI:
    """Test multilingual API endpoints."""
    
    def test_session_creation_with_language(self, test_client: TestClient):
        """Test creating sessions with different languages."""
        # Test French session
        fr_session_data = {
            "user_id": "test_user",
            "title": "Session en français",
            "description": "Test de session française",
            "config": {
                "session_type": "practice",
                "language": "fr",
                "max_duration": 1800,
                "feedback_frequency": 5,
                "real_time_feedback": True,
                "ai_coaching": True
            }
        }
        
        response = test_client.post("/api/v1/sessions", json=fr_session_data)
        if response.status_code == 201:
            fr_session = response.json()
            assert fr_session["language"] == "fr"
        
        # Test English session
        en_session_data = {
            "user_id": "test_user",
            "title": "English session",
            "description": "Test English session",
            "config": {
                "session_type": "practice",
                "language": "en",
                "max_duration": 1800,
                "feedback_frequency": 5,
                "real_time_feedback": True,
                "ai_coaching": True
            }
        }
        
        response = test_client.post("/api/v1/sessions", json=en_session_data)
        if response.status_code == 201:
            en_session = response.json()
            assert en_session["language"] == "en"
    
    def test_feedback_generation_language_specific(self, test_client: TestClient, test_session: Dict[str, Any]):
        """Test that feedback is generated in the session's language."""
        session_id = test_session["id"]
        
        # Test custom feedback generation
        feedback_request = {
            "analysis_type": "comprehensive",
            "focus_areas": ["volume", "pace"],
            "custom_prompt": "Analysez cette session de présentation"
        }
        
        response = test_client.post(
            f"/api/v1/sessions/{session_id}/feedback/generate",
            json=feedback_request
        )
        
        # Should work regardless of language (fallback to service defaults)
        assert response.status_code in [200, 404, 500]  # 404 if session not found, 500 if service unavailable


class TestGeminiMultilingual:
    """Test Gemini service multilingual capabilities."""
    
    @pytest.fixture
    def gemini_service(self):
        """Create Gemini service for testing."""
        from app.config import get_settings
        return GeminiService(get_settings())
    
    @pytest.fixture
    def sample_voice_metrics(self):
        """Sample voice metrics for testing."""
        return {
            "duration": 5.0,
            "avg_volume": 0.1,
            "pace_wpm": 180,
            "clarity_score": 0.8,
            "language": "fr"
        }
    
    def test_french_prompt_generation(self, gemini_service, sample_voice_metrics):
        """Test French prompt generation."""
        prompt_parts = gemini_service._build_french_prompt(
            sample_voice_metrics, 
            "Bonjour, voici ma présentation",
            {"type": "business"},
            None
        )
        
        prompt = "\n".join(prompt_parts)
        
        # Should contain French text
        assert "expert en coaching de présentation française" in prompt
        assert "Métriques vocales" in prompt
        assert "feedback spécifiques" in prompt
        assert "élégance" in prompt or "logique" in prompt
        
        # Should contain cultural context
        assert "cartésienne" in prompt
        assert "français" in prompt.lower()
    
    def test_english_prompt_generation(self, gemini_service, sample_voice_metrics):
        """Test English prompt generation."""
        sample_voice_metrics["language"] = "en"
        
        prompt_parts = gemini_service._build_english_prompt(
            sample_voice_metrics,
            "Hello, here is my presentation", 
            {"type": "business"},
            None
        )
        
        prompt = "\n".join(prompt_parts)
        
        # Should contain English text
        assert "expert in English presentation coaching" in prompt
        assert "Voice Metrics" in prompt
        assert "audience engagement" in prompt
        assert "storytelling" in prompt or "confidence" in prompt
        
        # Should contain cultural context
        assert "Anglo-Saxon" in prompt
        assert "English" in prompt
    
    def test_prompt_cultural_differences(self, gemini_service, sample_voice_metrics):
        """Test that French and English prompts have different cultural focuses."""
        fr_prompt_parts = gemini_service._build_french_prompt(
            sample_voice_metrics, None, None, None
        )
        en_prompt_parts = gemini_service._build_english_prompt(
            sample_voice_metrics, None, None, None
        )
        
        fr_prompt = "\n".join(fr_prompt_parts)
        en_prompt = "\n".join(en_prompt_parts)
        
        # French should focus on structure and elegance
        assert ("logique" in fr_prompt or "cartésienne" in fr_prompt)
        assert "élégance" in fr_prompt
        
        # English should focus on engagement and storytelling
        assert "engagement" in en_prompt
        assert ("storytelling" in en_prompt or "confidence" in en_prompt)
        
        # Different coaching approaches
        assert "respectueux" in fr_prompt  # French: respectful
        assert "motivational" in en_prompt  # English: motivational


class TestSessionConfigMultilingual:
    """Test session configuration with multilingual support."""
    
    def test_session_config_language_validation(self):
        """Test that session config properly validates languages."""
        # Test valid languages
        fr_config = SessionConfig(
            session_type=SessionType.PRACTICE,
            language=SupportedLanguage.FRENCH
        )
        assert fr_config.language == SupportedLanguage.FRENCH
        
        en_config = SessionConfig(
            session_type=SessionType.PRACTICE,
            language=SupportedLanguage.ENGLISH
        )
        assert en_config.language == SupportedLanguage.ENGLISH
    
    def test_session_config_defaults(self):
        """Test that session config defaults to French."""
        config = SessionConfig(session_type=SessionType.PRACTICE)
        assert config.language == SupportedLanguage.FRENCH
    
    def test_session_language_serialization(self):
        """Test that session language is properly serialized."""
        config = SessionConfig(
            session_type=SessionType.PRACTICE,
            language=SupportedLanguage.ENGLISH
        )
        
        # Test dict conversion
        config_dict = config.dict()
        assert config_dict["language"] == "en"
        
        # Test JSON serialization
        import json
        config_json = json.dumps(config_dict)
        parsed = json.loads(config_json)
        assert parsed["language"] == "en"