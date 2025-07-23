"""
AURA WebSocket Handlers

Real-time WebSocket communication for presentation coaching with complete
AuraPipeline integration for audio processing, AI feedback, and performance metrics.
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
import base64

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.routing import APIRoute

from models.session import PresentationSessionData, SessionConfig, SessionStatus, SessionType
from models.feedback import RealTimeFeedback, FeedbackType, FeedbackSeverity
from utils.logging import get_logger
from utils.exceptions import WebSocketException, AudioProcessingException
from utils.audio_utils import AudioBuffer
from processors.aura_pipeline import AuraPipeline
from genai_processors import ProcessorPart
from genai_processors import streams

logger = get_logger(__name__)


def create_websocket_router(services: Dict[str, Any]) -> APIRouter:
    """
    Create WebSocket router with service dependencies.
    
    Args:
        services: Dictionary containing initialized services
        
    Returns:
        APIRouter: Configured WebSocket router
    """
    router = APIRouter()
    
    # Connection manager for WebSocket sessions
    connection_manager = ConnectionManager(services)
    
    @router.websocket("/session/{session_id}")
    async def websocket_session_endpoint(
        websocket: WebSocket,
        session_id: str,
        user_id: Optional[str] = Query(None),
        session_type: Optional[str] = Query("practice")
    ):
        """
        Main WebSocket endpoint for real-time presentation coaching.
        
        Handles:
        - Real-time audio streaming and processing
        - AI feedback generation with Gemini
        - Performance metrics and analytics
        - Session management and progress tracking
        """
        session_uuid = uuid.UUID(session_id)
        
        try:
            # Accept WebSocket connection
            await websocket.accept()
            logger.info(f"WebSocket connection established for session {session_id}")
            
            # Initialize or retrieve session
            session = await connection_manager.get_or_create_session(
                session_uuid, user_id, SessionType(session_type)
            )
            
            # Register connection
            await connection_manager.connect(websocket, session_uuid)
            
            # Initialize AURA pipeline for this session
            pipeline = AuraPipeline(session)
            
            # Send welcome message
            await websocket.send_json({
                "type": "session_initialized",
                "session_id": session_id,
                "message": "Session AURA initialisée avec succès !",
                "pipeline_ready": True,
                "processors": ["AnalysisProcessor", "FeedbackProcessor", "MetricsProcessor"],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Start processing loop
            await connection_manager.handle_session_communication(
                websocket, session_uuid, pipeline
            )
            
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for session {session_id}")
            await connection_manager.disconnect(websocket, session_uuid)
            
        except Exception as e:
            logger.error(f"WebSocket error for session {session_id}: {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "error": str(e),
                    "session_id": session_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
            except:
                pass  # Connection might be closed
            finally:
                await connection_manager.disconnect(websocket, session_uuid)
    
    @router.websocket("/test")
    async def websocket_test_endpoint(websocket: WebSocket):
        """Test WebSocket endpoint for debugging."""
        await websocket.accept()
        try:
            await websocket.send_json({
                "type": "test_response",
                "message": "WebSocket test successful",
                "services_available": list(services.keys()),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Echo messages for testing
            while True:
                data = await websocket.receive_json()
                await websocket.send_json({
                    "type": "echo",
                    "received": data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        except WebSocketDisconnect:
            logger.info("Test WebSocket disconnected")
    
    return router


class ConnectionManager:
    """
    Manages WebSocket connections and session communication with complete
    AuraPipeline integration for real-time coaching.
    """
    
    def __init__(self, services: Dict[str, Any]):
        """Initialize connection manager with services."""
        self.services = services
        self.active_connections: Dict[uuid.UUID, WebSocket] = {}
        self.session_pipelines: Dict[uuid.UUID, AuraPipeline] = {}
        self.audio_buffers: Dict[uuid.UUID, AudioBuffer] = {}
        self.session_stats: Dict[uuid.UUID, Dict[str, Any]] = {}
        
        # Connection management settings
        self.heartbeat_interval = 30  # seconds
        self.max_message_size = 1024 * 1024  # 1MB
        self.audio_chunk_timeout = 5.0  # seconds
        
        logger.info("ConnectionManager initialized with complete pipeline integration")
    
    async def connect(self, websocket: WebSocket, session_id: uuid.UUID):
        """Register a new WebSocket connection."""
        self.active_connections[session_id] = websocket
        
        # Initialize audio buffer for real-time streaming
        self.audio_buffers[session_id] = AudioBuffer(
            sample_rate=16000,
            chunk_size=1600,  # 100ms at 16kHz
            max_buffer_seconds=10.0
        )
        
        # Initialize session stats
        self.session_stats[session_id] = {
            "connected_at": datetime.utcnow(),
            "messages_received": 0,
            "audio_chunks_processed": 0,
            "feedback_items_sent": 0,
            "errors_count": 0
        }
        
        logger.info(f"WebSocket connected and initialized for session {session_id}")
    
    async def disconnect(self, websocket: WebSocket, session_id: uuid.UUID):
        """Cleanup connection and resources."""
        try:
            # Remove connection
            if session_id in self.active_connections:
                del self.active_connections[session_id]
            
            # Cleanup pipeline
            if session_id in self.session_pipelines:
                pipeline = self.session_pipelines[session_id]
                # Get final session summary
                try:
                    final_summary = await pipeline.get_session_summary()
                    logger.info(f"Session {session_id} final summary: {final_summary}")
                except Exception as e:
                    logger.error(f"Error getting final summary for session {session_id}: {e}")
                
                del self.session_pipelines[session_id]
            
            # Cleanup audio buffer
            if session_id in self.audio_buffers:
                self.audio_buffers[session_id].clear()
                del self.audio_buffers[session_id]
            
            # Log final stats
            if session_id in self.session_stats:
                stats = self.session_stats[session_id]
                session_duration = (datetime.utcnow() - stats["connected_at"]).total_seconds()
                logger.info(
                    f"Session {session_id} disconnected",
                    extra={
                        "duration_seconds": session_duration,
                        "messages_received": stats["messages_received"],
                        "audio_chunks_processed": stats["audio_chunks_processed"],
                        "feedback_items_sent": stats["feedback_items_sent"],
                        "errors_count": stats["errors_count"]
                    }
                )
                del self.session_stats[session_id]
            
        except Exception as e:
            logger.error(f"Error during disconnect cleanup for session {session_id}: {e}")
    
    async def get_or_create_session(
        self, 
        session_id: uuid.UUID, 
        user_id: Optional[str], 
        session_type: SessionType
    ) -> PresentationSessionData:
        """Get existing session or create new one."""
        storage_service = self.services['storage']
        
        try:
            # Try to get existing session
            session = await storage_service.get_session(session_id)
            if session:
                logger.info(f"Retrieved existing session {session_id}")
                return session
        except Exception as e:
            logger.debug(f"Session {session_id} not found, creating new one: {e}")
        
        # Create new session
        session_config = SessionConfig(
            session_type=session_type,
            language="fr",
            feedback_frequency=3,
            real_time_feedback=True,
            detailed_analysis=True,
            ai_coaching=True
        )
        
        session = await storage_service.create_session(
            user_id=user_id or "anonymous",
            config=session_config,
            session_id=session_id
        )
        
        logger.info(f"Created new session {session_id} for user {user_id}")
        return session
    
    async def handle_session_communication(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        pipeline: AuraPipeline
    ):
        """
        Handle complete session communication with real-time audio processing.
        """
        self.session_pipelines[session_id] = pipeline
        
        try:
            # Start heartbeat task
            heartbeat_task = asyncio.create_task(
                self._heartbeat_loop(websocket, session_id)
            )
            
            # Main message handling loop
            while True:
                try:
                    # Receive message with timeout
                    message = await asyncio.wait_for(
                        websocket.receive_json(),
                        timeout=self.audio_chunk_timeout
                    )
                    
                    # Update stats
                    self.session_stats[session_id]["messages_received"] += 1
                    
                    # Process message based on type
                    message_type = message.get("type")
                    
                    if message_type == "audio_chunk":
                        await self._handle_audio_chunk(websocket, session_id, message, pipeline)
                    elif message_type == "control_command":
                        await self._handle_control_command(websocket, session_id, message, pipeline)
                    elif message_type == "config_update":
                        await self._handle_config_update(websocket, session_id, message, pipeline)
                    elif message_type == "heartbeat":
                        await self._handle_heartbeat(websocket, session_id, message)
                    elif message_type == "request_summary":
                        await self._handle_summary_request(websocket, session_id, pipeline)
                    else:
                        logger.warning(f"Unknown message type: {message_type}")
                        await websocket.send_json({
                            "type": "error",
                            "error": f"Unknown message type: {message_type}",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                
                except asyncio.TimeoutError:
                    # No message received within timeout, continue
                    continue
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected for session {session_id}")
                    break
                except Exception as e:
                    logger.error(f"Error handling message for session {session_id}: {e}")
                    self.session_stats[session_id]["errors_count"] += 1
                    
                    # Send error response
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "error": str(e),
                            "session_id": str(session_id),
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except:
                        break  # Connection is broken
        
        finally:
            # Cleanup
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
    
    async def _handle_audio_chunk(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any], 
        pipeline: AuraPipeline
    ):
        """Handle real-time audio chunk processing through the complete pipeline."""
        try:
            # Extract audio data
            audio_data = message.get("audio_data")
            if not audio_data:
                raise AudioProcessingException("No audio data provided")
            
            # Decode base64 audio data
            try:
                audio_bytes = base64.b64decode(audio_data)
            except Exception as e:
                raise AudioProcessingException(f"Invalid audio data encoding: {e}")
            
            # Add to audio buffer
            audio_buffer = self.audio_buffers[session_id]
            success = audio_buffer.add_chunk(
                audio_bytes, 
                source_sample_rate=message.get("sample_rate", 16000)
            )
            
            if not success:
                logger.warning(f"Audio buffer full for session {session_id}")
                return
            
            # Get processed audio chunk
            audio_array = audio_buffer.get_chunk()
            if audio_array is None:
                return  # Not enough data yet
            
            # Create ProcessorPart for pipeline
            audio_part = ProcessorPart(
                audio_array,
                type="audio_chunk",
                metadata={
                    "session_id": str(session_id),
                    "timestamp": datetime.utcnow().isoformat(),
                    "sample_rate": 16000,
                    "chunk_duration_ms": len(audio_array) / 16000 * 1000,
                    "client_timestamp": message.get("timestamp"),
                    "sequence_number": message.get("sequence_number", 0)
                }
            )
            
            # Process through complete AURA pipeline
            async for result_part in pipeline.process(streams.stream_content([audio_part])):
                await self._send_pipeline_result(websocket, session_id, result_part)
            
            # Update stats
            self.session_stats[session_id]["audio_chunks_processed"] += 1
            
        except Exception as e:
            logger.error(f"Error processing audio chunk for session {session_id}: {e}")
            await websocket.send_json({
                "type": "audio_processing_error",
                "error": str(e),
                "session_id": str(session_id),
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _send_pipeline_result(self, websocket: WebSocket, session_id: str, result_part):
        """Send pipeline processing results to WebSocket client."""
        try:
            result_type = result_part.metadata.get("type", "unknown")
            result_data = result_part.text if hasattr(result_part, 'text') else str(result_part.part)
            
            if result_type == "coaching_result":
                await websocket.send_json({
                    "type": "coaching_feedback",
                    "session_id": session_id,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
            elif result_type == "realtime_feedback":
                await websocket.send_json({
                    "type": "realtime_suggestion",
                    "session_id": session_id,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
            elif result_type == "performance_update":
                await websocket.send_json({
                    "type": "performance_metrics",
                    "session_id": session_id,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
            elif result_type == "milestone_achieved":
                await websocket.send_json({
                    "type": "milestone",
                    "session_id": session_id,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
            elif result_type == "error_result":
                await websocket.send_json({
                    "type": "processing_error",
                    "session_id": session_id,
                    "error": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
            else:
                # Generic result
                await websocket.send_json({
                    "type": "analysis_result",
                    "session_id": session_id,
                    "result_type": result_type,
                    "data": result_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Failed to send pipeline result: {e}")
            await websocket.send_json({
                "type": "processing_error",
                "session_id": session_id,
                "error": f"Failed to send result: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _handle_control_command(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any], 
        pipeline: AuraPipeline
    ):
        """Handle session control commands."""
        command = message.get("command")
        
        try:
            if command == "start_session":
                # Start session processing
                await websocket.send_json({
                    "type": "session_started",
                    "session_id": str(session_id),
                    "message": "Session de coaching démarrée",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif command == "pause_session":
                # Pause processing
                await websocket.send_json({
                    "type": "session_paused",
                    "session_id": str(session_id),
                    "message": "Session mise en pause",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif command == "resume_session":
                # Resume processing
                await websocket.send_json({
                    "type": "session_resumed",
                    "session_id": str(session_id),
                    "message": "Session reprise",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif command == "end_session":
                # End session and get final summary
                final_summary = await pipeline.get_session_summary()
                await websocket.send_json({
                    "type": "session_ended",
                    "session_id": str(session_id),
                    "message": "Session terminée avec succès",
                    "final_summary": final_summary,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            else:
                await websocket.send_json({
                    "type": "error",
                    "error": f"Unknown command: {command}",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error handling control command {command} for session {session_id}: {e}")
            await websocket.send_json({
                "type": "control_error",
                "error": str(e),
                "command": command,
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _handle_config_update(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any], 
        pipeline: AuraPipeline
    ):
        """Handle session configuration updates."""
        try:
            config_updates = message.get("config", {})
            
            # Update pipeline configuration if needed
            if "enable_parallel_processing" in config_updates:
                pipeline.pipeline_config["enable_parallel_processing"] = config_updates["enable_parallel_processing"]
            
            if "feedback_frequency" in config_updates:
                pipeline.pipeline_config["metrics_calculation_interval"] = config_updates["feedback_frequency"]
            
            await websocket.send_json({
                "type": "config_updated",
                "session_id": str(session_id),
                "message": "Configuration mise à jour",
                "updated_config": config_updates,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error updating config for session {session_id}: {e}")
            await websocket.send_json({
                "type": "config_error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _handle_heartbeat(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        message: Dict[str, Any]
    ):
        """Handle heartbeat messages."""
        await websocket.send_json({
            "type": "heartbeat_response",
            "session_id": str(session_id),
            "server_timestamp": datetime.utcnow().isoformat(),
            "client_timestamp": message.get("timestamp"),
            "stats": self.session_stats[session_id]
        })
    
    async def _handle_summary_request(
        self, 
        websocket: WebSocket, 
        session_id: uuid.UUID, 
        pipeline: AuraPipeline
    ):
        """Handle request for session summary."""
        try:
            summary = await pipeline.get_session_summary()
            await websocket.send_json({
                "type": "session_summary",
                "session_id": str(session_id),
                "summary": summary,
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Error generating summary for session {session_id}: {e}")
            await websocket.send_json({
                "type": "summary_error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def _heartbeat_loop(self, websocket: WebSocket, session_id: uuid.UUID):
        """Maintain connection with periodic heartbeats."""
        try:
            while True:
                await asyncio.sleep(self.heartbeat_interval)
                
                if session_id not in self.active_connections:
                    break
                
                try:
                    await websocket.send_json({
                        "type": "heartbeat",
                        "session_id": str(session_id),
                        "timestamp": datetime.utcnow().isoformat(),
                        "stats": self.session_stats[session_id]
                    })
                except:
                    # Connection is broken
                    break
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Heartbeat error for session {session_id}: {e}")
    
    async def broadcast_to_session(self, session_id: uuid.UUID, message: Dict[str, Any]):
        """Broadcast message to specific session."""
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to session {session_id}: {e}")
                # Remove broken connection
                await self.disconnect(websocket, session_id)
    
    def get_active_sessions(self) -> List[uuid.UUID]:
        """Get list of active session IDs."""
        return list(self.active_connections.keys())
    
    def get_session_stats(self, session_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get statistics for a specific session."""
        return self.session_stats.get(session_id) 