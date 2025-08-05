import asyncio
import json
import os
from typing import Tuple

import aiohttp
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

pytestmark = pytest.mark.asyncio


async def _ws_url_from_testclient(base_http_url: str, path: str) -> str:
    """
    Convertit l'URL HTTP issue du TestClient (souvent http://testserver)
    en une URL WS exploitable par aiohttp en local, en évitant le DNS 'testserver'.
    """
    from urllib.parse import urlparse, urlunparse

    parsed = urlparse(base_http_url)
    scheme = "ws" if parsed.scheme == "http" else "wss"
    netloc = parsed.netloc

    if ":" in netloc:
        _host, port = netloc.split(":", 1)
        netloc = f"127.0.0.1:{port}"
    else:
        # Par défaut sur 8000 si non précisé
        netloc = f"127.0.0.1:{os.getenv('AURA_WS_PORT', '8000')}"

    ws_base = urlunparse((scheme, netloc, "", "", "", ""))
    return ws_base + path


async def _connect_ws_avatar(test_client: TestClient, session_id: str) -> Tuple[aiohttp.ClientWebSocketResponse, aiohttp.ClientSession]:
    base_url = str(test_client.base_url)
    ws_url = await _ws_url_from_testclient(base_url, f"/ws/avatar/{session_id}")
    session = aiohttp.ClientSession()
    try:
        ws = await session.ws_connect(ws_url)
    except Exception:
        await session.close()
        raise
    return ws, session


@pytest.fixture(scope="module")
def test_client():
    with TestClient(app) as c:
        yield c


@pytest.mark.asyncio
async def test_ws_avatar_text_control_flow(test_client: TestClient):
    """
    Vérifie la séquence de contrôle texte sur /ws/avatar/{session_id}:
      - Connexion et réception de avatar.meta:accepted
      - Envoi avatar.start -> réception avatar.started
      - Envoi avatar.forward avec payload JSON simple -> réception avatar.upstream ou avatar.upstream_text (selon amont)
      - Envoi avatar.end -> réception avatar.end
    Si l'ouverture upstream D‑ID échoue (sans clés réelles ou IDs non valides), l'endpoint renvoie avatar.error CONNECT_FAILED;
    le test accepte ce chemin aussi, après l'accepted initial.
    """
    session_id = "avatar-int-smoke"

    ws, sess = await _connect_ws_avatar(test_client, session_id)
    try:
        # 1) accepted
        msg = await asyncio.wait_for(ws.receive(), timeout=10)
        assert msg.type == aiohttp.WSMsgType.TEXT
        data = json.loads(msg.data)
        assert data.get("type") == "avatar.meta"
        assert data.get("data", {}).get("stage") == "accepted"

        # 2) soit upstream_connected, soit error CONNECT_FAILED/SERVICE_INIT_FAILED
        msg2 = await asyncio.wait_for(ws.receive(), timeout=10)
        assert msg2.type == aiohttp.WSMsgType.TEXT
        d2 = json.loads(msg2.data)
        if d2.get("type") == "avatar.meta":
            assert d2.get("data", {}).get("stage") in ("upstream_connected",)
        else:
            # En cas d'échec de connexion upstream (attendu sans clés valides), on valide l'erreur structurée
            assert d2.get("type") == "avatar.error"
            assert d2.get("code") in ("CONNECT_FAILED", "SERVICE_INIT_FAILED")
            # Fin anticipée dans ce cas
            return

        # 3) start -> started
        await ws.send_str(json.dumps({"type": "avatar.start"}))
        started = await asyncio.wait_for(ws.receive(), timeout=10)
        assert started.type == aiohttp.WSMsgType.TEXT
        d3 = json.loads(started.data)
        assert d3.get("type") == "avatar.started"

        # 4) forward payload texte JSON
        await ws.send_str(json.dumps({
            "type": "avatar.forward",
            "data": {"text": "Bonjour, test d'intégration avatar."}
        }))

        # Lire quelques messages, accepter upstream JSON ou upstream_text, ou meta
        got_upstream_echo = False
        deadline = asyncio.get_event_loop().time() + 10
        while asyncio.get_event_loop().time() < deadline and not got_upstream_echo:
            try:
                incoming = await asyncio.wait_for(ws.receive(), timeout=2)
            except asyncio.TimeoutError:
                continue

            if incoming.type == aiohttp.WSMsgType.TEXT:
                payload = json.loads(incoming.data)
                t = payload.get("type")
                if t in ("avatar.upstream", "avatar.upstream_text"):
                    got_upstream_echo = True
                elif t in ("avatar.meta", "ping"):
                    # acceptable
                    continue
                elif t in ("avatar.error", "error"):
                    # Si l'amont renvoie une erreur, on arrête sans échouer le test
                    break
            elif incoming.type == aiohttp.WSMsgType.BINARY:
                # Un flux binaire peut apparaître (audio/vidéo), noter comme activité
                got_upstream_echo = True
            elif incoming.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSING, aiohttp.WSMsgType.CLOSED):
                break
        assert got_upstream_echo, "Aucun message upstream (texte/binaire/meta) reçu après avatar.forward"

        # 5) end
        await ws.send_str(json.dumps({"type": "avatar.end"}))
        final = await asyncio.wait_for(ws.receive(), timeout=5)
        if final.type == aiohttp.WSMsgType.TEXT:
            p = json.loads(final.data)
            # Le serveur envoie normalement avatar.end
            assert p.get("type") in ("avatar.end", "avatar.meta", "avatar.upstream", "avatar.upstream_text")
        # Sinon, si CLOSE rapide, on accepte

    finally:
        await ws.close()
        await sess.close()


