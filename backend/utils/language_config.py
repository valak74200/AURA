"""
AURA Language-Specific Configuration

Contains language-specific settings for audio analysis, coaching,
and cultural adaptation for multilingual presentation coaching.
"""

from typing import Dict, Any, List
from dataclasses import dataclass
from models.session import SupportedLanguage


@dataclass
class AudioAnalysisConfig:
    """Audio analysis configuration specific to a language."""
    
    # Speech pace (syllables per second)
    natural_pace_min: float
    natural_pace_max: float
    optimal_pace: float
    
    # Pause characteristics
    pause_threshold: float  # Minimum pause duration in seconds
    natural_pause_frequency: float  # Pauses per minute
    long_pause_threshold: float  # When a pause becomes too long
    
    # Pitch and intonation
    pitch_variance_expected: float  # Expected pitch variation ratio
    monotone_threshold: float  # Below this = monotone warning
    
    # Volume characteristics
    volume_consistency_threshold: float  # Expected volume consistency
    dynamic_range_optimal: float  # Optimal volume range
    
    # Clarity and articulation
    clarity_weight: float  # How much to weight clarity in scoring
    accent_tolerance: float  # Tolerance for non-native accents


@dataclass
class CoachingConfig:
    """Coaching style and cultural context configuration."""
    
    # Coaching approach
    feedback_style: str  # "analytical" | "motivational" | "direct" | "supportive"
    cultural_context: str  # Cultural presentation expectations
    
    # Focus areas by priority
    primary_focus_areas: List[str]
    coaching_philosophy: str
    
    # Message templates
    encouragement_style: str
    correction_approach: str
    
    # Examples and references
    cultural_examples: List[str]
    typical_improvements: List[str]


@dataclass
class LanguageConfiguration:
    """Complete configuration for a specific language."""
    
    language: SupportedLanguage
    display_name: str
    audio_config: AudioAnalysisConfig
    coaching_config: CoachingConfig
    
    # Localized messages
    ui_messages: Dict[str, str]
    feedback_templates: Dict[str, str]
    
    # Cultural adaptation
    presentation_culture: str
    business_context: str


# ===== FRENCH CONFIGURATION =====
FRENCH_AUDIO_CONFIG = AudioAnalysisConfig(
    natural_pace_min=4.0,
    natural_pace_max=5.5,
    optimal_pace=4.7,
    pause_threshold=0.3,
    natural_pause_frequency=8.0,  # pauses per minute
    long_pause_threshold=2.0,
    pitch_variance_expected=0.15,  # French is more monotone
    monotone_threshold=0.08,
    volume_consistency_threshold=0.8,
    dynamic_range_optimal=0.6,
    clarity_weight=0.4,
    accent_tolerance=0.7
)

FRENCH_COACHING_CONFIG = CoachingConfig(
    feedback_style="analytical",
    cultural_context="French academic and business presentation style",
    primary_focus_areas=[
        "structure_logique",
        "elegance_verbale", 
        "precision_linguistique",
        "gestion_du_temps"
    ],
    coaching_philosophy="Privilégier la clarté, la logique et l'élégance du discours",
    encouragement_style="constructif_et_respectueux",
    correction_approach="suggestions_nuancees",
    cultural_examples=[
        "Charles de Gaulle - autorité et gravité",
        "Simone Veil - conviction et émotion maîtrisée",
        "Jacques Chirac - proximité et charisme"
    ],
    typical_improvements=[
        "Structurer davantage votre argumentation",
        "Varier votre intonation pour maintenir l'attention",
        "Utiliser des transitions plus élégantes"
    ]
)

FRENCH_UI_MESSAGES = {
    "volume_good": "Votre volume est approprié",
    "volume_too_low": "Parlez plus fort pour être mieux entendu",
    "volume_too_high": "Diminuez légèrement votre volume",
    "pace_good": "Votre débit est parfait",
    "pace_too_fast": "Ralentissez pour laisser le temps à votre audience de suivre",
    "pace_too_slow": "Accélérez légèrement pour maintenir l'attention",
    "clarity_excellent": "Votre articulation est excellente",
    "clarity_needs_work": "Travaillez votre articulation pour plus de clarté",
    "pause_effective": "Vos pauses sont bien placées",
    "pause_too_frequent": "Réduisez la fréquence de vos pauses",
    "pause_insufficient": "N'hésitez pas à marquer des pauses",
    "excellent_performance": "Performance excellente !",
    "good_progress": "Bons progrès constatés",
    "needs_improvement": "Des améliorations sont possibles",
    "keep_practicing": "Continuez vos efforts !",
    "session_complete": "Session terminée avec succès"
}

FRENCH_FEEDBACK_TEMPLATES = {
    "opening": "Analyse de votre présentation :",
    "technical_feedback": "Aspects techniques :",
    "delivery_feedback": "Style de présentation :",
    "improvement_suggestions": "Suggestions d'amélioration :",
    "encouragement": "Points positifs :",
    "next_steps": "Prochaines étapes :"
}

