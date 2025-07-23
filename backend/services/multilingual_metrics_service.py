"""
AURA Multilingual Metrics Service

Service for calculating and analyzing language-specific performance metrics
with cultural benchmarks and comparative analysis.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import numpy as np
from enum import Enum

from models.session import SupportedLanguage
from utils.language_config import get_language_config, get_audio_config
from utils.logging import get_logger

logger = get_logger(__name__)


class MetricCategory(str, Enum):
    """Categories of metrics for multilingual analysis."""
    PACE = "pace"
    VOLUME = "volume" 
    CLARITY = "clarity"
    PITCH_VARIATION = "pitch_variation"
    CONSISTENCY = "consistency"
    ENGAGEMENT = "engagement"
    CULTURAL_ADAPTATION = "cultural_adaptation"


class MultilingualMetricsService:
    """Service for calculating language-specific metrics and benchmarks."""
    
    def __init__(self):
        self.logger = logger
        
        # Language-specific benchmark data (would be populated from analytics database)
        self.language_benchmarks = {
            SupportedLanguage.FRENCH: {
                MetricCategory.PACE: {"mean": 4.7, "std": 0.8, "percentiles": [3.8, 4.2, 4.7, 5.2, 5.6]},
                MetricCategory.VOLUME: {"mean": 0.06, "std": 0.015, "percentiles": [0.04, 0.05, 0.06, 0.07, 0.08]},
                MetricCategory.CLARITY: {"mean": 0.78, "std": 0.12, "percentiles": [0.65, 0.72, 0.78, 0.85, 0.92]},
                MetricCategory.PITCH_VARIATION: {"mean": 0.15, "std": 0.05, "percentiles": [0.08, 0.12, 0.15, 0.18, 0.22]},
                MetricCategory.CONSISTENCY: {"mean": 0.82, "std": 0.08, "percentiles": [0.72, 0.78, 0.82, 0.87, 0.93]},
                MetricCategory.ENGAGEMENT: {"mean": 0.71, "std": 0.11, "percentiles": [0.58, 0.65, 0.71, 0.78, 0.86]},
                MetricCategory.CULTURAL_ADAPTATION: {"mean": 0.75, "std": 0.10, "percentiles": [0.62, 0.69, 0.75, 0.82, 0.89]}
            },
            SupportedLanguage.ENGLISH: {
                MetricCategory.PACE: {"mean": 3.7, "std": 0.6, "percentiles": [2.9, 3.3, 3.7, 4.1, 4.5]},
                MetricCategory.VOLUME: {"mean": 0.08, "std": 0.020, "percentiles": [0.055, 0.065, 0.08, 0.095, 0.11]},
                MetricCategory.CLARITY: {"mean": 0.73, "std": 0.14, "percentiles": [0.58, 0.66, 0.73, 0.81, 0.89]},
                MetricCategory.PITCH_VARIATION: {"mean": 0.25, "std": 0.08, "percentiles": [0.15, 0.20, 0.25, 0.30, 0.37]},
                MetricCategory.CONSISTENCY: {"mean": 0.76, "std": 0.12, "percentiles": [0.62, 0.70, 0.76, 0.83, 0.91]},
                MetricCategory.ENGAGEMENT: {"mean": 0.79, "std": 0.09, "percentiles": [0.68, 0.74, 0.79, 0.85, 0.92]},
                MetricCategory.CULTURAL_ADAPTATION: {"mean": 0.72, "std": 0.13, "percentiles": [0.57, 0.64, 0.72, 0.81, 0.90]}
            }
        }
        
        logger.info("MultilingualMetricsService initialized")
    
    def calculate_language_specific_metrics(
        self,
        voice_metrics: Dict[str, Any],
        language: SupportedLanguage,
        session_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive language-specific metrics.
        
        Args:
            voice_metrics: Raw voice analysis data
            language: Target language for culturally appropriate metrics
            session_context: Additional session context
            
        Returns:
            Dict containing language-specific metrics and benchmarks
        """
        try:
            language_config = get_language_config(language)
            audio_config = get_audio_config(language)
            
            # Calculate core metrics adapted to language
            core_metrics = self._calculate_core_metrics(voice_metrics, language, audio_config)
            
            # Calculate cultural adaptation metrics
            cultural_metrics = self._calculate_cultural_metrics(voice_metrics, language, language_config)
            
            # Calculate comparative benchmarks
            benchmark_comparison = self._calculate_benchmark_comparison(core_metrics, cultural_metrics, language)
            
            # Calculate improvement potential
            improvement_analysis = self._calculate_improvement_potential(core_metrics, cultural_metrics, language)
            
            # Generate language-specific insights
            insights = self._generate_language_insights(core_metrics, cultural_metrics, benchmark_comparison, language)
            
            result = {
                "language": language.value,
                "timestamp": datetime.utcnow().isoformat(),
                "core_metrics": core_metrics,
                "cultural_metrics": cultural_metrics,
                "benchmark_comparison": benchmark_comparison,
                "improvement_analysis": improvement_analysis,
                "language_insights": insights,
                "overall_language_score": self._calculate_overall_language_score(core_metrics, cultural_metrics, language),
                "session_context": session_context or {}
            }
            
            logger.info(f"Calculated language-specific metrics for {language.value}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to calculate language-specific metrics: {e}")
            return {
                "error": str(e),
                "language": language.value,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def _calculate_core_metrics(
        self,
        voice_metrics: Dict[str, Any],
        language: SupportedLanguage,
        audio_config
    ) -> Dict[str, Any]:
        """Calculate core metrics adapted to language expectations."""
        
        # Pace metrics with language-specific optimization
        pace_wpm = voice_metrics.get("pace_wpm", 0)
        optimal_pace = audio_config.optimal_pace * 60  # Convert to WPM
        pace_deviation = abs(pace_wpm - optimal_pace) / optimal_pace if optimal_pace > 0 else 1
        pace_score = max(0, 1 - pace_deviation)
        
        # Volume metrics with language-specific thresholds
        avg_volume = voice_metrics.get("avg_volume", 0)
        volume_consistency = voice_metrics.get("volume_consistency", 0)
        # Use dynamic_range_optimal as a proxy for target volume
        volume_target = audio_config.dynamic_range_optimal
        volume_deviation = abs(avg_volume - volume_target) / volume_target if volume_target > 0 else 1
        volume_score = max(0, 1 - volume_deviation) * volume_consistency
        
        # Clarity with language-specific expectations
        clarity_score = voice_metrics.get("clarity_score", 0)
        # Use clarity_weight as a scaling factor
        clarity_weight = audio_config.clarity_weight
        clarity_adjusted = clarity_score * clarity_weight
        
        # Pitch variation with cultural expectations
        pitch_variance = voice_metrics.get("pitch_variance", 0)
        expected_variance = audio_config.pitch_variance_expected
        pitch_ratio = pitch_variance / expected_variance if expected_variance > 0 else 0
        pitch_score = 1.0 - abs(pitch_ratio - 1.0) if pitch_ratio <= 2.0 else max(0, 1.0 - (pitch_ratio - 1.0) * 0.5)
        
        return {
            "pace": {
                "wpm": pace_wpm,
                "optimal_wpm": optimal_pace,
                "deviation": pace_deviation,
                "score": pace_score,
                "feedback": self._get_pace_feedback(pace_deviation, language)
            },
            "volume": {
                "level": avg_volume,
                "consistency": volume_consistency,
                "target_level": volume_target,
                "score": volume_score,
                "feedback": self._get_volume_feedback(avg_volume, volume_target, language)
            },
            "clarity": {
                "raw_score": clarity_score,
                "adjusted_score": clarity_adjusted,
                "weight_applied": clarity_weight,
                "feedback": self._get_clarity_feedback(clarity_adjusted, language)
            },
            "pitch_variation": {
                "actual_variance": pitch_variance,
                "expected_variance": expected_variance,
                "ratio": pitch_ratio,
                "score": pitch_score,
                "feedback": self._get_pitch_feedback(pitch_ratio, language)
            }
        }
    
    def _calculate_cultural_metrics(
        self,
        voice_metrics: Dict[str, Any],
        language: SupportedLanguage,
        language_config
    ) -> Dict[str, Any]:
        """Calculate metrics specific to cultural presentation style."""
        
        # Cultural adaptation score based on language expectations
        cultural_factors = {
            "formality_level": self._assess_formality(voice_metrics, language),
            "engagement_style": self._assess_engagement_style(voice_metrics, language),
            "directness_level": self._assess_directness(voice_metrics, language),
            "emotional_expression": self._assess_emotional_expression(voice_metrics, language)
        }
        
        # Weight factors based on cultural importance
        if language == SupportedLanguage.FRENCH:
            weights = {"formality_level": 0.35, "engagement_style": 0.25, "directness_level": 0.20, "emotional_expression": 0.20}
        else:  # English
            weights = {"formality_level": 0.20, "engagement_style": 0.35, "directness_level": 0.25, "emotional_expression": 0.20}
        
        cultural_adaptation_score = sum(cultural_factors[factor] * weights[factor] for factor in cultural_factors)
        
        return {
            "cultural_factors": cultural_factors,
            "cultural_weights": weights,
            "cultural_adaptation_score": cultural_adaptation_score,
            "cultural_feedback": self._get_cultural_feedback(cultural_factors, language),
            "style_recommendations": self._get_style_recommendations(cultural_factors, language)
        }
    
    def _calculate_benchmark_comparison(
        self,
        core_metrics: Dict[str, Any],
        cultural_metrics: Dict[str, Any],
        language: SupportedLanguage
    ) -> Dict[str, Any]:
        """Compare metrics against language-specific benchmarks."""
        
        benchmarks = self.language_benchmarks.get(language, {})
        comparisons = {}
        
        # Compare each metric category
        for category in MetricCategory:
            if category.value in benchmarks:
                benchmark_data = benchmarks[category.value]
                user_score = self._extract_score_for_category(core_metrics, cultural_metrics, category)
                
                # Calculate percentile ranking
                percentile = self._calculate_percentile(user_score, benchmark_data["percentiles"])
                
                # Calculate z-score
                z_score = (user_score - benchmark_data["mean"]) / benchmark_data["std"] if benchmark_data["std"] > 0 else 0
                
                comparisons[category.value] = {
                    "user_score": user_score,
                    "benchmark_mean": benchmark_data["mean"],
                    "benchmark_std": benchmark_data["std"],
                    "percentile_rank": percentile,
                    "z_score": z_score,
                    "performance_level": self._get_performance_level(percentile),
                    "comparison_text": self._get_comparison_text(percentile, language)
                }
        
        return {
            "language": language.value,
            "comparisons": comparisons,
            "overall_percentile": np.mean([comp["percentile_rank"] for comp in comparisons.values()]),
            "strengths": self._identify_strengths(comparisons),
            "improvement_areas": self._identify_improvement_areas(comparisons)
        }
    
    def _calculate_improvement_potential(
        self,
        core_metrics: Dict[str, Any],
        cultural_metrics: Dict[str, Any],
        language: SupportedLanguage
    ) -> Dict[str, Any]:
        """Calculate improvement potential for each metric area."""
        
        improvement_analysis = {}
        
        # Analyze each core metric for improvement potential
        for metric_name, metric_data in core_metrics.items():
            current_score = metric_data.get("score", 0)
            max_potential = 1.0
            improvement_potential = max_potential - current_score
            
            # Calculate effort required and impact
            effort_required = self._calculate_effort_required(metric_name, current_score, language)
            impact_potential = self._calculate_impact_potential(metric_name, improvement_potential, language)
            
            improvement_analysis[metric_name] = {
                "current_score": current_score,
                "improvement_potential": improvement_potential,
                "effort_required": effort_required,
                "impact_potential": impact_potential,
                "priority_score": impact_potential / max(effort_required, 0.1),
                "recommended_actions": self._get_improvement_actions(metric_name, current_score, language)
            }
        
        # Add cultural improvement analysis
        cultural_score = cultural_metrics.get("cultural_adaptation_score", 0)
        improvement_analysis["cultural_adaptation"] = {
            "current_score": cultural_score,
            "improvement_potential": 1.0 - cultural_score,
            "effort_required": self._calculate_cultural_effort(cultural_score, language),
            "impact_potential": 0.8,  # High impact for cultural adaptation
            "priority_score": (1.0 - cultural_score) * 0.8 / 0.3,
            "recommended_actions": cultural_metrics.get("style_recommendations", [])
        }
        
        # Sort by priority
        sorted_priorities = sorted(
            improvement_analysis.items(),
            key=lambda x: x[1]["priority_score"],
            reverse=True
        )
        
        return {
            "improvement_analysis": improvement_analysis,
            "priority_order": [item[0] for item in sorted_priorities],
            "top_3_priorities": [item[0] for item in sorted_priorities[:3]],
            "quick_wins": [item[0] for item in sorted_priorities if item[1]["effort_required"] < 0.3 and item[1]["impact_potential"] > 0.5],
            "long_term_goals": [item[0] for item in sorted_priorities if item[1]["effort_required"] > 0.7]
        }
    
    def _generate_language_insights(
        self,
        core_metrics: Dict[str, Any],
        cultural_metrics: Dict[str, Any],
        benchmark_comparison: Dict[str, Any],
        language: SupportedLanguage
    ) -> List[Dict[str, Any]]:
        """Generate actionable insights specific to the language and culture."""
        
        insights = []
        
        # Performance insights
        overall_percentile = benchmark_comparison.get("overall_percentile", 50)
        if overall_percentile >= 80:
            insights.append({
                "type": "performance",
                "level": "excellent",
                "title": "Performance Exceptionnelle" if language == SupportedLanguage.FRENCH else "Exceptional Performance",
                "message": "Vous êtes dans le top 20% des présentateurs" if language == SupportedLanguage.FRENCH else "You're in the top 20% of presenters",
                "action": "Maintenez cette excellence" if language == SupportedLanguage.FRENCH else "Maintain this excellence"
            })
        elif overall_percentile <= 30:
            insights.append({
                "type": "performance", 
                "level": "needs_improvement",
                "title": "Potentiel d'Amélioration Significatif" if language == SupportedLanguage.FRENCH else "Significant Improvement Potential",
                "message": "Concentrez-vous sur les bases" if language == SupportedLanguage.FRENCH else "Focus on the fundamentals",
                "action": "Pratiquez régulièrement" if language == SupportedLanguage.FRENCH else "Practice regularly"
            })
        
        # Language-specific cultural insights
        cultural_score = cultural_metrics.get("cultural_adaptation_score", 0)
        if language == SupportedLanguage.FRENCH:
            if cultural_score < 0.6:
                insights.append({
                    "type": "cultural",
                    "level": "improvement_needed",
                    "title": "Adaptation Culturelle Française",
                    "message": "Votre style pourrait mieux s'adapter aux attentes françaises",
                    "action": "Privilégiez la structure logique et l'élégance verbale"
                })
            elif cultural_score > 0.8:
                insights.append({
                    "type": "cultural",
                    "level": "excellent",
                    "title": "Maîtrise du Style Français",
                    "message": "Vous maîtrisez parfaitement les codes de présentation français",
                    "action": "Continuez à cultiver cette élégance"
                })
        else:  # English
            if cultural_score < 0.6:
                insights.append({
                    "type": "cultural",
                    "level": "improvement_needed", 
                    "title": "English Presentation Style",
                    "message": "Your style could better engage English-speaking audiences",
                    "action": "Focus on storytelling and dynamic delivery"
                })
            elif cultural_score > 0.8:
                insights.append({
                    "type": "cultural",
                    "level": "excellent",
                    "title": "Excellent English Style",
                    "message": "You have mastered engaging English presentation techniques",
                    "action": "Keep building on this strong foundation"
                })
        
        # Specific metric insights
        strengths = benchmark_comparison.get("strengths", [])
        for strength in strengths[:2]:  # Top 2 strengths
            insights.append({
                "type": "strength",
                "level": "positive",
                "title": f"Force Identifiée: {strength}" if language == SupportedLanguage.FRENCH else f"Identified Strength: {strength}",
                "message": self._get_strength_message(strength, language),
                "action": self._get_strength_action(strength, language)
            })
        
        improvement_areas = benchmark_comparison.get("improvement_areas", [])
        for area in improvement_areas[:2]:  # Top 2 improvement areas
            insights.append({
                "type": "improvement",
                "level": "actionable",
                "title": f"Zone d'Amélioration: {area}" if language == SupportedLanguage.FRENCH else f"Improvement Area: {area}",
                "message": self._get_improvement_message(area, language),
                "action": self._get_improvement_action(area, language)
            })
        
        return insights
    
    def _calculate_overall_language_score(
        self,
        core_metrics: Dict[str, Any],
        cultural_metrics: Dict[str, Any],
        language: SupportedLanguage
    ) -> Dict[str, Any]:
        """Calculate overall language-adapted performance score."""
        
        # Extract individual scores
        pace_score = core_metrics.get("pace", {}).get("score", 0)
        volume_score = core_metrics.get("volume", {}).get("score", 0)
        clarity_score = core_metrics.get("clarity", {}).get("adjusted_score", 0)
        pitch_score = core_metrics.get("pitch_variation", {}).get("score", 0)
        cultural_score = cultural_metrics.get("cultural_adaptation_score", 0)
        
        # Language-specific weights
        if language == SupportedLanguage.FRENCH:
            weights = {
                "pace": 0.25,
                "volume": 0.20,
                "clarity": 0.25,
                "pitch": 0.15,
                "cultural": 0.15
            }
        else:  # English
            weights = {
                "pace": 0.20,
                "volume": 0.20,
                "clarity": 0.20,
                "pitch": 0.20,
                "cultural": 0.20
            }
        
        # Calculate weighted score
        overall_score = (
            pace_score * weights["pace"] +
            volume_score * weights["volume"] +
            clarity_score * weights["clarity"] +
            pitch_score * weights["pitch"] +
            cultural_score * weights["cultural"]
        )
        
        # Convert to percentage and grade
        percentage = overall_score * 100
        grade = self._get_performance_grade(percentage, language)
        
        return {
            "overall_score": overall_score,
            "percentage": percentage,
            "grade": grade,
            "weights_used": weights,
            "component_scores": {
                "pace": pace_score,
                "volume": volume_score,
                "clarity": clarity_score,
                "pitch_variation": pitch_score,
                "cultural_adaptation": cultural_score
            },
            "performance_level": self._get_performance_level_from_score(overall_score),
            "next_milestone": self._get_next_milestone(overall_score, language)
        }
    
    # Helper methods for feedback and analysis
    def _get_pace_feedback(self, deviation: float, language: SupportedLanguage) -> str:
        if deviation < 0.1:
            return "Rythme parfait" if language == SupportedLanguage.FRENCH else "Perfect pace"
        elif deviation < 0.3:
            return "Rythme approprié" if language == SupportedLanguage.FRENCH else "Good pace"
        else:
            return "Ajustez votre rythme" if language == SupportedLanguage.FRENCH else "Adjust your pace"
    
    def _get_volume_feedback(self, actual: float, target: float, language: SupportedLanguage) -> str:
        ratio = actual / target if target > 0 else 0
        if 0.8 <= ratio <= 1.2:
            return "Volume idéal" if language == SupportedLanguage.FRENCH else "Ideal volume"
        elif ratio < 0.8:
            return "Parlez plus fort" if language == SupportedLanguage.FRENCH else "Speak louder"
        else:
            return "Baissez le volume" if language == SupportedLanguage.FRENCH else "Lower your volume"
    
    def _get_clarity_feedback(self, score: float, language: SupportedLanguage) -> str:
        if score >= 0.8:
            return "Excellente clarté" if language == SupportedLanguage.FRENCH else "Excellent clarity"
        elif score >= 0.6:
            return "Bonne clarté" if language == SupportedLanguage.FRENCH else "Good clarity"
        else:
            return "Travaillez l'articulation" if language == SupportedLanguage.FRENCH else "Work on articulation"
    
    def _get_pitch_feedback(self, ratio: float, language: SupportedLanguage) -> str:
        if 0.8 <= ratio <= 1.2:
            return "Intonation adaptée" if language == SupportedLanguage.FRENCH else "Appropriate intonation"
        elif ratio < 0.8:
            return "Variez davantage l'intonation" if language == SupportedLanguage.FRENCH else "Add more vocal variety"
        else:
            return "Modérez les variations" if language == SupportedLanguage.FRENCH else "Moderate vocal variations"
    
    def _assess_formality(self, voice_metrics: Dict[str, Any], language: SupportedLanguage) -> float:
        # Assess formality based on pace consistency and volume control
        pace_consistency = 1.0 - voice_metrics.get("pace_variability", 0.5)
        volume_consistency = voice_metrics.get("volume_consistency", 0.5)
        return (pace_consistency + volume_consistency) / 2
    
    def _assess_engagement_style(self, voice_metrics: Dict[str, Any], language: SupportedLanguage) -> float:
        # Assess engagement through pitch variation and energy
        pitch_variance = min(voice_metrics.get("pitch_variance", 0) / 0.3, 1.0)
        energy_level = min(voice_metrics.get("avg_volume", 0) / 0.1, 1.0)
        return (pitch_variance + energy_level) / 2
    
    def _assess_directness(self, voice_metrics: Dict[str, Any], language: SupportedLanguage) -> float:
        # Assess directness through pace and pause patterns
        pace_score = min(voice_metrics.get("pace_wpm", 0) / 200, 1.0)
        voice_activity = voice_metrics.get("voice_activity_ratio", 0.5)
        return (pace_score + voice_activity) / 2
    
    def _assess_emotional_expression(self, voice_metrics: Dict[str, Any], language: SupportedLanguage) -> float:
        # Assess emotional expression through pitch and volume dynamics
        pitch_variance = min(voice_metrics.get("pitch_variance", 0) / 0.25, 1.0)
        volume_range = min(voice_metrics.get("volume_range", 0) / 0.05, 1.0)
        return (pitch_variance + volume_range) / 2
    
    def _calculate_percentile(self, score: float, percentiles: List[float]) -> float:
        """Calculate percentile rank of score against benchmark percentiles."""
        for i, p in enumerate(percentiles):
            if score <= p:
                return (i + 1) * 20  # Convert to percentile (20, 40, 60, 80, 100)
        return 100
    
    def _get_performance_level(self, percentile: float) -> str:
        if percentile >= 80:
            return "excellent"
        elif percentile >= 60:
            return "good"
        elif percentile >= 40:
            return "average"
        elif percentile >= 20:
            return "below_average"
        else:
            return "needs_improvement"
    
    def _extract_score_for_category(self, core_metrics: Dict, cultural_metrics: Dict, category: MetricCategory) -> float:
        """Extract relevant score for a metric category."""
        if category == MetricCategory.PACE:
            return core_metrics.get("pace", {}).get("score", 0)
        elif category == MetricCategory.VOLUME:
            return core_metrics.get("volume", {}).get("score", 0) 
        elif category == MetricCategory.CLARITY:
            return core_metrics.get("clarity", {}).get("adjusted_score", 0)
        elif category == MetricCategory.PITCH_VARIATION:
            return core_metrics.get("pitch_variation", {}).get("score", 0)
        elif category == MetricCategory.CULTURAL_ADAPTATION:
            return cultural_metrics.get("cultural_adaptation_score", 0)
        else:
            return 0.5  # Default neutral score
    
    def _identify_strengths(self, comparisons: Dict[str, Any]) -> List[str]:
        """Identify top performing metric areas."""
        return [
            metric for metric, data in comparisons.items()
            if data["percentile_rank"] >= 70
        ]
    
    def _identify_improvement_areas(self, comparisons: Dict[str, Any]) -> List[str]:
        """Identify areas needing improvement."""
        return [
            metric for metric, data in comparisons.items()
            if data["percentile_rank"] <= 40
        ]
    
    def _calculate_effort_required(self, metric_name: str, current_score: float, language: SupportedLanguage) -> float:
        """Estimate effort required to improve a metric."""
        # Higher current scores require more effort to improve further
        base_effort = 1.0 - current_score
        
        # Some metrics are harder to improve than others
        difficulty_multipliers = {
            "pace": 0.6,  # Relatively easy to adjust
            "volume": 0.7,  # Moderate difficulty
            "clarity": 0.9,  # Harder to improve
            "pitch_variation": 0.8,  # Moderate to hard
            "cultural_adaptation": 0.5  # Can improve with awareness
        }
        
        multiplier = difficulty_multipliers.get(metric_name, 0.7)
        return min(base_effort * multiplier, 1.0)
    
    def _calculate_impact_potential(self, metric_name: str, improvement_potential: float, language: SupportedLanguage) -> float:
        """Estimate impact of improving a metric."""
        # Impact varies by metric importance for the language
        if language == SupportedLanguage.FRENCH:
            impact_weights = {
                "pace": 0.8,  # Important for French presentations
                "volume": 0.6,
                "clarity": 0.9,  # Very important
                "pitch_variation": 0.5,
                "cultural_adaptation": 0.7
            }
        else:  # English
            impact_weights = {
                "pace": 0.7,
                "volume": 0.7,
                "clarity": 0.8,
                "pitch_variation": 0.9,  # Very important for English
                "cultural_adaptation": 0.8
            }
        
        weight = impact_weights.get(metric_name, 0.7)
        return improvement_potential * weight
    
    def _calculate_cultural_effort(self, current_score: float, language: SupportedLanguage) -> float:
        """Calculate effort required for cultural adaptation improvement."""
        return max(0.3, (1.0 - current_score) * 0.5)  # Cultural changes require moderate effort
    
    def _get_improvement_actions(self, metric_name: str, current_score: float, language: SupportedLanguage) -> List[str]:
        """Get specific improvement actions for a metric."""
        actions = {
            "pace": [
                "Pratiquer avec un métronome" if language == SupportedLanguage.FRENCH else "Practice with a metronome",
                "Enregistrer et analyser votre rythme" if language == SupportedLanguage.FRENCH else "Record and analyze your pace"
            ],
            "volume": [
                "Exercices de respiration" if language == SupportedLanguage.FRENCH else "Breathing exercises",
                "Projection vocale" if language == SupportedLanguage.FRENCH else "Voice projection practice"
            ],
            "clarity": [
                "Exercices d'articulation" if language == SupportedLanguage.FRENCH else "Articulation exercises",
                "Lecture à voix haute" if language == SupportedLanguage.FRENCH else "Read aloud practice"
            ],
            "pitch_variation": [
                "Varier l'intonation" if language == SupportedLanguage.FRENCH else "Vary your intonation",
                "Storytelling practice" if language == SupportedLanguage.ENGLISH else "Exercices narratifs"
            ]
        }
        return actions.get(metric_name, ["Practice regularly"])
    
    def _get_cultural_feedback(self, cultural_factors: Dict[str, float], language: SupportedLanguage) -> List[str]:
        """Generate cultural adaptation feedback."""
        feedback = []
        
        if language == SupportedLanguage.FRENCH:
            if cultural_factors["formality_level"] < 0.6:
                feedback.append("Adoptez un style plus formel et structuré")
            if cultural_factors["directness_level"] > 0.8:
                feedback.append("Nuancez vos propos avec plus de subtilité")
        else:  # English
            if cultural_factors["engagement_style"] < 0.6:
                feedback.append("Increase audience engagement and energy")
            if cultural_factors["directness_level"] < 0.6:
                feedback.append("Be more direct and action-oriented")
        
        return feedback
    
    def _get_style_recommendations(self, cultural_factors: Dict[str, float], language: SupportedLanguage) -> List[str]:
        """Get style recommendations based on cultural analysis."""
        recommendations = []
        
        if language == SupportedLanguage.FRENCH:
            recommendations.extend([
                "Structurez votre discours de manière cartésienne",
                "Privilégiez l'élégance verbale",
                "Maintenez un niveau de formalité approprié"
            ])
        else:  # English
            recommendations.extend([
                "Focus on storytelling and narrative flow",
                "Use confident and direct language",
                "Engage with dynamic vocal variety"
            ])
        
        return recommendations
    
    def _get_comparison_text(self, percentile: float, language: SupportedLanguage) -> str:
        """Get comparison text based on percentile performance."""
        if language == SupportedLanguage.FRENCH:
            if percentile >= 80:
                return "Excellent - dans le top 20%"
            elif percentile >= 60:
                return "Bon - au-dessus de la moyenne"
            elif percentile >= 40:
                return "Moyen - dans la moyenne"
            else:
                return "À améliorer - en dessous de la moyenne"
        else:
            if percentile >= 80:
                return "Excellent - top 20%"
            elif percentile >= 60:
                return "Good - above average"
            elif percentile >= 40:
                return "Average - typical performance"
            else:
                return "Needs improvement - below average"
    
    def _get_strength_message(self, strength: str, language: SupportedLanguage) -> str:
        """Get strength-specific message."""
        messages = {
            "pace": "Votre rythme est excellent" if language == SupportedLanguage.FRENCH else "Your pacing is excellent",
            "volume": "Votre volume est parfait" if language == SupportedLanguage.FRENCH else "Your volume is perfect",
            "clarity": "Votre articulation est remarquable" if language == SupportedLanguage.FRENCH else "Your articulation is remarkable"
        }
        return messages.get(strength, "Performance forte" if language == SupportedLanguage.FRENCH else "Strong performance")
    
    def _get_strength_action(self, strength: str, language: SupportedLanguage) -> str:
        """Get action to maintain strength."""
        return "Continuez ainsi" if language == SupportedLanguage.FRENCH else "Keep it up"
    
    def _get_improvement_message(self, area: str, language: SupportedLanguage) -> str:
        """Get improvement-specific message."""
        messages = {
            "pace": "Votre rythme peut être optimisé" if language == SupportedLanguage.FRENCH else "Your pace can be optimized",
            "volume": "Votre volume nécessite des ajustements" if language == SupportedLanguage.FRENCH else "Your volume needs adjustment",
            "clarity": "Votre articulation peut être améliorée" if language == SupportedLanguage.FRENCH else "Your articulation can be improved"
        }
        return messages.get(area, "Zone d'amélioration identifiée" if language == SupportedLanguage.FRENCH else "Improvement area identified")
    
    def _get_improvement_action(self, area: str, language: SupportedLanguage) -> str:
        """Get specific improvement action."""
        actions = {
            "pace": "Pratiquez le contrôle du rythme" if language == SupportedLanguage.FRENCH else "Practice pace control",
            "volume": "Travaillez la projection vocale" if language == SupportedLanguage.FRENCH else "Work on voice projection",
            "clarity": "Faites des exercices d'élocution" if language == SupportedLanguage.FRENCH else "Do articulation exercises"
        }
        return actions.get(area, "Pratiquez régulièrement" if language == SupportedLanguage.FRENCH else "Practice regularly")
    
    def _get_performance_grade(self, percentage: float, language: SupportedLanguage) -> str:
        """Convert percentage to letter grade."""
        if percentage >= 90:
            return "A" 
        elif percentage >= 80:
            return "B"
        elif percentage >= 70:
            return "C"
        elif percentage >= 60:
            return "D"
        else:
            return "F"
    
    def _get_performance_level_from_score(self, score: float) -> str:
        """Get performance level from overall score."""
        if score >= 0.9:
            return "expert"
        elif score >= 0.8:
            return "advanced"
        elif score >= 0.7:
            return "intermediate"
        elif score >= 0.6:
            return "beginner"
        else:
            return "novice"
    
    def _get_next_milestone(self, current_score: float, language: SupportedLanguage) -> Dict[str, Any]:
        """Get next performance milestone to reach."""
        milestones = [0.6, 0.7, 0.8, 0.9, 1.0]
        
        for milestone in milestones:
            if current_score < milestone:
                return {
                    "target_score": milestone,
                    "current_progress": current_score / milestone,
                    "points_needed": milestone - current_score,
                    "description": f"Atteindre {milestone*100:.0f}%" if language == SupportedLanguage.FRENCH else f"Reach {milestone*100:.0f}%"
                }
        
        return {
            "target_score": 1.0,
            "current_progress": 1.0,
            "points_needed": 0,
            "description": "Objectif atteint!" if language == SupportedLanguage.FRENCH else "Goal achieved!"
        }


def create_multilingual_metrics_service() -> MultilingualMetricsService:
    """Create a new multilingual metrics service instance."""
    return MultilingualMetricsService()