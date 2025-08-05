import base64
from typing import Any, Dict, Optional

import aiohttp
import httpx

from backend.app.config import settings


class DidServiceError(Exception):
    """Erreur d'intégration D-ID."""
    pass


class DidService:
    """
    Intégration D-ID (REST + Realtime WS).

    Responsabilités:
      - REST: création/lecture/suppression de session avatar
      - WS: ouverture d'un websocket Realtime vers D-ID (retourne l'objet client aiohttp)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        realtime_ws_url: Optional[str] = None,
        default_avatar_id: Optional[str] = None,
        default_resolution: Optional[str] = None,
        default_backdrop: Optional[str] = None,
    ):
        self.api_key = api_key or settings.did_api_key
        self.api_base = (api_base or settings.did_api_base or "https://api.d-id.com").rstrip("/")
        self.realtime_ws_url = realtime_ws_url or settings.did_realtime_ws_url
        self.default_avatar_id = default_avatar_id or settings.avatar_default_id
        self.default_resolution = default_resolution or settings.avatar_default_resolution
        self.default_backdrop = default_backdrop or settings.avatar_default_backdrop

        if not self.api_key:
            raise DidServiceError("DID_API_KEY non configurée")

        # Auth D-ID: Basic auth sur la clé API (username=clé, mdp vide)
        basic_token = base64.b64encode(self.api_key.encode("utf-8")).decode("utf-8")

        # HTTP client pour REST
        self._http = httpx.AsyncClient(
            base_url=self.api_base,
            headers={
                "Authorization": f"Basic {basic_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

        self._basic_token = basic_token

    async def close(self):
        """Fermer le client HTTP."""
        try:
            await self._http.aclose()
        except Exception:
            pass

    # ---------- REST helpers ----------

    async def create_session(
        self,
        avatar_id: Optional[str] = None,
        resolution: Optional[str] = None,
        backdrop: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Crée une session avatar côté D-ID.
        Retour attendu: dict contenant au moins un identifiant de session (selon la spec D-ID).
        """
        payload: Dict[str, Any] = {
            "avatar_id": avatar_id or self.default_avatar_id,
            "resolution": resolution or self.default_resolution,
            "backdrop": backdrop or self.default_backdrop,
        }
        if extra:
            payload.update(extra)

        # NOTE: L'endpoint exact peut varier selon la version D-ID. À ajuster si nécessaire.
        resp = await self._http.post("/v1/avatars/sessions", json=payload)
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"error": resp.text}
            raise DidServiceError(f"create_session failed: HTTP {resp.status_code} {data}")
        return resp.json()

    async def get_session(self, session_id: str) -> Dict[str, Any]:
        """Récupérer les détails d'une session D-ID."""
        resp = await self._http.get(f"/v1/avatars/sessions/{session_id}")
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"error": resp.text}
            raise DidServiceError(f"get_session failed: HTTP {resp.status_code} {data}")
        return resp.json()

    async def delete_session(self, session_id: str) -> Dict[str, Any]:
        """Supprimer une session D-ID."""
        resp = await self._http.delete(f"/v1/avatars/sessions/{session_id}")
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"error": resp.text}
            raise DidServiceError(f"delete_session failed: HTTP {resp.status_code} {data}")
        return {"ok": True, "session_id": session_id}

    # ---------- Realtime WS helper ----------

    async def resolve_realtime_ws_url(self, session_id: str) -> str:
        """
        Tente de résoudre l'URL WS Realtime pour la session donnée.
        Priorité:
          1) settings.did_realtime_ws_url si défini
          2) champ retourné par get_session (wsUrl / websocket_url / realtime_ws_url)
          3) fallback générique basé sur un pattern (à adapter si doc différente)
        """
        if self.realtime_ws_url:
            return self.realtime_ws_url

        # Essayer de lire l'URL depuis la session
        try:
            details = await self.get_session(session_id)
            ws_url = (
                details.get("wsUrl")
                or details.get("websocket_url")
                or details.get("realtime_ws_url")
            )
            if ws_url:
                return ws_url
        except Exception:
            # Ignorer, on utilisera le fallback
            pass

        # Fallback (à adapter selon doc D-ID)
        return f"wss://realtime.api.d-id.com/v1/avatars/sessions/{session_id}/connect"

    async def open_realtime_ws(self, session_id: str) -> aiohttp.ClientWebSocketResponse:
        """
        Ouvre une connexion WS Realtime avec D-ID pour une session donnée.
        Retourne l'objet ws aiohttp; le caller doit appeler ws.close() et session.close().
        """
        ws_url = await self.resolve_realtime_ws_url(session_id)

        headers = {
            "Authorization": f"Basic {self._basic_token}",
            "Accept": "application/json",
        }

        session = aiohttp.ClientSession(headers=headers)
        try:
            ws = await session.ws_connect(ws_url, heartbeat=30)
        except Exception as e:
            await session.close()
            raise DidServiceError(f"Failed to open D-ID Realtime WS: {e}")

        # Attacher la session pour nettoyage par le caller
        setattr(ws, "_did_http_session", session)
        return ws


# Instance singleton simple utilisable via import
did_service = DidService()