@pytest.mark.asyncio
async def test_ws_avatar_forward_binary_audio(test_client: TestClient):
    """
    Vérifie que l'endpoint accepte un frame binaire (audio brut) après start/forward:
      - accepted, upstream_connected (ou erreur structurée)
      - avatar.start / avatar.started
      - envoi d'un petit buffer binaire; pas d’échec côté backend (peut ne pas produire de réponse explicite)
      - avatar.end
    """
    session_id = "avatar-int-binary"

    ws, sess = await _connect_ws_avatar(test_client, session_id)
    try:
        # accepted
        msg = await asyncio.wait_for(ws.receive(), timeout=10)
        assert msg.type == aiohttp.WSMsgType.TEXT
        data = json.loads(msg.data)
        assert data.get("type") == "avatar.meta"
        assert data.get("data", {}).get("stage") == "accepted"

        second = await asyncio.wait_for(ws.receive(), timeout=10)
        assert second.type == aiohttp.WSMsgType.TEXT
        d2 = json.loads(second.data)
        if d2.get("type") == "avatar.error":
            # Connexion upstream impossible sans config -> acceptable
            assert d2.get("code") in ("CONNECT_FAILED", "SERVICE_INIT_FAILED")
            return
        assert d2.get("type") == "avatar.meta"
        assert d2.get("data", {}).get("stage") in ("upstream_connected",)

        # start
        await ws.send_str(json.dumps({"type": "avatar.start"}))
        started = await asyncio.wait_for(ws.receive(), timeout=10)
        assert started.type == aiohttp.WSMsgType.TEXT
        d3 = json.loads(started.data)
        assert d3.get("type") == "avatar.started"

        # envoyer un petit buffer binaire (silence/int16)
        await ws.send_bytes(b"\x00" * 320)  # 160 samples int16 ~10ms @16kHz, minuscule

        # Lire sans exiger une réponse spécifique; s'assurer qu'on n'obtient pas immédiatement une erreur
        try:
            incoming = await asyncio.wait_for(ws.receive(), timeout=2)
            if incoming.type == aiohttp.WSMsgType.TEXT:
                payload = json.loads(incoming.data)
                assert payload.get("type") not in ("avatar.error", "error"), f"Erreur retournée: {payload}"
        except asyncio.TimeoutError:
            # Pas de message, acceptable
            pass

        # end
        await ws.send_str(json.dumps({"type": "avatar.end"}))
        # Optionnellement observer un dernier message
        try:
            _ = await asyncio.wait_for(ws.receive(), timeout=2)
        except asyncio.TimeoutError:
            pass

    finally:
        await ws.close()
        await sess.close()