"""
Toronto Climate Pulse - FastAPI Application

WebSocket-based backend that manages a multi-policy state machine
with Groq-powered agents. Serves the exported Next.js frontend when
available and falls back to the legacy static frontend otherwise.
"""

from __future__ import annotations

import json
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from engine.models import EventType, SimulationEvent, WsAction, WsInbound
from engine.state_manager import PolicyRegistry

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Toronto Climate Pulse",
    description="Groq-powered Multi-Agent urban sustainability simulation",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT_DIR = Path(__file__).resolve().parent
LEGACY_STATIC_DIR = ROOT_DIR / "static"
FRONTEND_EXPORT_DIR = ROOT_DIR / "frontend" / "out"
LEGACY_STATIC_DIR.mkdir(exist_ok=True)

if LEGACY_STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(LEGACY_STATIC_DIR)), name="static")

if FRONTEND_EXPORT_DIR.exists():
    next_assets_dir = FRONTEND_EXPORT_DIR / "_next"
    if next_assets_dir.exists():
        app.mount("/_next", StaticFiles(directory=str(next_assets_dir)), name="next_assets")


# Single shared policy registry
registry = PolicyRegistry()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _frontend_index_response() -> HTMLResponse | FileResponse:
    exported_index = FRONTEND_EXPORT_DIR / "index.html"
    if exported_index.exists():
        return FileResponse(exported_index)

    legacy_index = LEGACY_STATIC_DIR / "index.html"
    if legacy_index.exists():
        return HTMLResponse(content=legacy_index.read_text(encoding="utf-8"))

    return HTMLResponse(content="<h1>Toronto Climate Pulse</h1><p>Frontend not found.</p>", status_code=404)


@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the exported Next.js frontend if present."""
    return _frontend_index_response()


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Toronto Climate Pulse", "version": "0.3.0"}


def _event_json(event_type: EventType, data: dict) -> str:
    """Create a JSON-serialised SimulationEvent."""
    evt = SimulationEvent(type=event_type, data=data)
    return evt.model_dump_json()


# ---------------------------------------------------------------------------
# WebSocket - real-time policy state machine
# ---------------------------------------------------------------------------

@app.websocket("/ws/simulation")
async def websocket_simulation(ws: WebSocket):
    await ws.accept()

    try:
        while True:
            raw = await ws.receive_text()

            try:
                payload = json.loads(raw)
                msg = WsInbound(**payload)
            except Exception:
                await ws.send_text(
                    _event_json(
                        EventType.ERROR,
                        {
                            "message": 'Invalid payload. Expected: {"action": "add_policy"|"remove_policy"|"list_policies", ...}',
                        },
                    )
                )
                continue

            if msg.action == WsAction.ADD_POLICY:
                if not msg.policy or not msg.policy.strip():
                    await ws.send_text(
                        _event_json(
                            EventType.ERROR,
                            {
                                "message": "Missing 'policy' field for add_policy action.",
                            },
                        )
                    )
                    continue

                try:
                    record = await registry.add_policy(msg.policy.strip())
                except Exception as exc:
                    await ws.send_text(
                        _event_json(
                            EventType.ERROR,
                            {
                                "message": f"Agent analysis failed: {exc}",
                                "traceback": traceback.format_exc(),
                            },
                        )
                    )
                    continue

                for ar in record.agent_results:
                    await ws.send_text(_event_json(EventType.AGENT_RESULT, ar.model_dump()))

                await ws.send_text(
                    _event_json(
                        EventType.POLICY_ADDED,
                        {
                            "policy_id": record.policy_id,
                            "policy_text": record.policy_text,
                            "agent_results": [ar.model_dump() for ar in record.agent_results],
                        },
                    )
                )

                state = registry.get_aggregate_state()
                await ws.send_text(_event_json(EventType.CITY_STATE, state.model_dump(mode="json")))

                if state.confidence_score < 0.4:
                    await ws.send_text(
                        _event_json(
                            EventType.UNCERTAIN_PREDICTION,
                            {
                                "confidence_score": state.confidence_score,
                                "message": "Uncertain prediction: low aggregate agent confidence.",
                            },
                        )
                    )

            elif msg.action == WsAction.REMOVE_POLICY:
                if not msg.policy_id:
                    await ws.send_text(
                        _event_json(
                            EventType.ERROR,
                            {
                                "message": "Missing 'policy_id' for remove_policy action.",
                            },
                        )
                    )
                    continue

                removed = registry.remove_policy(msg.policy_id)
                if removed is None:
                    await ws.send_text(
                        _event_json(
                            EventType.ERROR,
                            {
                                "message": f"Policy '{msg.policy_id}' not found.",
                            },
                        )
                    )
                    continue

                await ws.send_text(_event_json(EventType.POLICY_REMOVED, {"policy_id": msg.policy_id}))

                state = registry.get_aggregate_state()
                await ws.send_text(_event_json(EventType.CITY_STATE, state.model_dump(mode="json")))

            elif msg.action == WsAction.LIST_POLICIES:
                policies = registry.list_policies()
                state = registry.get_aggregate_state()
                await ws.send_text(
                    _event_json(
                        EventType.POLICY_LIST,
                        {
                            "policies": policies,
                            "city_state": state.model_dump(mode="json"),
                        },
                    )
                )

    except WebSocketDisconnect:
        pass


# ---------------------------------------------------------------------------
# Frontend asset fallback for exported Next.js app
# ---------------------------------------------------------------------------

@app.get("/{full_path:path}")
async def serve_frontend_assets(full_path: str):
    if full_path.startswith(("api/", "ws/", "static/", "_next/")):
        raise HTTPException(status_code=404)

    candidate = FRONTEND_EXPORT_DIR / full_path
    if candidate.is_dir():
        candidate = candidate / "index.html"

    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)

    if FRONTEND_EXPORT_DIR.exists():
        fallback_index = FRONTEND_EXPORT_DIR / "index.html"
        if fallback_index.exists():
            return FileResponse(fallback_index)

    legacy_candidate = LEGACY_STATIC_DIR / full_path
    if legacy_candidate.exists() and legacy_candidate.is_file():
        return FileResponse(legacy_candidate)

    return _frontend_index_response()
