"""
Toronto Climate Pulse — FastAPI Application

WebSocket-based backend that streams multi-agent simulation results
in real time.  Serves a minimal test frontend at GET /.
"""

from __future__ import annotations

import json
import traceback
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from engine.models import EventType, PolicyInput, SimulationEvent
from engine.orchestrator import AgentOrchestrator

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Toronto Climate Pulse",
    description="Multi-Agent urban sustainability simulation engine",
    version="0.1.0",
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

# Single orchestrator instance
orchestrator = AgentOrchestrator()


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
    return {"status": "ok", "service": "Toronto Climate Pulse", "version": "0.1.0"}


# ---------------------------------------------------------------------------
# WebSocket — real-time simulation streaming
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
            # Wait for a policy from the client
            raw = await ws.receive_text()
            try:
                payload = json.loads(raw)
                policy_input = PolicyInput(**payload)
            except Exception:
                await ws.send_text(_event_json(EventType.ERROR, {
                    "message": "Invalid payload. Expected JSON: {\"policy\": \"...\"}",
                }))
                continue

            # Run the multi-agent analysis
            try:
                responses, city_state = await orchestrator.analyze_policy(
                    policy_input.policy
                )
            except Exception as exc:
                await ws.send_text(_event_json(EventType.ERROR, {
                    "message": f"Simulation error: {exc}",
                    "traceback": traceback.format_exc(),
                }))
                continue

            # Stream each agent result individually
            for resp in responses:
                await ws.send_text(_event_json(EventType.AGENT_RESULT, resp.model_dump()))

            # Send merged city state
            await ws.send_text(_event_json(EventType.CITY_STATE, city_state.model_dump(mode="json")))

            # Flag uncertain predictions
            if city_state.confidence_score < 0.4:
                uncertain_data = {
                    "confidence_score": city_state.confidence_score,
                    "message": "Uncertain Prediction — policy specificity is too low for reliable results.",
                }
                if city_state.clarification_request:
                    uncertain_data["clarification"] = city_state.clarification_request
                    await ws.send_text(_event_json(EventType.CLARIFICATION, uncertain_data))
                else:
                    await ws.send_text(_event_json(EventType.UNCERTAIN_PREDICTION, uncertain_data))

    except WebSocketDisconnect:
        pass