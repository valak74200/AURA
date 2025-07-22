"""
AURA Feedback Generation Processor

GenAI Processor for generating intelligent, contextual coaching feedback
using Gemini models based on comprehensive voice analysis results.
"""

import asyncio
import json
from datetime import datetime
from typing import AsyncIterator, Dict, Any, List, Optional
from uuid import uuid4

from genai_processors import Processor, ProcessorPart

from models.session import SessionConfig
from models.feedback import (
    FeedbackItem, FeedbackType, FeedbackSeverity,
    RealTimeFeedback, VoiceMetrics
)
from services.gemini_service import GeminiService
from utils.logging import get_logger
from utils.exceptions import AIModelException, ProcessorException
from app.config import get_settings

logger = get_logger(__name__)
settings = get_settings()


class FeedbackProcessor(Processor):
    """
    Processor that generates intelligent coaching feedback using Gemini AI.
    
    Analyzes voice metrics and generates contextual, actionable feedback
    for presentation improvement with personalized coaching insights.
    """
    
    def __init__(self, config: SessionConfig):
        """
        Initialize feedback processor.
        
        Args:
            config: Session configuration
        """
        super().__init__()
        self.config = config
        self.gemini_service = GeminiService(settings)
        
        # Feedback generation state
        self.feedback_history: List[Dict[str, Any]] = []
        self.session_context = {
            "total_feedback_generated": 0,
            "feedback_themes": {},
            "improvement_areas": set(),
            "strengths": set(),
            "session_progression": []
        }
        
        # Feedback generation parameters
        self.feedback_params = {
            "min_confidence_threshold": 0.7,
            "feedback_frequency": config.feedback_frequency if hasattr(config, 'feedback_frequency') else 5,
            "max_feedback_per_chunk": 3,
            "context_window_size": 5,
            "personality_style": "encouraging_coach"  # Can be: professional, encouraging_coach, direct
        }
        
        logger.info("Initialized FeedbackProcessor")
    
    async def call(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """Call method required by Processor base class."""
        async for result in self.process(input_stream):
            yield result
    
    async def process(self, input_stream: AsyncIterator[ProcessorPart]) -> AsyncIterator[ProcessorPart]:
        """
        Process voice analysis results and generate intelligent feedback.
        
        Args:
            input_stream: Stream of voice analysis results
            
        Yields:
            ProcessorPart: Generated feedback and coaching insights
        """
        try:
            async for analysis_part in input_stream:
                start_time = datetime.utcnow()
                
                # Validate analysis part
                if not self._validate_analysis_part(analysis_part):
                    logger.debug(f"Skipping non-analysis part: {analysis_part.metadata.get('type', 'unknown')}")
                    continue
                
                # Extract analysis data
                analysis_data = analysis_part.text
                if not analysis_data:
                    continue
                
                try:
                    # Generate feedback based on analysis
                    feedback_results = await self._generate_feedback(analysis_data, analysis_part.metadata)
                    
                    # Update session context
                    self._update_session_context(analysis_data, feedback_results)
                    
                    # Create feedback part
                    feedback_part = ProcessorPart(
                        data=feedback_results,
                        type="feedback_generated",
                        metadata={
                            **analysis_part.metadata,
                            "processor": self.__class__.__name__,
                            "feedback_timestamp": datetime.utcnow().isoformat(),
                            "processing_time_ms": (datetime.utcnow() - start_time).total_seconds() * 1000,
                            "feedback_count": len(feedback_results.get("feedback_items", []))
                        }
                    )
                    
                    logger.debug(
                        "Feedback generated",
                        extra={
                            "chunk_number": analysis_part.metadata.get("chunk_number", 0),
                            "feedback_count": len(feedback_results.get("feedback_items", [])),
                            "session_id": analysis_part.metadata.get("session_id")
                        }
                    )
                    
                    yield feedback_part
                    
                except Exception as e:
                    logger.error(
                        "Feedback generation failed",
                        extra={
                            "chunk_number": analysis_part.metadata.get("chunk_number", 0),
                            "error": str(e)
                        }
                    )
                    
                    # Yield error part with fallback feedback
                    error_part = ProcessorPart(
                        data={
                            "error": str(e),
                            "fallback_feedback": self._generate_fallback_feedback(analysis_data)
                        },
                        type="feedback_error",
                        metadata={
                            **analysis_part.metadata,
                            "processor": self.__class__.__name__,
                            "error_timestamp": datetime.utcnow().isoformat()
                        }
                    )
                    yield error_part
                    
        except Exception as e:
            logger.error(
                "Feedback processor error",
                extra={"error": str(e)},
                exc_info=True
            )
            raise ProcessorException("FeedbackProcessor", str(e))
    
    async def _generate_feedback(self, analysis_data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate comprehensive feedback using Gemini AI.
        
        Args:
            analysis_data: Voice analysis results
            metadata: Chunk metadata
            
        Returns:
            Dict containing generated feedback and insights
        """
        # Extract key metrics for feedback generation
        chunk_metrics = analysis_data.get("chunk_metrics", {})
        advanced_metrics = analysis_data.get("advanced_metrics", {})
        quality_assessment = analysis_data.get("quality_assessment", {})
        
        # Prepare context for Gemini
        feedback_context = self._prepare_feedback_context(analysis_data, metadata)
        
        # Generate different types of feedback
        feedback_results = {
            "feedback_items": [],
            "real_time_suggestions": [],
            "coaching_insights": {},
            "session_progress": {},
            "ai_generated_feedback": {},
            "metadata": {
                "generation_timestamp": datetime.utcnow().isoformat(),
                "chunk_id": metadata.get("chunk_id"),
                "session_id": metadata.get("session_id"),
                "analysis_quality": quality_assessment.get("overall_quality", 0.0)
            }
        }
        
        # Generate real-time feedback for immediate coaching
        real_time_feedback = await self._generate_realtime_feedback(chunk_metrics, advanced_metrics)
        feedback_results["real_time_suggestions"] = real_time_feedback
        
        # Generate comprehensive AI feedback using Gemini (less frequent)
        chunk_number = metadata.get("chunk_number", 0)
        if chunk_number % self.feedback_params["feedback_frequency"] == 0:
            ai_feedback = await self._generate_ai_feedback_with_gemini(feedback_context)
            feedback_results["ai_generated_feedback"] = ai_feedback
            
            # Convert AI feedback to structured feedback items
            structured_feedback = self._structure_ai_feedback(ai_feedback, chunk_metrics)
            feedback_results["feedback_items"].extend(structured_feedback)
        
        # Generate coaching insights
        coaching_insights = await self._generate_coaching_insights(analysis_data)
        feedback_results["coaching_insights"] = coaching_insights
        
        # Track session progress
        session_progress = self._calculate_session_progress(analysis_data)
        feedback_results["session_progress"] = session_progress
        
        return feedback_results
    
    def _prepare_feedback_context(self, analysis_data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare comprehensive context for Gemini feedback generation."""
        chunk_metrics = analysis_data.get("chunk_metrics", {})
        advanced_metrics = analysis_data.get("advanced_metrics", {})
        quality_assessment = analysis_data.get("quality_assessment", {})
        
        # Recent feedback history for context
        recent_feedback = self.feedback_history[-3:] if self.feedback_history else []
        
        return {
            "current_metrics": {
                "pace_wpm": chunk_metrics.get("pace_wpm", 0),
                "volume_consistency": chunk_metrics.get("volume_consistency", 0),
                "clarity_score": chunk_metrics.get("clarity_score", 0),
                "voice_activity_ratio": chunk_metrics.get("voice_activity_ratio", 0),
                "confidence_score": advanced_metrics.get("confidence_score", 0),
                "overall_quality": quality_assessment.get("overall_quality", 0)
            },
            "session_context": {
                "chunk_number": metadata.get("chunk_number", 0),
                "total_feedback_count": self.session_context["total_feedback_generated"],
                "identified_strengths": list(self.session_context["strengths"]),
                "improvement_areas": list(self.session_context["improvement_areas"]),
                "session_duration": len(self.session_context["session_progression"]) * 0.1  # Rough estimate
            },
            "recent_feedback": recent_feedback,
            "coaching_style": self.feedback_params["personality_style"],
            "language": "french"  # Feedback in French
        }
    
    async def _generate_realtime_feedback(self, chunk_metrics: Dict[str, Any], advanced_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate immediate real-time feedback suggestions."""
        suggestions = []
        
        # Pace feedback
        pace_wpm = chunk_metrics.get("pace_wpm", 0)
        if pace_wpm > 200:
            suggestions.append({
                "type": "pace",
                "severity": "warning",
                "message": "Ralentissez votre débit de parole",
                "suggestion": "Prenez une pause et respirez profondément",
                "metric_value": pace_wpm,
                "target_range": "120-180 mots/min",
                "priority": "high"
            })
        elif pace_wpm < 100 and pace_wpm > 0:
            suggestions.append({
                "type": "pace",
                "severity": "info",
                "message": "Vous pouvez accélérer légèrement",
                "suggestion": "Augmentez votre énergie et votre rythme",
                "metric_value": pace_wpm,
                "target_range": "120-180 mots/min",
                "priority": "medium"
            })
        
        # Volume consistency feedback
        volume_consistency = chunk_metrics.get("volume_consistency", 0)
        if volume_consistency < 0.6:
            suggestions.append({
                "type": "volume",
                "severity": "warning",
                "message": "Maintenez un volume plus constant",
                "suggestion": "Concentrez-vous sur une projection vocale régulière",
                "metric_value": volume_consistency,
                "target_range": "> 0.7",
                "priority": "medium"
            })
        
        # Clarity feedback
        clarity_score = chunk_metrics.get("clarity_score", 0)
        if clarity_score < 0.6:
            suggestions.append({
                "type": "clarity",
                "severity": "warning",
                "message": "Articulez plus distinctement",
                "suggestion": "Ouvrez davantage la bouche et prononcez chaque syllabe",
                "metric_value": clarity_score,
                "target_range": "> 0.7",
                "priority": "high"
            })
        
        # Confidence feedback
        confidence_score = advanced_metrics.get("confidence_score", 0)
        if confidence_score > 0.8:
            suggestions.append({
                "type": "confidence",
                "severity": "success",
                "message": "Excellente assurance dans votre voix !",
                "suggestion": "Continuez avec cette belle énergie",
                "metric_value": confidence_score,
                "target_range": "> 0.7",
                "priority": "positive"
            })
        elif confidence_score < 0.5:
            suggestions.append({
                "type": "confidence",
                "severity": "info",
                "message": "Projetez plus de confiance",
                "suggestion": "Redressez-vous et parlez avec plus d'autorité",
                "metric_value": confidence_score,
                "target_range": "> 0.7",
                "priority": "medium"
            })
        
        return suggestions
    
    async def _generate_ai_feedback_with_gemini(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive feedback using Gemini AI."""
        try:
            # Prepare prompt for Gemini
            prompt = self._build_gemini_prompt(context)
            
            # Generate feedback using Gemini
            response = await self._call_gemini_for_feedback(prompt)
            
            # Parse and structure the response
            structured_response = self._parse_gemini_response(response)
            
            return structured_response
            
        except Exception as e:
            logger.error(f"Gemini feedback generation failed: {e}")
            return self._generate_fallback_ai_feedback(context)
    
    def _build_gemini_prompt(self, context: Dict[str, Any]) -> str:
        """Build a comprehensive prompt for Gemini feedback generation."""
        current_metrics = context["current_metrics"]
        session_context = context["session_context"]
        
        prompt = f"""Tu es AURA, un coach de présentation IA expert et bienveillant. Analyse ces métriques vocales et génère un feedback personnalisé en français.

MÉTRIQUES ACTUELLES:
- Débit: {current_metrics['pace_wpm']:.1f} mots/min (idéal: 120-180)
- Consistance volume: {current_metrics['volume_consistency']:.2f} (idéal: >0.7)
- Clarté: {current_metrics['clarity_score']:.2f} (idéal: >0.7)
- Activité vocale: {current_metrics['voice_activity_ratio']:.2f} (idéal: 0.6-0.8)
- Score confiance: {current_metrics['confidence_score']:.2f} (idéal: >0.7)
- Qualité globale: {current_metrics['overall_quality']:.2f}

CONTEXTE SESSION:
- Chunk #{session_context['chunk_number']}
- Durée: {session_context['session_duration']:.1f}s
- Forces identifiées: {', '.join(session_context['identified_strengths']) if session_context['identified_strengths'] else 'Aucune encore'}
- Axes d'amélioration: {', '.join(session_context['improvement_areas']) if session_context['improvement_areas'] else 'Aucun encore'}

STYLE DE COACHING: {context['coaching_style']} - Sois encourageant, constructif et actionnable.

Génère un feedback JSON avec cette structure EXACTE:
{{
    "feedback_summary": "Résumé en 1-2 phrases de la performance actuelle",
    "strengths": ["Force 1", "Force 2"],
    "improvements": [
        {{
            "area": "Domaine à améliorer",
            "current_issue": "Problème spécifique observé",
            "actionable_tip": "Conseil pratique et immédiat",
            "why_important": "Pourquoi c'est important"
        }}
    ],
    "encouragement": "Message motivant personnalisé",
    "next_focus": "Prochaine priorité d'amélioration"
}}

Réponds UNIQUEMENT avec le JSON, sans texte additionnel."""
        
        return prompt
    
    async def _call_gemini_for_feedback(self, prompt: str) -> str:
        """Call Gemini API for feedback generation."""
        try:
            # Use the regular Gemini client for feedback generation
            response = self.gemini_service.client.generate_content(prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise AIModelException(f"Gemini feedback generation failed: {e}")
    
    def _parse_gemini_response(self, response: str) -> Dict[str, Any]:
        """Parse Gemini response into structured feedback."""
        try:
            # Clean up the response (remove potential markdown formatting)
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            
            # Parse JSON
            parsed_response = json.loads(cleaned_response.strip())
            
            # Validate structure
            required_keys = ["feedback_summary", "strengths", "improvements", "encouragement", "next_focus"]
            for key in required_keys:
                if key not in parsed_response:
                    logger.warning(f"Missing key in Gemini response: {key}")
                    parsed_response[key] = self._get_default_value(key)
            
            return parsed_response
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            logger.debug(f"Raw response: {response}")
            return self._generate_fallback_structured_response()
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {e}")
            return self._generate_fallback_structured_response()
    
    def _get_default_value(self, key: str) -> Any:
        """Get default value for missing response keys."""
        defaults = {
            "feedback_summary": "Analyse en cours, continuez votre présentation.",
            "strengths": ["Vous maintenez un bon rythme"],
            "improvements": [{
                "area": "Général",
                "current_issue": "Données insuffisantes",
                "actionable_tip": "Continuez à parler naturellement",
                "why_important": "Pour une analyse plus précise"
            }],
            "encouragement": "Vous progressez bien, continuez !",
            "next_focus": "Maintenir la consistance"
        }
        return defaults.get(key, "")
    
    def _generate_fallback_structured_response(self) -> Dict[str, Any]:
        """Generate fallback response when Gemini parsing fails."""
        return {
            "feedback_summary": "Feedback automatique - continuez votre présentation.",
            "strengths": ["Vous maintenez le cap"],
            "improvements": [{
                "area": "Technique",
                "current_issue": "Analyse en cours",
                "actionable_tip": "Restez naturel et expressif",
                "why_important": "Pour une communication efficace"
            }],
            "encouragement": "Excellent travail, poursuivez !",
            "next_focus": "Maintenir l'engagement"
        }
    
    def _structure_ai_feedback(self, ai_feedback: Dict[str, Any], chunk_metrics: Dict[str, Any]) -> List[FeedbackItem]:
        """Convert AI feedback to structured FeedbackItem objects."""
        feedback_items = []
        
        # Create feedback items from improvements
        improvements = ai_feedback.get("improvements", [])
        for i, improvement in enumerate(improvements[:self.feedback_params["max_feedback_per_chunk"]]):
            feedback_item = FeedbackItem(
                id=str(uuid4()),
                type=FeedbackType.IMPROVEMENT,
                severity=FeedbackSeverity.MEDIUM,
                title=improvement.get("area", "Amélioration"),
                message=improvement.get("actionable_tip", "Conseil d'amélioration"),
                explanation=improvement.get("why_important", ""),
                timestamp=datetime.utcnow(),
                confidence=0.8,  # High confidence for AI-generated feedback
                metadata={
                    "source": "gemini_ai",
                    "current_issue": improvement.get("current_issue", ""),
                    "improvement_priority": i + 1
                }
            )
            feedback_items.append(feedback_item)
        
        # Create positive feedback from strengths
        strengths = ai_feedback.get("strengths", [])
        if strengths:
            strength_feedback = FeedbackItem(
                id=str(uuid4()),
                type=FeedbackType.POSITIVE,
                severity=FeedbackSeverity.LOW,
                title="Points forts identifiés",
                message=f"Excellents points : {', '.join(strengths[:2])}",
                explanation="Continuez à développer ces aspects positifs",
                timestamp=datetime.utcnow(),
                confidence=0.9,
                metadata={
                    "source": "gemini_ai",
                    "strengths": strengths,
                    "encouragement": ai_feedback.get("encouragement", "")
                }
            )
            feedback_items.append(strength_feedback)
        
        return feedback_items
    
    async def _generate_coaching_insights(self, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate coaching insights based on analysis trends."""
        advanced_metrics = analysis_data.get("advanced_metrics", {})
        trend_analysis = analysis_data.get("trend_analysis", {})
        
        insights = {
            "performance_trends": {},
            "coaching_recommendations": [],
            "skill_development": {},
            "session_insights": {}
        }
        
        # Performance trends
        for metric in ["pace", "volume", "clarity"]:
            trend_key = f"{metric}_trend"
            change_key = f"{metric}_change"
            
            if trend_key in trend_analysis:
                insights["performance_trends"][metric] = {
                    "trend": trend_analysis[trend_key],
                    "change": trend_analysis.get(change_key, 0.0),
                    "interpretation": self._interpret_trend(metric, trend_analysis[trend_key])
                }
        
        # Coaching recommendations based on advanced metrics
        confidence_score = advanced_metrics.get("confidence_score", 0.0)
        nervousness_indicators = advanced_metrics.get("nervousness_indicators", {})
        
        if confidence_score < 0.6:
            insights["coaching_recommendations"].append({
                "area": "Confiance",
                "recommendation": "Travaillez sur la posture et la respiration",
                "priority": "high",
                "exercises": ["Exercices de respiration", "Visualisation positive"]
            })
        
        overall_nervousness = nervousness_indicators.get("overall_nervousness", 0.0)
        if overall_nervousness > 0.6:
            insights["coaching_recommendations"].append({
                "area": "Gestion du stress",
                "recommendation": "Techniques de relaxation avant présentation",
                "priority": "medium",
                "exercises": ["Méditation courte", "Étirements", "Répétition mentale"]
            })
        
        return insights
    
    def _interpret_trend(self, metric: str, trend: str) -> str:
        """Interpret metric trends for coaching."""
        interpretations = {
            "pace": {
                "improving": "Votre rythme s'améliore progressivement",
                "declining": "Attention à maintenir un rythme régulier",
                "stable": "Rythme stable, c'est bien !"
            },
            "volume": {
                "improving": "Votre projection vocale s'améliore",
                "declining": "Veillez à maintenir votre niveau vocal",
                "stable": "Volume constant, parfait !"
            },
            "clarity": {
                "improving": "Votre articulation devient plus claire",
                "declining": "Concentrez-vous sur l'articulation",
                "stable": "Clarté maintenue, excellent !"
            }
        }
        
        return interpretations.get(metric, {}).get(trend, "Évolution en cours d'analyse")
    
    def _calculate_session_progress(self, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate session progress indicators."""
        quality_assessment = analysis_data.get("quality_assessment", {})
        session_summary = analysis_data.get("session_summary", {})
        
        return {
            "overall_progress": quality_assessment.get("overall_quality", 0.0),
            "chunks_analyzed": session_summary.get("chunks_processed", 0),
            "duration_seconds": session_summary.get("total_duration", 0.0),
            "words_spoken": session_summary.get("total_words", 0),
            "improvement_rate": self._calculate_improvement_rate(),
            "session_grade": quality_assessment.get("quality_grade", "En cours")
        }
    
    def _calculate_improvement_rate(self) -> float:
        """Calculate improvement rate based on session progression."""
        if len(self.session_context["session_progression"]) < 2:
            return 0.0
        
        recent_scores = self.session_context["session_progression"][-3:]
        if len(recent_scores) >= 2:
            return (recent_scores[-1] - recent_scores[0]) / len(recent_scores)
        
        return 0.0
    
    def _update_session_context(self, analysis_data: Dict[str, Any], feedback_results: Dict[str, Any]):
        """Update session context with new analysis and feedback."""
        self.session_context["total_feedback_generated"] += 1
        
        # Track quality progression
        quality_score = analysis_data.get("quality_assessment", {}).get("overall_quality", 0.0)
        self.session_context["session_progression"].append(quality_score)
        
        # Update feedback themes
        feedback_items = feedback_results.get("feedback_items", [])
        for item in feedback_items:
            theme = item.metadata.get("type", "unknown").value if hasattr(item, 'type') else "general"
            self.session_context["feedback_themes"][theme] = self.session_context["feedback_themes"].get(theme, 0) + 1
        
        # Track strengths and improvement areas
        ai_feedback = feedback_results.get("ai_generated_feedback", {})
        if ai_feedback:
            strengths = ai_feedback.get("strengths", [])
            self.session_context["strengths"].update(strengths)
            
            improvements = ai_feedback.get("improvements", [])
            for improvement in improvements:
                area = improvement.get("area", "")
                if area:
                    self.session_context["improvement_areas"].add(area)
        
        # Store feedback in history
        self.feedback_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "quality_score": quality_score,
            "feedback_count": len(feedback_items),
            "main_themes": list(self.session_context["feedback_themes"].keys())
        })
        
        # Keep history manageable
        if len(self.feedback_history) > 20:
            self.feedback_history = self.feedback_history[-15:]
    
    def _validate_analysis_part(self, analysis_part: ProcessorPart) -> bool:
        """Validate analysis part for feedback generation."""
        return analysis_part.metadata.get("type", "unknown") == "voice_analysis" and analysis_part.text is not None
    
    def _generate_fallback_feedback(self, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback feedback when AI generation fails."""
        chunk_metrics = analysis_data.get("chunk_metrics", {})
        
        fallback_suggestions = []
        
        # Basic rule-based feedback
        pace_wpm = chunk_metrics.get("pace_wpm", 0)
        if pace_wpm > 180:
            fallback_suggestions.append("Ralentissez votre débit de parole")
        elif pace_wpm < 120 and pace_wpm > 0:
            fallback_suggestions.append("Vous pouvez parler un peu plus rapidement")
        
        clarity_score = chunk_metrics.get("clarity_score", 0)
        if clarity_score < 0.7:
            fallback_suggestions.append("Articulez plus distinctement")
        
        return {
            "type": "fallback_feedback",
            "suggestions": fallback_suggestions or ["Continuez, vous vous en sortez bien !"],
            "message": "Feedback automatique - l'IA n'est temporairement pas disponible",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def _generate_fallback_ai_feedback(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback AI feedback when Gemini is unavailable."""
        current_metrics = context["current_metrics"]
        
        # Simple rule-based feedback generation
        strengths = []
        improvements = []
        
        if current_metrics["pace_wpm"] >= 120 and current_metrics["pace_wpm"] <= 180:
            strengths.append("Rythme de parole approprié")
        else:
            improvements.append({
                "area": "Rythme",
                "current_issue": "Débit à ajuster",
                "actionable_tip": "Visez 120-180 mots par minute",
                "why_important": "Pour maintenir l'attention de l'audience"
            })
        
        if current_metrics["volume_consistency"] > 0.7:
            strengths.append("Volume vocal constant")
        else:
            improvements.append({
                "area": "Volume",
                "current_issue": "Inconsistance vocale",
                "actionable_tip": "Maintenez un niveau vocal régulier",
                "why_important": "Pour une écoute confortable"
            })
        
        return {
            "feedback_summary": "Feedback automatique basé sur vos métriques vocales",
            "strengths": strengths or ["Vous progressez bien"],
            "improvements": improvements or [{
                "area": "Général",
                "current_issue": "Analyse en cours",
                "actionable_tip": "Continuez naturellement",
                "why_important": "Pour une présentation fluide"
            }],
            "encouragement": "Continuez vos efforts, vous êtes sur la bonne voie !",
            "next_focus": "Maintenir la régularité"
        } 