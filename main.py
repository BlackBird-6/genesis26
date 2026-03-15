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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from engine.models import (
    AddPolicyRequest,
    AddPolicyResponse,
    ListPoliciesResponse,
    StateResponse,
)
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


# ---------------------------------------------------------------------------
# API Routes - HTTP REST
# ---------------------------------------------------------------------------

@app.get("/api/simulation/state", response_model=ListPoliciesResponse)
async def get_state():
    """Return the current list of policies and the overall city state."""
    policies = registry.list_policies()
    state = registry.get_aggregate_state()
    return ListPoliciesResponse(policies=policies, city_state=state)


@app.post("/api/simulation/policy", response_model=AddPolicyResponse)
async def add_policy(request: AddPolicyRequest):
    """Analyze and add a new policy."""
    if not request.policy or not request.policy.strip():
        raise HTTPException(status_code=400, detail="Policy text is required.")

    try:
        record = await registry.add_policy(request.policy.strip())
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Agent analysis failed: {exc}"
        )

    state = registry.get_aggregate_state()

    return AddPolicyResponse(
        policy_id=record.policy_id,
        policy_text=record.policy_text,
        agent_results=record.agent_results,
        city_state=state,
    )


@app.delete("/api/simulation/policy/{policy_id}", response_model=StateResponse)
async def remove_policy(policy_id: str):
    """Remove an existing policy by its ID."""
    removed = registry.remove_policy(policy_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found.")

    state = registry.get_aggregate_state()
    return StateResponse(city_state=state)


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
