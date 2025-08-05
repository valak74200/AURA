import base64
from typing import Any, Dict, Optional

import aiohttp
import httpx

from backend.app.config import settings


class DidAgentsError(Exception):
    """Erreur d'intégration D-ID Agents Streams."""
    pass


class DidAgentsService:
    """
    Client D-ID Agents Streams (REST + Realtime WS).
    - REST: création/lecture/suppression d'agent, upload knowledge (texte)
    - WS: ouverture d'un websocket de stream pour un agent (texte/audio/événements)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        ws_base: Optional[str] = None,
        defaults: Optional[Dict[str, Any]] = None,
    ):
        self.api_key = (api_key or settings.did_agents_api_key or settings.did_api_key)
        if not self.api_key:
            raise DidAgentsError("DID_AGENTS_API_KEY/DID_API_KEY non configurée")

        # REST
        self.api_base = (api_base or settings.did_agents_api_base or "https://api.d-id.com").rstrip("/")

        # WS
        self.ws_base = ws_base or settings.did_agents_ws_base  # optionnel; sinon résolution dynamique
        # Basic token (username=clé, mdp vide)
        self._basic_token = base64.b64encode(self.api_key.encode("utf-8")).decode("utf-8")

        # Defaults (conversation mode, creativity, model, voice, knowledge)
        self.defaults = defaults or {
            "conversation_mode": settings.agent_conversation_mode,
            "creativity_level": float(settings.agent_creativity_level),
            "llm_model": settings.agent_llm_model,
            "voice_id": settings.agent_voice_id,
            "default_knowledge": settings.agent_default_knowledge or "",
        }

        # HTTP client
        self._http = httpx.AsyncClient(
            base_url=self.api_base,
            headers={
                "Authorization": f"Basic {self._basic_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    async def close(self):
        try:
            await self._http.aclose()
        except Exception:
            pass

    # ------------- REST -------------

    async def create_agent(
        self,
        name: str,
        conversation_mode: Optional[str] = None,
        creativity_level: Optional[float] = None,
        llm_model: Optional[str] = None,
        voice_id: Optional[str] = None,
        knowledge_text: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Crée un agent D-ID (Streams). Payload générique, à ajuster selon doc.
        """
        payload: Dict[str, Any] = {
            "name": name,
            "conversation_mode": conversation_mode or self.defaults["conversation_mode"],
            "creativity_level": float(creativity_level if creativity_level is not None else self.defaults["creativity_level"]),
            "llm": llm_model or self.defaults["llm_model"],
            "voice": voice_id or self.defaults["voice_id"],
        }
        if knowledge_text or self.defaults["default_knowledge"]:
            payload["knowledge"] = (knowledge_text or self.defaults["default_knowledge"])

        if extra:
            payload.update(extra)

        # NOTE: endpoint à confirmer selon la doc Agents (placeholder plausible)
        # Ex: POST /v1/agents
        resp = await self._http.post("/v1/agents", json=payload)
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"error": resp.text}
            raise DidAgentsError(f"create_agent failed: HTTP {resp.status_code} {data}")
        return resp.json()

    async def get_agent(self, agent_id: str) -> Dict[str, Any]:
        resp = await self._http.get(f"/v1/agents/{agent_id}")
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"error": resp.text}
            raise DidAgentsError(f"get_agent failed: HTTP {resp.status_code} {data}")
        return resp.json()

    async def delete_agent(self, agent_id: str) -> Dict[str, Any]:
        resp = await self._http.delete(f"/v1/agents/{agent_id}")
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"error": resp.text}
            raise DidAgentsError(f"delete_agent failed: HTTP {resp.status_code} {data}")
        return {"ok": True, "agent_id": agent_id}

    async def append_knowledge(self, agent_id: str, text: str) -> Dict[str, Any]:
        """
        Ajoute du knowledge texte à un agent.
        """
        payload = {"text": text}
        # NOTE: endpoint placeholder; à ajuster selon doc (ex: /v1/agents/{id}/knowledge)
        resp = await self._http.post(f"/v1/agents/{agent_id}/knowledge", json=payload)
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"error": resp.text}
            raise DidAgentsError(f"append_knowledge failed: HTTP {resp.status_code} {data}")
        return resp.json()

    # ------------- WS --------------

    async def resolve_ws_url(self, agent_id: str) -> str:
        """
        Résout l'URL WS pour l'agent.
        Priorité:
          1) settings.did_agents_ws_base
          2) champ dans get_agent: wsUrl/websocket_url/streams_url
          3) fallback pattern
        """
        if self.ws_base:
            base = self.ws_base.rstrip("/")
            return f"{base}/v1/agents/{agent_id}/streams"

        try:
            info = await self.get_agent(agent_id)
            ws_url = info.get("wsUrl") or info.get("websocket_url") or info.get("streams_url")
            if ws_url:
                return ws_url
        except Exception:
            pass

        # Fallback
        return f"wss://realtime.api.d-id.com/v1/agents/{agent_id}/streams"

    async def open_agent_ws(self, agent_id: str) -> aiohttp.ClientWebSocketResponse:
        """
        Ouvre un WS de stream pour un agent.
        Auth: Basic {api_key}
        """
        url = await self.resolve_ws_url(agent_id)
        headers = {
            "Authorization": f"Basic {self._basic_token}",
            "Accept": "application/json",
        }
        session = aiohttp.ClientSession(headers=headers)
        try:
            ws = await session.ws_connect(url, heartbeat=30)
        except Exception as e:
            await session.close()
            raise DidAgentsError(f"Failed to open Agents WS: {e}")

        setattr(ws, "_agents_http_session", session)
        return ws


# Singleton simple
did_agents_service = DidAgentsService()