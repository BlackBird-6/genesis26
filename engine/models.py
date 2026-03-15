"""
Toronto Climate Pulse — Pydantic Schemas

Defines the core data models for city state, agent responses,
and policy input/output via REST API.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Metrics sub-model
# ---------------------------------------------------------------------------

class Metrics(BaseModel):
    """Normalised city performance metrics (0.0–1.0)."""
    emissions: float = Field(0.5, ge=0.0, le=1.0, description="GHG emissions index (0=worst, 1=best)")
    congestion: float = Field(0.5, ge=0.0, le=1.0, description="Traffic congestion index (0=worst, 1=best)")
    equity: float = Field(0.5, ge=0.0, le=1.0, description="Social equity index (0=worst, 1=best)")
    energy_demand: float = Field(0.5, ge=0.0, le=1.0, description="Energy demand pressure (0=over-capacity, 1=comfortable)")
    fiscal: float = Field(0.5, ge=0.0, le=1.0, description="Fiscal health (0=bankrupt, 1=surplus)")


# ---------------------------------------------------------------------------
# City State — the single source of truth
# ---------------------------------------------------------------------------

class CityState(BaseModel):
    """Complete city simulation state sent to the frontend."""
    metrics: Metrics = Field(default_factory=Metrics)
    confidence_score: float = Field(0.5, ge=0.0, le=1.0, description="Average simulation confidence")
    active_policies: int = Field(0, description="Number of active policies")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Agent result — raw LLM response per agent
# ---------------------------------------------------------------------------

class AgentDomain(str, Enum):
    TRANSIT = "transit"
    ENVIRONMENT = "environment"
    EQUITY = "equity"
    GRID = "grid"
    FISCAL = "fiscal"


# Maps each agent domain to which Metrics field it affects
DOMAIN_TO_METRIC: dict[AgentDomain, str] = {
    AgentDomain.TRANSIT: "congestion",
    AgentDomain.ENVIRONMENT: "emissions",
    AgentDomain.EQUITY: "equity",
    AgentDomain.GRID: "energy_demand",
    AgentDomain.FISCAL: "fiscal",
}


class AgentResult(BaseModel):
    """Raw result from a single Groq agent call."""
    agent_name: str
    domain: AgentDomain
    metric_key: str = Field(..., description="Which Metrics field this delta applies to")
    delta: float = Field(..., ge=-0.5, le=0.5, description="Impact delta (-0.5 to 0.5)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Agent confidence")
    reasoning: str = Field("", description="Quantitative reasoning for the delta")


# ---------------------------------------------------------------------------
# Policy record — stored in the registry
# ---------------------------------------------------------------------------

class PolicyRecord(BaseModel):
    """A single policy and its associated agent results."""
    policy_id: str
    policy_text: str
    agent_results: list[AgentResult] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# HTTP REST API requests & responses
# ---------------------------------------------------------------------------

class AddPolicyRequest(BaseModel):
    policy: str = Field(..., description="The user's policy plain text")


class AddPolicyResponse(BaseModel):
    policy_id: str
    policy_text: str
    agent_results: list[AgentResult] = Field(default_factory=list)
    city_state: CityState


class StateResponse(BaseModel):
    city_state: CityState


class ListPoliciesResponse(BaseModel):
    policies: list[dict] = Field(default_factory=list)
    city_state: CityState
