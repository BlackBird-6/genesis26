"""
Toronto Climate Pulse — Pydantic Schemas

Defines the core data models for city state, agent responses,
policy input, and WebSocket event envelopes.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Metrics & Fiscal sub-models
# ---------------------------------------------------------------------------

class Metrics(BaseModel):
    """Normalised city performance metrics (0.0–1.0)."""
    emissions: float = Field(0.5, ge=0.0, le=1.0, description="GHG emissions index (0=worst, 1=best)")
    congestion: float = Field(0.5, ge=0.0, le=1.0, description="Traffic congestion index (0=worst, 1=best)")
    equity: float = Field(0.5, ge=0.0, le=1.0, description="Social equity index (0=worst, 1=best)")
    energy_demand: float = Field(0.5, ge=0.0, le=1.0, description="Energy demand pressure (0=over-capacity, 1=comfortable)")


class Fiscal(BaseModel):
    """City fiscal snapshot."""
    available_budget: float = Field(18_900_000_000, description="Remaining operating budget (CAD)")
    projected_roi: float = Field(0.0, description="Projected return on investment ratio")
    tax_impact: float = Field(0.0, description="Estimated property tax change (%)")
    debt_to_revenue: float = Field(0.137, description="Debt-to-revenue ratio")


# ---------------------------------------------------------------------------
# City State — the single source of truth
# ---------------------------------------------------------------------------

class CityState(BaseModel):
    """Complete city simulation state sent to the frontend."""
    metrics: Metrics = Field(default_factory=Metrics)
    fiscal: Fiscal = Field(default_factory=Fiscal)
    confidence_score: float = Field(0.5, ge=0.0, le=1.0, description="Simulation reliability score")
    clarification_request: Optional[str] = Field(None, description="Clarification prompt for vague policies")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Agent response
# ---------------------------------------------------------------------------

class AgentDomain(str, Enum):
    TRANSIT = "transit"
    ENVIRONMENT = "environment"
    EQUITY = "equity"
    GRID = "grid"
    FISCAL = "fiscal"


class AgentResponse(BaseModel):
    """Individual specialist agent analysis result."""
    agent_name: str = Field(..., description="Human-readable agent name")
    domain: AgentDomain = Field(..., description="Agent's specialty domain")
    metric_deltas: dict[str, float] = Field(
        default_factory=dict,
        description="Changes to CityState metrics (key → delta value)"
    )
    fiscal_deltas: dict[str, float] = Field(
        default_factory=dict,
        description="Changes to CityState fiscal fields (key → delta value)"
    )
    narrative: str = Field("", description="Human-readable impact summary")
    warnings: list[str] = Field(default_factory=list, description="Critical warnings")
    confidence: float = Field(0.5, ge=0.0, le=1.0, description="Agent-level confidence")


# ---------------------------------------------------------------------------
# Policy input from the user
# ---------------------------------------------------------------------------

class PolicyInput(BaseModel):
    """Payload received from the frontend via WebSocket."""
    policy: str = Field(..., min_length=1, description="Natural-language policy description")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Optional structured parameters")


# ---------------------------------------------------------------------------
# WebSocket event envelope
# ---------------------------------------------------------------------------

class EventType(str, Enum):
    AGENT_RESULT = "agent_result"
    CITY_STATE = "city_state"
    UNCERTAIN_PREDICTION = "uncertain_prediction"
    CLARIFICATION = "clarification"
    ERROR = "error"


class SimulationEvent(BaseModel):
    """WebSocket message wrapper sent to the frontend."""
    type: EventType
    data: dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
