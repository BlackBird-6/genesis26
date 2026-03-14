"""
Toronto Climate Pulse — Policy State Manager

Implements the Atomic Policy State Machine:
  - Stores each policy as a unique PolicyRecord with its 5 agent deltas.
  - Global CityState = Baseline + Sum(All Active Policy Deltas).
  - Removing a policy removes its exact contribution (exact reversion).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from engine.models import (
    AgentResult,
    CityState,
    Metrics,
    PolicyRecord,
)
from engine.orchestrator import AgentOrchestrator

# Baseline: all metrics start at 0.5 (neutral)
BASELINE = Metrics(
    emissions=0.5,
    congestion=0.5,
    equity=0.5,
    energy_demand=0.5,
    fiscal=0.5,
)


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


class PolicyRegistry:
    """
    Manages the policy list and computes aggregate city state.

    Thread-safe for single-process async usage (no locks needed
    because asyncio is single-threaded within a coroutine).
    """

    def __init__(self) -> None:
        self._policies: dict[str, PolicyRecord] = {}
        self._orchestrator = AgentOrchestrator()

    async def add_policy(self, policy_text: str) -> PolicyRecord:
        """
        Analyse a policy with all 5 agents and store the results.

        Returns:
            The newly created PolicyRecord.
        """
        policy_id = uuid.uuid4().hex[:12]

        # Run all 5 agents in parallel via the orchestrator
        agent_results: list[AgentResult] = await self._orchestrator.analyze_policy(
            policy_text
        )

        record = PolicyRecord(
            policy_id=policy_id,
            policy_text=policy_text,
            agent_results=agent_results,
        )

        self._policies[policy_id] = record
        return record

    def remove_policy(self, policy_id: str) -> PolicyRecord | None:
        """
        Remove a policy from the registry.

        Returns the removed PolicyRecord, or None if not found.
        """
        return self._policies.pop(policy_id, None)

    def get_aggregate_state(self) -> CityState:
        """
        Compute: Baseline + Sum(All Active Policy Deltas), clamped to [0.0, 1.0].
        """
        # Start from baseline
        totals: dict[str, float] = {
            "emissions": BASELINE.emissions,
            "congestion": BASELINE.congestion,
            "equity": BASELINE.equity,
            "energy_demand": BASELINE.energy_demand,
            "fiscal": BASELINE.fiscal,
        }

        # Sum deltas from all active policies
        confidences: list[float] = []
        for record in self._policies.values():
            for result in record.agent_results:
                totals[result.metric_key] += result.delta
                confidences.append(result.confidence)

        # Clamp all metrics to [0.0, 1.0]
        metrics = Metrics(
            emissions=_clamp(totals["emissions"]),
            congestion=_clamp(totals["congestion"]),
            equity=_clamp(totals["equity"]),
            energy_demand=_clamp(totals["energy_demand"]),
            fiscal=_clamp(totals["fiscal"]),
        )

        # Average confidence across all agent results
        avg_confidence = (
            sum(confidences) / len(confidences) if confidences else 0.5
        )

        return CityState(
            metrics=metrics,
            confidence_score=round(avg_confidence, 4),
            active_policies=len(self._policies),
        )

    def list_policies(self) -> list[dict]:
        """Return all active policies as serialisable dicts."""
        return [
            {
                "policy_id": rec.policy_id,
                "policy_text": rec.policy_text,
                "agent_results": [ar.model_dump() for ar in rec.agent_results],
                "timestamp": rec.timestamp.isoformat(),
            }
            for rec in self._policies.values()
        ]
