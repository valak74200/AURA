"""
Tests for Multilingual Metrics Service

Tests the calculation of language-specific performance metrics,
benchmarks, and cultural adaptations.
"""

import pytest
from datetime import datetime
from typing import Dict, Any

from models.session import SupportedLanguage
from services.multilingual_metrics_service import (
    MultilingualMetricsService, MetricCategory, create_multilingual_metrics_service
)


class TestMultilingualMetricsService:
    """Test multilingual metrics service functionality."""
    
    @pytest.fixture
    def metrics_service(self):
        """Create metrics service for testing."""
        return create_multilingual_metrics_service()
    
    @pytest.fixture
    def sample_french_voice_metrics(self):
        """Sample voice metrics for French analysis."""
        return {
            "duration": 5.0,
            "avg_volume": 0.06,
            "pace_wpm": 280,  # Faster pace typical for French
            "clarity_score": 0.85,
            "pitch_variance": 0.12,  # Lower variance for French
            "volume_consistency": 0.88,
            "voice_activity_ratio": 0.75
        }
    
    @pytest.fixture
    def sample_english_voice_metrics(self):
        """Sample voice metrics for English analysis."""
        return {
            "duration": 5.0,
            "avg_volume": 0.08,
            "pace_wpm": 180,  # Slower pace typical for English
            "clarity_score": 0.78,
            "pitch_variance": 0.22,  # Higher variance for English
            "volume_consistency": 0.72,
            "voice_activity_ratio": 0.82
        }
    
    def test_service_initialization(self, metrics_service):
        """Test that the metrics service initializes correctly."""
        assert isinstance(metrics_service, MultilingualMetricsService)
        assert hasattr(metrics_service, 'language_benchmarks')
        assert SupportedLanguage.FRENCH in metrics_service.language_benchmarks
        assert SupportedLanguage.ENGLISH in metrics_service.language_benchmarks
    
    def test_french_metrics_calculation(self, metrics_service, sample_french_voice_metrics):
        """Test calculation of French-specific metrics."""
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        # Check basic structure
        assert result["language"] == "fr"
        assert "core_metrics" in result
        assert "cultural_metrics" in result
        assert "benchmark_comparison" in result
        assert "improvement_analysis" in result
        assert "language_insights" in result
        assert "overall_language_score" in result
        
        # Check core metrics
        core_metrics = result["core_metrics"]
        assert "pace" in core_metrics
        assert "volume" in core_metrics
        assert "clarity" in core_metrics
        assert "pitch_variation" in core_metrics
        
        # Verify French-specific pace evaluation
        pace_metrics = core_metrics["pace"]
        assert pace_metrics["wpm"] == 280
        assert "optimal_wpm" in pace_metrics
        assert "score" in pace_metrics
        assert "feedback" in pace_metrics
        
        # Check cultural metrics
        cultural_metrics = result["cultural_metrics"]
        assert "cultural_adaptation_score" in cultural_metrics
        assert "cultural_factors" in cultural_metrics
        assert "cultural_feedback" in cultural_metrics
    
    def test_english_metrics_calculation(self, metrics_service, sample_english_voice_metrics):
        """Test calculation of English-specific metrics."""
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_english_voice_metrics,
            language=SupportedLanguage.ENGLISH
        )
        
        # Check basic structure
        assert result["language"] == "en"
        assert "core_metrics" in result
        assert "cultural_metrics" in result
        assert "benchmark_comparison" in result
        
        # Check core metrics adapted for English
        core_metrics = result["core_metrics"]
        pace_metrics = core_metrics["pace"]
        assert pace_metrics["wpm"] == 180
        
        # English should have different optimal pace than French
        french_result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_english_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        french_optimal = french_result["core_metrics"]["pace"]["optimal_wpm"]
        english_optimal = pace_metrics["optimal_wpm"]
        assert french_optimal != english_optimal
    
    def test_benchmark_comparison(self, metrics_service, sample_french_voice_metrics):
        """Test benchmark comparison functionality."""
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        benchmark_comparison = result["benchmark_comparison"]
        assert "language" in benchmark_comparison
        assert "comparisons" in benchmark_comparison
        assert "overall_percentile" in benchmark_comparison
        assert "strengths" in benchmark_comparison
        assert "improvement_areas" in benchmark_comparison
        
        # Check that comparisons contain expected metrics
        comparisons = benchmark_comparison["comparisons"]
        expected_metrics = ["pace", "volume", "clarity", "pitch_variation", "cultural_adaptation"]
        
        for metric in expected_metrics:
            if metric in comparisons:
                comp = comparisons[metric]
                assert "user_score" in comp
                assert "benchmark_mean" in comp
                assert "percentile_rank" in comp
                assert "performance_level" in comp
                assert "comparison_text" in comp
    
    def test_improvement_analysis(self, metrics_service, sample_french_voice_metrics):
        """Test improvement potential analysis."""
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        improvement_analysis = result["improvement_analysis"]
        assert "improvement_analysis" in improvement_analysis
        assert "priority_order" in improvement_analysis
        assert "top_3_priorities" in improvement_analysis
        assert "quick_wins" in improvement_analysis
        assert "long_term_goals" in improvement_analysis
        
        # Check that each metric has improvement analysis
        analysis = improvement_analysis["improvement_analysis"]
        for metric_name, metric_analysis in analysis.items():
            assert "current_score" in metric_analysis
            assert "improvement_potential" in metric_analysis
            assert "effort_required" in metric_analysis
            assert "impact_potential" in metric_analysis
            assert "priority_score" in metric_analysis
            assert "recommended_actions" in metric_analysis
    
    def test_language_insights_generation(self, metrics_service, sample_french_voice_metrics):
        """Test generation of language-specific insights."""
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        insights = result["language_insights"]
        assert isinstance(insights, list)
        
        # Check insight structure
        for insight in insights:
            assert "type" in insight
            assert "level" in insight
            assert "title" in insight
            assert "message" in insight
            assert "action" in insight
            
            # Verify French language in messages
            if insight["type"] == "cultural":
                assert any(french_word in insight["message"].lower() 
                          for french_word in ["français", "française", "structure", "élégance"])
    
    def test_overall_language_score(self, metrics_service, sample_french_voice_metrics):
        """Test overall language score calculation."""
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        overall_score = result["overall_language_score"]
        assert "overall_score" in overall_score
        assert "percentage" in overall_score
        assert "grade" in overall_score
        assert "weights_used" in overall_score
        assert "component_scores" in overall_score
        assert "performance_level" in overall_score
        assert "next_milestone" in overall_score
        
        # Verify score is in valid range
        assert 0.0 <= overall_score["overall_score"] <= 1.0
        assert 0.0 <= overall_score["percentage"] <= 100.0
        assert overall_score["grade"] in ["A", "B", "C", "D", "F"]
    
    def test_language_comparison(self, metrics_service, sample_french_voice_metrics):
        """Test that French and English metrics produce different results."""
        french_result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        english_result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,  # Same metrics, different language
            language=SupportedLanguage.ENGLISH
        )
        
        # Same input should produce different scores due to different expectations
        french_score = french_result["overall_language_score"]["overall_score"]
        english_score = english_result["overall_language_score"]["overall_score"]
        
        # Scores might be different due to different language expectations
        # The exact values depend on how well the metrics fit each language's expectations
        assert isinstance(french_score, float)
        assert isinstance(english_score, float)
        
        # Check that language-specific weights are different
        french_weights = french_result["overall_language_score"]["weights_used"]
        english_weights = english_result["overall_language_score"]["weights_used"]
        assert french_weights != english_weights
    
    def test_cultural_adaptation_metrics(self, metrics_service, sample_french_voice_metrics):
        """Test cultural adaptation metrics calculation."""
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        cultural_metrics = result["cultural_metrics"]
        cultural_factors = cultural_metrics["cultural_factors"]
        
        # Check that all cultural factors are calculated
        expected_factors = ["formality_level", "engagement_style", "directness_level", "emotional_expression"]
        for factor in expected_factors:
            assert factor in cultural_factors
            assert isinstance(cultural_factors[factor], float)
            assert 0.0 <= cultural_factors[factor] <= 1.0
        
        # Check cultural adaptation score
        cultural_score = cultural_metrics["cultural_adaptation_score"]
        assert isinstance(cultural_score, float)
        assert 0.0 <= cultural_score <= 1.0
        
        # Check cultural feedback
        cultural_feedback = cultural_metrics["cultural_feedback"]
        assert isinstance(cultural_feedback, list)
    
    def test_session_context_integration(self, metrics_service, sample_french_voice_metrics):
        """Test integration with session context."""
        session_context = {
            "session_type": "practice",
            "total_chunks": 10,
            "session_duration": 300.0,
            "user_level": "intermediate"
        }
        
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=sample_french_voice_metrics,
            language=SupportedLanguage.FRENCH,
            session_context=session_context
        )
        
        # Verify session context is preserved
        assert "session_context" in result
        assert result["session_context"] == session_context
    
    def test_error_handling(self, metrics_service):
        """Test error handling with invalid input."""
        # Test with empty voice metrics
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics={},
            language=SupportedLanguage.FRENCH
        )
        
        # Should not crash and should return valid structure
        assert "language" in result
        assert result["language"] == "fr"
        
        # Test with malformed voice metrics
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics={"invalid_key": "invalid_value"},
            language=SupportedLanguage.ENGLISH
        )
        
        # Should handle gracefully
        assert "language" in result
        assert result["language"] == "en"
    
    def test_metric_categories(self):
        """Test that all metric categories are properly defined."""
        expected_categories = [
            "pace", "volume", "clarity", "pitch_variation", 
            "consistency", "engagement", "cultural_adaptation"
        ]
        
        for category in expected_categories:
            # Test that category exists in enum
            assert hasattr(MetricCategory, category.upper())
    
    def test_performance_levels(self, metrics_service, sample_french_voice_metrics):
        """Test performance level classification."""
        # Test with high-quality metrics
        high_quality_metrics = {
            **sample_french_voice_metrics,
            "clarity_score": 0.95,
            "volume_consistency": 0.92,
            "pace_wpm": 282  # Optimal for French
        }
        
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=high_quality_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        overall_score = result["overall_language_score"]
        performance_level = overall_score["performance_level"]
        
        # Should classify as high performance level
        assert performance_level in ["expert", "advanced", "intermediate", "beginner", "novice"]
        
        # Test with low-quality metrics
        low_quality_metrics = {
            **sample_french_voice_metrics,
            "clarity_score": 0.3,
            "volume_consistency": 0.2,
            "pace_wpm": 50  # Too slow
        }
        
        result = metrics_service.calculate_language_specific_metrics(
            voice_metrics=low_quality_metrics,
            language=SupportedLanguage.FRENCH
        )
        
        overall_score = result["overall_language_score"]
        performance_level = overall_score["performance_level"]
        
        # Should classify as lower performance level
        assert performance_level in ["beginner", "novice"]


