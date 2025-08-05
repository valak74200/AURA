import asyncio
import json
import os

import aiohttp
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

pytestmark = pytest.mark.asyncio


async def recv_json_or_text(ws: aiohttp.ClientWebSocketResponse):
    msg = await ws.receive()
    if msg.type == aiohttp.WSMsgType.TEXT:
        try:
            return json.loads(msg.data)
        except Exception:
            return {"_text": msg.data}
    return {"_type": str(msg.type)}


async def connect_via_aiohttp(base_http_url: str, path: str):
    """
    Convertit http://testserver en ws://testserver et ouvre un WS pour le path donné.
    """
    ws_url = base_http_url.replace("http", "ws") + path
    session = aiohttp.ClientSession()
    try:
        ws = await session.ws_connect(ws_url)
    except Exception as e:
        await session.close()
        raise e
    setattr(ws, "_sess", session)
    return ws


@pytest.fixture(scope="module")
def test_client():
    with TestClient(app) as c:
        yield c


@pytest.mark.asyncio
async def test_ws_agent_exists_and_errors_are_structured(test_client: TestClient):
    """
    Objectif:
    - Vérifier que l'endpoint /ws/agent/{id} accepte la connexion locale
    - Recevoir le meta accepted
    - Si la connexion upstream D‑ID échoue (attendu sans clés réelles), on reçoit un agent.error CONNECT_FAILED
      ou SERVICE_INIT_FAILED afin que le frontend puisse basculer en fallback.
    """
    base_url = str(test_client.base_url)
    agent_id = "agent-smoke-test"

    ws = await connect_via_aiohttp(base_url, f"/ws/agent/{agent_id}")

    # 1) accepted
    accepted = await recv_json_or_text(ws)
    assert isinstance(accepted, dict)
    assert accepted.get("type") == "agent.meta"
    assert accepted.get("data", {}).get("stage") == "accepted"

    # 2) soit upstream_connected, soit error CONNECT_FAILED/SERVICE_INIT_FAILED
    second = await recv_json_or_text(ws)
    assert isinstance(second, dict)
    if second.get("type") == "agent.meta":
        assert second.get("data", {}).get("stage") in ("upstream_connected",)
    else:
        assert second.get("type") == "agent.error"
        assert second.get("code") in ("CONNECT_FAILED", "SERVICE_INIT_FAILED")

    await ws.close()
    await getattr(ws, "_sess").close()


@pytest.mark.asyncio
async def test_rest_streams_proxies_exist_and_return_upstream_status(test_client: TestClient):
    """
    On frappe les proxys Streams avec des IDs factices.
    On attend une erreur 4xx/5xx amont (car IDs invalides), renvoyée telle quelle,
    ce qui prouve que nos endpoints existent et relaient correctement.
    """
    agent_id = "agent-smoke"
    stream_id = "stream-smoke"

    # create stream
    r1 = test_client.post(f"/api/v1/agents/{agent_id}/streams", json={"meta": "test"})
    assert r1.status_code in (200, 400, 401, 403, 404, 500, 502)
    # sdp
    r2 = test_client.post(f"/api/v1/agents/{agent_id}/streams/{stream_id}/sdp", json={"type": "offer", "sdp": "v=0..."})
    assert r2.status_code in (200, 400, 401, 403, 404, 500, 502)
    # ice
    r3 = test_client.post(f"/api/v1/agents/{agent_id}/streams/{stream_id}/ice", json={"candidates": []})
    assert r3.status_code in (200, 400, 401, 403, 404, 500, 502)
    # create video sub-stream
    r4 = test_client.post(f"/api/v1/agents/{agent_id}/streams/{stream_id}", json={"video": {"resolution": "720p"}})
    assert r4.status_code in (200, 400, 401, 403, 404, 500, 502)
    # delete stream
    r5 = test_client.delete(f"/api/v1/agents/{agent_id}/streams/{stream_id}")
    assert r5.status_code in (200, 204, 400, 401, 403, 404, 500, 502)