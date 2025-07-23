"""
AURA Gemini Service

Service for integrating with Google's Gemini API for
advanced AI-powered feedback generation and analysis.
"""

import asyncio
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import google.generativeai as genai
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log
)
import json

from app.config import get_settings, Settings
from utils.logging import get_logger
from utils.exceptions import (
    AIModelException,
    AIModelUnavailableError,
    AIModelQuotaExceededError
)

settings = get_settings()
logger = get_logger(__name__)


class GeminiService:
    """Service for interacting with Google's Gemini API with 2.5 models support."""

    def __init__(self, config: Settings):
        self.config = config
        genai.configure(api_key=config.gemini_api_key)
        
        self.client = genai.GenerativeModel(
            model_name=config.default_gemini_model,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=2048,
                top_p=0.95,
                top_k=40,
            ),
            safety_settings=self._get_safety_settings(),
        )
        
        # Model pour les tâches de réflexion complexe (quand disponible)
        self.thinking_client = genai.GenerativeModel(
            model_name=config.gemini_thinking_model,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,  # Plus déterministe pour l'analyse
                max_output_tokens=4096,
                top_p=0.9,
                top_k=20,
            ),
            safety_settings=self._get_safety_settings(),
        )
        
        # Model Pro pour les analyses les plus complexes
        self.pro_client = genai.GenerativeModel(
            model_name=config.gemini_pro_model,
            generation_config=genai.types.GenerationConfig(
                temperature=0.5,
                max_output_tokens=8192,
                top_p=0.95,
                top_k=40,
            ),
            safety_settings=self._get_safety_settings(),
        )
        
        logger.info(f"GeminiService initialized with model: {config.default_gemini_model}")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((AIModelException,)),
        before_sleep=before_sleep_log(logger, 30)  # WARNING level = 30
    )
    async def generate_presentation_feedback(
        self,
        voice_metrics: Dict[str, Any],
        transcript: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate presentation feedback using Gemini.
        
        Args:
            voice_metrics: Voice analysis metrics
            transcript: Optional speech transcript
            context: Additional context about the presentation
            
        Returns:
            List of feedback items
        """
        try:
            # Build comprehensive prompt
            prompt = self._build_feedback_prompt(voice_metrics, transcript, context)
            
            # Generate feedback
            response = await asyncio.to_thread(
                self.client.generate_content,
                prompt
            )
            
            # Parse and validate response
            feedback_items = self._parse_feedback_response(response.text)
            
            logger.info(
                "Generated presentation feedback",
                extra={
                    "feedback_count": len(feedback_items),
                    "has_transcript": transcript is not None
                }
            )
            
            return feedback_items
            
        except genai.types.BlockedPromptException as e:
            logger.warning(f"Prompt was blocked by safety filters: {e}")
            raise AIModelException("Content was blocked by safety filters", settings.default_gemini_model)
        except genai.types.StopCandidateException as e:
            logger.warning(f"Generation stopped due to safety: {e}")
            raise AIModelException("Generation stopped due to safety concerns", settings.default_gemini_model)
        except (ConnectionError, TimeoutError) as e:
            logger.error(f"Network error with Gemini API: {e}")
            raise AIModelUnavailableError(settings.default_gemini_model)
        except ValueError as e:
            if "quota" in str(e).lower() or "429" in str(e):
                raise AIModelQuotaExceededError(settings.default_gemini_model)
            elif "api key" in str(e).lower():
                raise AIModelException("Invalid API key", settings.default_gemini_model)
            else:
                raise AIModelException(f"Invalid request: {e}", settings.default_gemini_model)
        except Exception as e:
            logger.error(f"Unexpected Gemini API error: {e}", exc_info=True)
            raise AIModelException(f"Unexpected error: {e}", settings.default_gemini_model)
    
    async def analyze_presentation_structure(
        self,
        transcript: str,
        duration: float
    ) -> Dict[str, Any]:
        """
        Analyze presentation structure and content.
        
        Args:
            transcript: Speech transcript
            duration: Presentation duration in seconds
            
        Returns:
            Structure analysis results
        """
        try:
            prompt = f"""
            Analyze the following presentation transcript for structure and content quality:
            
            Transcript:
            {transcript}
            
            Duration: {duration:.1f} seconds
            
            Provide analysis in JSON format with:
            1. structure_score (0-100): How well structured the presentation is
            2. key_points: List of main points identified
            3. transitions: Quality of transitions between topics (poor/fair/good/excellent)
            4. introduction_quality: Quality of introduction (0-100)
            5. conclusion_quality: Quality of conclusion (0-100)
            6. clarity_score (0-100): How clear the message is
            7. suggestions: List of specific improvements for structure
            
            Return only valid JSON.
            """
            
            response = await asyncio.to_thread(
                self.client.generate_content,
                prompt,
                generation_config=self.config.generation_config
            )
            
            # Parse response
            analysis = self._parse_json_response(response.text)
            
            return analysis
            
        except Exception as e:
            logger.error(
                "Failed to analyze presentation structure",
                extra={"error": str(e)},
                exc_info=True
            )
            raise AIModelException(str(e), settings.default_gemini_model)
    
    async def generate_improvement_plan(
        self,
        session_feedback: List[Dict[str, Any]],
        user_goals: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate personalized improvement plan.
        
        Args:
            session_feedback: Feedback from the session
            user_goals: Optional user-specified goals
            
        Returns:
            Improvement plan with actionable steps
        """
        try:
            # Summarize feedback
            feedback_summary = self._summarize_feedback(session_feedback)
            
            prompt = f"""
            Based on the following presentation feedback, create a personalized improvement plan:
            
            Feedback Summary:
            {json.dumps(feedback_summary, indent=2)}
            
            User Goals: {', '.join(user_goals) if user_goals else 'General presentation improvement'}
            
            Create an improvement plan with:
            1. priority_areas: Top 3 areas to focus on
            2. weekly_exercises: Specific exercises for each week (4 weeks)
            3. daily_tips: Quick daily practice tips
            4. milestones: Measurable milestones to track progress
            5. resources: Recommended resources (books, videos, courses)
            
            Make the plan specific, actionable, and achievable.
            Return as valid JSON.
            """
            
            response = await asyncio.to_thread(
                self.client.generate_content,
                prompt,
                generation_config=self.config.generation_config
            )
            
            plan = self._parse_json_response(response.text)
            
            logger.info("Generated improvement plan", extra={"areas": len(plan.get("priority_areas", []))})
            
            return plan
            
        except Exception as e:
            logger.error(
                "Failed to generate improvement plan",
                extra={"error": str(e)},
                exc_info=True
            )
            raise AIModelException(str(e), settings.default_gemini_model)
    
    async def compare_sessions(
        self,
        current_metrics: Dict[str, Any],
        previous_metrics: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Compare current session with previous sessions.
        
        Args:
            current_metrics: Metrics from current session
            previous_metrics: List of metrics from previous sessions
            
        Returns:
            Comparison analysis with trends and insights
        """
        try:
            prompt = f"""
            Compare the current presentation session with previous sessions:
            
            Current Session:
            {json.dumps(current_metrics, indent=2)}
            
            Previous Sessions (most recent first):
            {json.dumps(previous_metrics[:5], indent=2)}
            
            Provide comparison analysis with:
            1. overall_trend: improving/stable/declining
            2. improvement_rate: percentage improvement (can be negative)
            3. strongest_improvements: List of areas with most improvement
            4. areas_needing_attention: Areas that are declining or not improving
            5. consistency_score (0-100): How consistent the performance is
            6. insights: List of specific insights about the progression
            7. next_focus: What to focus on in the next session
            
            Return as valid JSON.
            """
            
            response = await asyncio.to_thread(
                self.client.generate_content,
                prompt,
                generation_config=self.config.generation_config
            )
            
            comparison = self._parse_json_response(response.text)
            
            return comparison
            
        except Exception as e:
            logger.error(
                "Failed to compare sessions",
                extra={"error": str(e)},
                exc_info=True
            )
            raise AIModelException(str(e), settings.default_gemini_model)
    
    async def extract_key_phrases(
        self,
        transcript: str,
        max_phrases: int = 10
    ) -> List[str]:
        """
        Extract key phrases from transcript.
        
        Args:
            transcript: Speech transcript
            max_phrases: Maximum number of phrases to extract
            
        Returns:
            List of key phrases
        """
        try:
            prompt = f"""
            Extract the {max_phrases} most important key phrases from this presentation transcript:
            
            {transcript}
            
            Return as a JSON array of strings, focusing on:
            - Main topics and concepts
            - Important terminology
            - Memorable phrases
            - Key takeaways
            
            Return only the JSON array.
            """
            
            response = await asyncio.to_thread(
                self.client.generate_content,
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,  # Lower temperature for extraction
                    max_output_tokens=500
                )
            )
            
            # Parse response
            phrases = self._parse_json_response(response.text)
            
            if isinstance(phrases, list):
                return phrases[:max_phrases]
            
            return []
            
        except Exception as e:
            logger.error(
                "Failed to extract key phrases",
                extra={"error": str(e)},
                exc_info=True
            )
            return []
    
    def _build_feedback_prompt(
        self,
        voice_metrics: Dict[str, Any],
        transcript: Optional[str],
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Build comprehensive feedback prompt."""
        prompt_parts = [
            "As an expert presentation coach, analyze the following data and provide specific, actionable feedback:",
            "",
            "Voice Metrics:",
            json.dumps(voice_metrics, indent=2)
        ]
        
        if transcript:
            prompt_parts.extend([
                "",
                "Speech Transcript (excerpt):",
                transcript[:1000] + "..." if len(transcript) > 1000 else transcript
            ])
        
        if context:
            prompt_parts.extend([
                "",
                "Presentation Context:",
                json.dumps(context, indent=2)
            ])
        
        prompt_parts.extend([
            "",
            "Provide 3-5 specific feedback items focusing on:",
            "1. Most critical issues affecting presentation quality",
            "2. Quick improvements that can be implemented immediately",
            "3. Long-term development areas",
            "",
            "Format each feedback item as JSON with:",
            "- type: category of feedback (pace/volume/clarity/structure/engagement)",
            "- severity: importance level (info/warning/critical)",
            "- message: brief description (max 100 characters)",
            "- suggestion: specific actionable advice (max 200 characters)",
            "- confidence: your confidence in this feedback (0.0-1.0)",
            "- reasoning: brief explanation of why this matters",
            "",
            "Return only a JSON array of feedback items."
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_feedback_response(self, response_text: str) -> List[Dict[str, Any]]:
        """Parse feedback response from Gemini."""
        try:
            # Clean response
            response_text = response_text.strip()
            
            # Find JSON array
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_text = response_text[start_idx:end_idx]
                feedback_items = json.loads(json_text)
                
                # Validate feedback items
                validated_items = []
                for item in feedback_items:
                    if self._validate_feedback_item(item):
                        validated_items.append(item)
                
                return validated_items
            
            return []
            
        except Exception as e:
            logger.warning(f"Failed to parse feedback response: {e}")
            return []
    
    def _parse_json_response(self, response_text: str) -> Union[Dict, List]:
        """Parse JSON response from Gemini."""
        try:
            # Clean response
            response_text = response_text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1])
            
            # Find JSON object or array
            for start_char in ['{', '[']:
                start_idx = response_text.find(start_char)
                if start_idx >= 0:
                    end_char = '}' if start_char == '{' else ']'
                    end_idx = response_text.rfind(end_char) + 1
                    
                    if end_idx > start_idx:
                        json_text = response_text[start_idx:end_idx]
                        return json.loads(json_text)
            
            # Try parsing entire response
            return json.loads(response_text)
            
        except Exception as e:
            logger.warning(f"Failed to parse JSON response: {e}")
            return {} if response_text.strip().startswith('{') else []
    
    def _validate_feedback_item(self, item: Dict[str, Any]) -> bool:
        """Validate feedback item structure."""
        required_fields = ["type", "severity", "message", "suggestion"]
        
        for field in required_fields:
            if field not in item:
                return False
        
        # Validate severity
        valid_severities = ["info", "warning", "critical"]
        if item["severity"] not in valid_severities:
            return False
        
        # Validate confidence if present
        if "confidence" in item:
            try:
                confidence = float(item["confidence"])
                if not 0 <= confidence <= 1:
                    return False
            except (ValueError, TypeError):
                return False
        
        return True
    
    def _summarize_feedback(self, feedback_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarize feedback for improvement plan generation."""
        summary = {
            "total_items": len(feedback_items),
            "by_severity": {},
            "by_type": {},
            "key_issues": []
        }
        
        # Count by severity
        for item in feedback_items:
            severity = item.get("severity", "info")
            summary["by_severity"][severity] = summary["by_severity"].get(severity, 0) + 1
            
            # Count by type
            feedback_type = item.get("type", "other")
            summary["by_type"][feedback_type] = summary["by_type"].get(feedback_type, 0) + 1
            
            # Collect critical issues
            if severity == "critical":
                summary["key_issues"].append({
                    "type": feedback_type,
                    "message": item.get("message", ""),
                    "suggestion": item.get("suggestion", "")
                })
        
        return summary

    def _get_safety_settings(self):
        """Configure safety settings for Gemini API."""
        return [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]


def create_gemini_service(config: Optional[Settings] = None) -> GeminiService:
    """Create a new Gemini service instance."""
    if config is None:
        config = get_settings()
    return GeminiService(config) 