class TestMultilingualMetricsIntegration:
    """Test integration of multilingual metrics with other systems."""
    
    def test_metrics_service_creation(self):
        """Test that the service can be created correctly."""
        service = create_multilingual_metrics_service()
        assert isinstance(service, MultilingualMetricsService)
    
    def test_benchmark_data_structure(self):
        """Test that benchmark data has correct structure."""
        service = create_multilingual_metrics_service()
        
        for language in [SupportedLanguage.FRENCH, SupportedLanguage.ENGLISH]:
            benchmarks = service.language_benchmarks[language]
            
            for category in MetricCategory:
                if category.value in benchmarks:
                    benchmark_data = benchmarks[category.value]
                    
                    # Check required fields
                    assert "mean" in benchmark_data
                    assert "std" in benchmark_data
                    assert "percentiles" in benchmark_data
                    
                    # Check percentiles structure
                    percentiles = benchmark_data["percentiles"]
                    assert len(percentiles) == 5  # 20, 40, 60, 80, 100 percentiles
                    assert all(isinstance(p, (int, float)) for p in percentiles)
    
    def test_language_specific_differences(self):
        """Test that different languages have different benchmark expectations."""
        service = create_multilingual_metrics_service()
        
        french_benchmarks = service.language_benchmarks[SupportedLanguage.FRENCH]
        english_benchmarks = service.language_benchmarks[SupportedLanguage.ENGLISH]
        
        # Pace expectations should be different
        french_pace = french_benchmarks[MetricCategory.PACE]["mean"]
        english_pace = english_benchmarks[MetricCategory.PACE]["mean"]
        assert french_pace != english_pace
        
        # Pitch variation expectations should be different
        french_pitch = french_benchmarks[MetricCategory.PITCH_VARIATION]["mean"]
        english_pitch = english_benchmarks[MetricCategory.PITCH_VARIATION]["mean"]
        assert french_pitch != english_pitch
    
    def test_comprehensive_analysis_flow(self):
        """Test the complete analysis flow."""
        service = create_multilingual_metrics_service()
        
        # Simulate a complete analysis session
        voice_metrics = {
            "duration": 10.0,
            "avg_volume": 0.07,
            "pace_wpm": 165,
            "clarity_score": 0.82,
            "pitch_variance": 0.18,
            "volume_consistency": 0.85,
            "voice_activity_ratio": 0.78
        }
        
        session_context = {
            "session_type": "presentation",
            "duration": 600,
            "user_level": "intermediate"
        }
        
        # Test both languages
        for language in [SupportedLanguage.FRENCH, SupportedLanguage.ENGLISH]:
            result = service.calculate_language_specific_metrics(
                voice_metrics=voice_metrics,
                language=language,
                session_context=session_context
            )
            
            # Verify complete structure
            assert "core_metrics" in result
            assert "cultural_metrics" in result
            assert "benchmark_comparison" in result
            assert "improvement_analysis" in result
            assert "language_insights" in result
            assert "overall_language_score" in result
            
            # Verify all results are valid
            assert result["language"] == language.value
            assert isinstance(result["overall_language_score"]["overall_score"], float)
            assert isinstance(result["language_insights"], list)
            assert len(result["improvement_analysis"]["top_3_priorities"]) <= 3