# ===== ENGLISH CONFIGURATION =====
ENGLISH_AUDIO_CONFIG = AudioAnalysisConfig(
    natural_pace_min=3.0,
    natural_pace_max=4.5,
    optimal_pace=3.7,
    pause_threshold=0.4,  # English speakers use longer pauses
    natural_pause_frequency=6.0,  # fewer but longer pauses
    long_pause_threshold=2.5,
    pitch_variance_expected=0.25,  # English is more varied
    monotone_threshold=0.12,
    volume_consistency_threshold=0.75,  # more variation acceptable
    dynamic_range_optimal=0.8,
    clarity_weight=0.3,  # slightly less weight on perfect clarity
    accent_tolerance=0.8  # more tolerance for accents
)

ENGLISH_COACHING_CONFIG = CoachingConfig(
    feedback_style="motivational",
    cultural_context="Anglo-Saxon presentation and business communication style",
    primary_focus_areas=[
        "audience_engagement",
        "storytelling",
        "confidence_building",
        "call_to_action"
    ],
    coaching_philosophy="Focus on engagement, impact, and authentic connection",
    encouragement_style="direct_and_positive",
    correction_approach="actionable_suggestions",
    cultural_examples=[
        "Steve Jobs - simplicity and impact",
        "Martin Luther King Jr. - passion and rhythm",
        "Winston Churchill - gravitas and determination"
    ],
    typical_improvements=[
        "Increase your vocal variety to maintain engagement",
        "Use more storytelling to connect with your audience",
        "Project more confidence through your delivery"
    ]
)

ENGLISH_UI_MESSAGES = {
    "volume_good": "Your volume level is perfect",
    "volume_too_low": "Speak louder to ensure everyone can hear you",
    "volume_too_high": "Lower your volume slightly",
    "pace_good": "Your speaking pace is excellent",
    "pace_too_fast": "Slow down to give your audience time to follow",
    "pace_too_slow": "Speed up slightly to maintain engagement",
    "clarity_excellent": "Your articulation is crystal clear",
    "clarity_needs_work": "Focus on clearer articulation",
    "pause_effective": "Your pauses are well-timed and effective",
    "pause_too_frequent": "Use fewer pauses for better flow",  
    "pause_insufficient": "Use strategic pauses for greater impact",
    "excellent_performance": "Outstanding performance!",
    "good_progress": "Great progress observed",
    "needs_improvement": "Room for improvement",
    "keep_practicing": "Keep up the great work!",
    "session_complete": "Session completed successfully"
}

ENGLISH_FEEDBACK_TEMPLATES = {
    "opening": "Your presentation analysis:",
    "technical_feedback": "Technical aspects:",
    "delivery_feedback": "Delivery style:",
    "improvement_suggestions": "Improvement recommendations:",
    "encouragement": "Strengths identified:",
    "next_steps": "Next steps:"
}

# ===== LANGUAGE CONFIGURATIONS REGISTRY =====
LANGUAGE_CONFIGURATIONS: Dict[SupportedLanguage, LanguageConfiguration] = {
    SupportedLanguage.FRENCH: LanguageConfiguration(
        language=SupportedLanguage.FRENCH,
        display_name="Français",
        audio_config=FRENCH_AUDIO_CONFIG,
        coaching_config=FRENCH_COACHING_CONFIG,
        ui_messages=FRENCH_UI_MESSAGES,
        feedback_templates=FRENCH_FEEDBACK_TEMPLATES,
        presentation_culture="academic_and_structured",
        business_context="formal_and_hierarchical"
    ),
    
    SupportedLanguage.ENGLISH: LanguageConfiguration(
        language=SupportedLanguage.ENGLISH,
        display_name="English",
        audio_config=ENGLISH_AUDIO_CONFIG,
        coaching_config=ENGLISH_COACHING_CONFIG,
        ui_messages=ENGLISH_UI_MESSAGES,
        feedback_templates=ENGLISH_FEEDBACK_TEMPLATES,
        presentation_culture="engaging_and_storytelling",
        business_context="direct_and_results_oriented"
    )
}


def get_language_config(language: SupportedLanguage) -> LanguageConfiguration:
    """Get complete configuration for a language."""
    return LANGUAGE_CONFIGURATIONS[language]


def get_audio_config(language: SupportedLanguage) -> AudioAnalysisConfig:
    """Get audio analysis configuration for a language."""
    return LANGUAGE_CONFIGURATIONS[language].audio_config


def get_coaching_config(language: SupportedLanguage) -> CoachingConfig:
    """Get coaching configuration for a language."""
    return LANGUAGE_CONFIGURATIONS[language].coaching_config


def get_ui_message(key: str, language: SupportedLanguage, default: str = None) -> str:
    """Get localized UI message."""
    config = LANGUAGE_CONFIGURATIONS[language]
    return config.ui_messages.get(key, default or key)


def get_feedback_template(key: str, language: SupportedLanguage) -> str:
    """Get localized feedback template."""
    config = LANGUAGE_CONFIGURATIONS[language]
    return config.feedback_templates.get(key, key)


def get_supported_languages() -> List[Dict[str, str]]:
    """Get list of supported languages with display names."""
    return [
        {
            "code": lang.value,
            "name": config.display_name,
            "culture": config.presentation_culture
        }
        for lang, config in LANGUAGE_CONFIGURATIONS.items()
    ]