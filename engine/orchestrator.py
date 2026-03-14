"""
Toronto Climate Pulse — Agent Orchestrator (Groq-powered)

Runs 5 Llama-3-8B specialist agents in parallel via asyncio.gather.
Each agent returns {"delta": float, "confidence": float, "reasoning": str}.
"""

from __future__ import annotations

import asyncio
from engine.groq_client import query_agent
from engine.models import AgentDomain, AgentResult
from engine.prompts import AGENT_CONFIGS


async def _run_single_agent(
    agent_key: str,
    policy_text: str,
) -> AgentResult:
    """Run one Groq agent and return a typed AgentResult."""
    config = AGENT_CONFIGS[agent_key]

    result = await query_agent(
        system_prompt=config["system_prompt"],
        user_prompt=f"Evaluate this Toronto policy: {policy_text}",
    )

    return AgentResult(
        agent_name=config["name"],
        domain=AgentDomain(config["domain"]),
        metric_key=config["metric_key"],
        delta=result["delta"],
        confidence=result["confidence"],
        reasoning=result.get("reasoning", ""),
    )


class AgentOrchestrator:
    """Runs all 5 specialist agents in parallel and returns results."""

    async def analyze_policy(self, policy_text: str) -> list[AgentResult]:
        """
        Run all 5 agents concurrently against the given policy.

        Returns:
            List of 5 AgentResult objects.
        """
        agent_keys = list(AGENT_CONFIGS.keys())

        results: list[AgentResult] = await asyncio.gather(
            *[_run_single_agent(key, policy_text) for key in agent_keys]
        )

        return results
