"""
Toronto Climate Pulse — FastAPI Application

WebSocket-based backend that manages a multi-policy state machine
with Groq-powered Llama-3 agents. Serves a test frontend at GET /.
"""

from __future__ import annotations

import json
import traceback
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from engine.models import EventType, SimulationEvent, WsAction, WsInbound
from engine.state_manager import PolicyRegistry

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Toronto Climate Pulse",
    description="Groq-powered Multi-Agent urban sustainability simulation",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
_STATIC_DIR = Path(__file__).resolve().parent / "static"
_STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

# Single shared policy registry
registry = PolicyRegistry()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the test frontend."""
    html_path = _STATIC_DIR / "index.html"
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Toronto Climate Pulse</h1><p>Frontend not found.</p>")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Toronto Climate Pulse", "version": "0.2.0"}


# ---------------------------------------------------------------------------
# WebSocket — real-time policy state machine
# ---------------------------------------------------------------------------

def _event_json(event_type: EventType, data: dict) -> str:
    """Create a JSON-serialised SimulationEvent."""
    evt = SimulationEvent(type=event_type, data=data)
    return evt.model_dump_json()


@app.websocket("/ws/simulation")
async def websocket_simulation(ws: WebSocket):
    await ws.accept()

    try:
        while True:
            raw = await ws.receive_text()

            # Parse inbound message
            try:
                payload = json.loads(raw)
                msg = WsInbound(**payload)
            except Exception:
                await ws.send_text(_event_json(EventType.ERROR, {
                    "message": "Invalid payload. Expected: {\"action\": \"add_policy\"|\"remove_policy\"|\"list_policies\", ...}",
                }))
                continue

            # ---- ADD POLICY ----
            if msg.action == WsAction.ADD_POLICY:
                if not msg.policy or not msg.policy.strip():
                    await ws.send_text(_event_json(EventType.ERROR, {
                        "message": "Missing 'policy' field for add_policy action.",
                    }))
                    continue

                try:
                    record = await registry.add_policy(msg.policy.strip())
                except Exception as exc:
                    await ws.send_text(_event_json(EventType.ERROR, {
                        "message": f"Agent analysis failed: {exc}",
                        "traceback": traceback.format_exc(),
                    }))
                    continue

                # Stream each agent result
                for ar in record.agent_results:
                    await ws.send_text(_event_json(EventType.AGENT_RESULT, ar.model_dump()))

                # Send policy added event
                await ws.send_text(_event_json(EventType.POLICY_ADDED, {
                    "policy_id": record.policy_id,
                    "policy_text": record.policy_text,
                    "agent_results": [ar.model_dump() for ar in record.agent_results],
                }))

                # Broadcast updated aggregate state
                state = registry.get_aggregate_state()
                await ws.send_text(_event_json(EventType.CITY_STATE, state.model_dump(mode="json")))

                # Flag uncertain predictions
                if state.confidence_score < 0.4:
                    await ws.send_text(_event_json(EventType.UNCERTAIN_PREDICTION, {
                        "confidence_score": state.confidence_score,
                        "message": "Uncertain Prediction — low agent confidence across the board.",
                    }))

            # ---- REMOVE POLICY ----
            elif msg.action == WsAction.REMOVE_POLICY:
                if not msg.policy_id:
                    await ws.send_text(_event_json(EventType.ERROR, {
                        "message": "Missing 'policy_id' for remove_policy action.",
                    }))
                    continue

                removed = registry.remove_policy(msg.policy_id)
                if removed is None:
                    await ws.send_text(_event_json(EventType.ERROR, {
                        "message": f"Policy '{msg.policy_id}' not found.",
                    }))
                    continue

                # Confirm removal
                await ws.send_text(_event_json(EventType.POLICY_REMOVED, {
                    "policy_id": msg.policy_id,
                }))

                # Broadcast reverted aggregate state
                state = registry.get_aggregate_state()
                await ws.send_text(_event_json(EventType.CITY_STATE, state.model_dump(mode="json")))

            # ---- LIST POLICIES ----
            elif msg.action == WsAction.LIST_POLICIES:
                policies = registry.list_policies()
                state = registry.get_aggregate_state()
                await ws.send_text(_event_json(EventType.POLICY_LIST, {
                    "policies": policies,
                    "city_state": state.model_dump(mode="json"),
                }))

    except WebSocketDisconnect:
        pass