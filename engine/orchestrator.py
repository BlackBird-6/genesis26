"""
Toronto Climate Pulse — Agent Orchestrator

Runs 5 specialist agents in parallel using asyncio.gather.
Each agent is a deterministic rule-based function that evaluates
policy text against the Toronto 2026 knowledge base.

Architecture note: swap the _run_*_agent() functions with LLM calls
to upgrade from deterministic to AI-driven analysis.
"""

from __future__ import annotations

import asyncio
import json
import math
import re
from pathlib import Path
from typing import Any

from engine.models import (
    AgentDomain,
    AgentResponse,
    CityState,
    Fiscal,
    Metrics,
)

# ---------------------------------------------------------------------------
# Load the Toronto 2026 knowledge base once at module level
# ---------------------------------------------------------------------------
_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "toronto_2026.json"
with open(_DATA_PATH, encoding="utf-8") as _f:
    TORONTO_DATA: dict[str, Any] = json.load(_f)


# ---------------------------------------------------------------------------
# Specificity / Confidence Scoring
# ---------------------------------------------------------------------------

# Keywords and patterns that indicate a specific, actionable policy
_SPECIFIC_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\d+\s*%", re.IGNORECASE),                   # percentages
    re.compile(r"\$[\d,]+", re.IGNORECASE),                   # dollar amounts
    re.compile(r"\bline\s*[1-4]\b", re.IGNORECASE),           # subway lines
    re.compile(r"\b(ttc|go\s*transit|toronto\s*hydro)\b", re.IGNORECASE),
    re.compile(r"\b(jane[- ]finch|scarborough|malvern|flemingdon|thorncliffe)\b", re.IGNORECASE),
    re.compile(r"\b(peak|off[- ]peak|headway|frequency)\b", re.IGNORECASE),
    re.compile(r"\b(mw|megawatt|kwh|kilowatt)\b", re.IGNORECASE),
    re.compile(r"\b(fare|subsidy|tax|levy|bond)\b", re.IGNORECASE),
    re.compile(r"\b(nia|neighbourhood\s*improvement)\b", re.IGNORECASE),
    re.compile(r"\b(ev|electric\s*vehicle|charging)\b", re.IGNORECASE),
    re.compile(r"\b(ghg|emissions|carbon|co2)\b", re.IGNORECASE),
    re.compile(r"\b(budget|capital|operating)\b", re.IGNORECASE),
    re.compile(r"\b(pickering|nuclear)\b", re.IGNORECASE),
    re.compile(r"\b(ontario\s*line|eglinton|finch\s*west)\b", re.IGNORECASE),
    re.compile(r"\b(increase|decrease|reduce|expand|cut|add|remove)\b", re.IGNORECASE),
]

_VAGUE_PHRASES = [
    "make it better", "improve things", "be greener", "make the city greener",
    "fix transit", "help people", "do something", "make it work",
]


def compute_confidence(policy: str) -> float:
    """Return 0.0–1.0 confidence based on policy specificity.

    Uses weighted categories:
      - HIGH specificity (quantitative data): ×3 weight each
      - MEDIUM specificity (named entities): ×2 weight each
      - LOW specificity (action verbs, general keywords): ×1 weight each
    """
    text = policy.strip().lower()

    # Very short or obviously vague → low confidence
    if len(text) < 15 or any(v in text for v in _VAGUE_PHRASES):
        return round(max(0.1, len(text) / 200), 2)

    # Categorised scoring — high-value signals matter more
    score = 0.0
    max_possible = 0.0

    # HIGH specificity (weight 3): quantitative data
    high_patterns = _SPECIFIC_PATTERNS[:3]  # percentages, dollars, subway lines
    max_possible += len(high_patterns) * 3
    score += sum(3 for p in high_patterns if p.search(policy))

    # MEDIUM specificity (weight 2): named entities & infrastructure
    medium_patterns = _SPECIFIC_PATTERNS[3:9]  # TTC, NIAs, peak/headway, MW, fare, NIA
    max_possible += len(medium_patterns) * 2
    score += sum(2 for p in medium_patterns if p.search(policy))

    # LOW specificity (weight 1): general keywords
    low_patterns = _SPECIFIC_PATTERNS[9:]  # ev, ghg, budget, pickering, ontario line, verbs
    max_possible += len(low_patterns) * 1
    score += sum(1 for p in low_patterns if p.search(policy))

    # Normalise to 0-1 with a generous curve (hitting 40% of max → 0.7 confidence)
    pattern_score = min(score / (max_possible * 0.35), 1.0)

    # Length bonus (longer = more detailed, up to 0.15)
    word_count = len(policy.split())
    length_bonus = min(word_count / 40, 1.0) * 0.15

    raw = pattern_score * 0.85 + length_bonus
    return round(min(max(raw, 0.15), 1.0), 2)


def _generate_clarification(confidence: float, policy: str) -> str | None:
    """Generate a clarification request when confidence is low."""
    if confidence >= 0.4:
        return None
    return (
        f"Your policy \"{policy[:80]}{'...' if len(policy) > 80 else ''}\" "
        "is too vague for a reliable simulation. Consider specifying:\n"
        "• Which transit lines or neighbourhoods are affected?\n"
        "• What percentage change or dollar amount is involved?\n"
        "• What is the timeline (immediate vs. phased)?"
    )


# ---------------------------------------------------------------------------
# Keyword extraction helpers
# ---------------------------------------------------------------------------

def _mentions(policy: str, *keywords: str) -> bool:
    """Check if policy text mentions any of the given keywords."""
    text = policy.lower()
    return any(kw.lower() in text for kw in keywords)


def _extract_percentage(policy: str) -> float | None:
    """Extract the first percentage value from policy text."""
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", policy)
    return float(m.group(1)) / 100.0 if m else None


def _extract_dollar(policy: str) -> float | None:
    """Extract the first dollar amount from policy text."""
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", policy)
    return float(m.group(1).replace(",", "")) if m else None


# ---------------------------------------------------------------------------
# Agent implementations (deterministic / rule-based)
# ---------------------------------------------------------------------------

async def _run_transit_agent(policy: str, data: dict) -> AgentResponse:
    """Transit Tactician: TTC capacity, commute times, headways."""
    await asyncio.sleep(0.05)  # simulate processing time

    pct = _extract_percentage(policy) or 0.10
    warnings: list[str] = []
    congestion_delta = 0.0
    narrative_parts: list[str] = []

    transit = data["transit"]["ttc"]

    if _mentions(policy, "frequency", "headway", "peak", "line 1", "line 2"):
        # More frequency → less congestion, but costs money
        congestion_delta = pct * 0.5  # positive = improvement
        new_headway = transit["line_1_peak_headway_seconds"] * (1 - pct)
        if new_headway < 90:
            warnings.append(
                f"Peak headway of {new_headway:.0f}s is below safe operational minimum (90s). "
                "Risk of bunching and platform overcrowding."
            )
        narrative_parts.append(
            f"Increasing peak frequency by {pct*100:.0f}% reduces Line 1 headway "
            f"from {transit['line_1_peak_headway_seconds']}s to {new_headway:.0f}s. "
            f"Estimated congestion improvement: +{congestion_delta:.2f}."
        )

    if _mentions(policy, "fare", "free", "discount", "cap"):
        ridership_bump = pct * 0.3
        congestion_delta -= ridership_bump * 0.2  # more riders = more crowding
        narrative_parts.append(
            f"Fare changes could increase ridership by ~{ridership_bump*100:.0f}%, "
            f"adding crowding pressure (congestion delta: {-ridership_bump*0.2:.2f})."
        )

    if _mentions(policy, "ontario line", "construction"):
        congestion_delta -= 0.08
        narrative_parts.append(
            "Ontario Line construction continues to add ~12 min delays on affected corridors."
        )

    if not narrative_parts:
        narrative_parts.append(
            "Policy has indirect transit implications. Estimated minor congestion impact."
        )
        congestion_delta = pct * 0.05

    return AgentResponse(
        agent_name="Transit Tactician",
        domain=AgentDomain.TRANSIT,
        metric_deltas={"congestion": round(congestion_delta, 4)},
        fiscal_deltas={},
        narrative=" ".join(narrative_parts),
        warnings=warnings,
        confidence=min(0.9, 0.3 + (0.6 if _mentions(policy, "ttc", "transit", "line", "fare", "bus", "subway") else 0.0)),
    )


async def _run_eco_agent(policy: str, data: dict) -> AgentResponse:
    """Eco Advocate: AQI, GHG reduction, emissions."""
    await asyncio.sleep(0.05)

    pct = _extract_percentage(policy) or 0.10
    emissions_delta = 0.0
    warnings: list[str] = []
    narrative_parts: list[str] = []

    if _mentions(policy, "emission", "ghg", "carbon", "co2", "green"):
        emissions_delta = pct * 0.4
        narrative_parts.append(
            f"Direct emissions reduction policy: estimated {pct*100:.0f}% effort "
            f"yields +{emissions_delta:.2f} improvement on the emissions index."
        )

    if _mentions(policy, "ev", "electric vehicle", "charging"):
        emissions_delta += 0.08
        narrative_parts.append(
            "EV expansion reduces tailpipe emissions. "
            "Estimated +0.08 emissions improvement."
        )

    if _mentions(policy, "transit", "ttc", "frequency", "bus"):
        # Better transit → mode shift → fewer cars
        emissions_delta += pct * 0.15
        narrative_parts.append(
            f"Transit improvements drive mode shift from private vehicles. "
            f"Estimated emissions benefit: +{pct*0.15:.2f}."
        )

    if _mentions(policy, "construction", "build", "expand"):
        emissions_delta -= 0.05
        narrative_parts.append(
            "Construction activity generates embodied carbon and equipment emissions (-0.05)."
        )

    if not narrative_parts:
        narrative_parts.append(
            "Policy has limited direct environmental impact. Minor secondary effects estimated."
        )
        emissions_delta = pct * 0.02

    if emissions_delta < -0.1:
        warnings.append("Policy is projected to INCREASE net GHG emissions significantly.")

    return AgentResponse(
        agent_name="Eco Advocate",
        domain=AgentDomain.ENVIRONMENT,
        metric_deltas={"emissions": round(emissions_delta, 4)},
        fiscal_deltas={},
        narrative=" ".join(narrative_parts),
        warnings=warnings,
        confidence=min(0.9, 0.3 + (0.6 if _mentions(policy, "emission", "ghg", "carbon", "green", "ev", "air") else 0.1)),
    )


async def _run_equity_agent(policy: str, data: dict) -> AgentResponse:
    """Equity Sentinel: NIA impacts, affordability, vulnerable communities."""
    await asyncio.sleep(0.05)

    pct = _extract_percentage(policy) or 0.10
    equity_delta = 0.0
    warnings: list[str] = []
    narrative_parts: list[str] = []
    social = data["social"]

    # Check for NIA-specific mentions
    nia_mentioned = [
        nia for nia in social["neighbourhood_improvement_areas"]
        if nia.lower().replace("-", " ") in policy.lower().replace("-", " ")
    ]

    if nia_mentioned:
        equity_delta += 0.15
        narrative_parts.append(
            f"Policy directly targets NIA(s): {', '.join(nia_mentioned)}. "
            f"Positive equity impact: +0.15."
        )

    if _mentions(policy, "fare", "free", "discount", "subsidy", "affordable"):
        equity_delta += pct * 0.3
        narrative_parts.append(
            f"Affordability measures benefit low-income residents. "
            f"Equity improvement: +{pct*0.3:.2f}."
        )

    if _mentions(policy, "rent", "housing", "shelter"):
        equity_delta += pct * 0.25
        narrative_parts.append(
            f"Housing/shelter investment supports vulnerable populations. "
            f"Current Rent Bank: ${social['rent_bank_funding_cad']/1e6:.1f}M."
        )

    if _mentions(policy, "tax", "levy", "increase"):
        equity_delta -= 0.05
        warnings.append(
            "Tax increases disproportionately burden lower-income residents in NIAs."
        )
        narrative_parts.append("Regressive tax risk: -0.05 equity impact.")

    if _mentions(policy, "cut", "reduce spending", "austerity"):
        equity_delta -= 0.15
        warnings.append(
            "Service cuts typically hit NIA communities hardest due to higher dependence on public services."
        )
        narrative_parts.append("Service reduction risk: -0.15 equity impact.")

    if not narrative_parts:
        narrative_parts.append(
            "Policy has indirect equity implications. Monitoring NIA impact recommended."
        )
        equity_delta = pct * 0.02

    return AgentResponse(
        agent_name="Equity Sentinel",
        domain=AgentDomain.EQUITY,
        metric_deltas={"equity": round(equity_delta, 4)},
        fiscal_deltas={},
        narrative=" ".join(narrative_parts),
        warnings=warnings,
        confidence=min(0.9, 0.3 + (0.5 if nia_mentioned else 0.0) + (0.2 if _mentions(policy, "equity", "nia", "poverty", "affordable") else 0.0)),
    )


async def _run_grid_agent(policy: str, data: dict) -> AgentResponse:
    """Grid Guardian: Toronto Hydro peak load, grid stability."""
    await asyncio.sleep(0.05)

    pct = _extract_percentage(policy) or 0.10
    energy_delta = 0.0
    warnings: list[str] = []
    narrative_parts: list[str] = []
    grid = data["grid"]
    hydro = grid["toronto_hydro"]

    if _mentions(policy, "ev", "electric vehicle", "charging"):
        additional_load = pct * 500  # MW
        new_load = hydro["peak_demand_mw"] + additional_load
        energy_delta -= additional_load / hydro["capacity_limit_mw"]
        if new_load > hydro["capacity_limit_mw"]:
            warnings.append(
                f"EV expansion would push peak demand to {new_load:.0f} MW, "
                f"exceeding grid capacity of {hydro['capacity_limit_mw']} MW. "
                "Brownout risk is HIGH."
            )
        narrative_parts.append(
            f"EV charging expansion adds ~{additional_load:.0f} MW to peak load. "
            f"Grid headroom drops from {hydro['headroom_mw']} MW to "
            f"{hydro['capacity_limit_mw'] - new_load:.0f} MW."
        )

    if _mentions(policy, "electrif", "heat pump", "electric heat"):
        additional_load = pct * 800
        energy_delta -= additional_load / hydro["capacity_limit_mw"]
        warnings.append(
            f"Electrification adds ~{additional_load:.0f} MW peak load. "
            "Grid upgrade investment required."
        )
        narrative_parts.append(
            f"Building electrification increases grid stress significantly."
        )

    if _mentions(policy, "solar", "wind", "renewable", "battery", "storage"):
        energy_delta += pct * 0.2
        narrative_parts.append(
            f"Renewable/storage investment improves grid resilience: +{pct*0.2:.2f}."
        )

    if _mentions(policy, "pickering", "nuclear"):
        narrative_parts.append(
            f"Pickering Nuclear: {grid['pickering_nuclear']['available_capacity_mw']} MW "
            f"currently available (refurbishment until {grid['pickering_nuclear']['expected_full_return']}). "
            "Policy changes cannot accelerate refurbishment timeline."
        )

    if not narrative_parts:
        narrative_parts.append(
            "Policy has minimal direct grid impact. Monitoring energy demand recommended."
        )
        energy_delta = pct * 0.01

    return AgentResponse(
        agent_name="Grid Guardian",
        domain=AgentDomain.GRID,
        metric_deltas={"energy_demand": round(energy_delta, 4)},
        fiscal_deltas={},
        narrative=" ".join(narrative_parts),
        warnings=warnings,
        confidence=min(0.9, 0.3 + (0.6 if _mentions(policy, "grid", "hydro", "energy", "power", "ev", "electric", "mw", "solar", "pickering") else 0.1)),
    )


async def _run_fiscal_agent(policy: str, data: dict) -> AgentResponse:
    """Fiscal Architect: Budget impact, debt-to-revenue, tax implications."""
    await asyncio.sleep(0.05)

    pct = _extract_percentage(policy) or 0.10
    dollar = _extract_dollar(policy)
    warnings: list[str] = []
    narrative_parts: list[str] = []
    budget = data["budget"]
    fiscal_deltas: dict[str, float] = {}

    estimated_cost = dollar if dollar else budget["operating_budget_2026_cad"] * pct * 0.05

    if _mentions(policy, "transit", "ttc", "frequency", "line"):
        base_cost = budget["ttc_city_subsidy_cad"] * pct
        estimated_cost = dollar if dollar else base_cost
        fiscal_deltas["available_budget"] = -estimated_cost
        fiscal_deltas["debt_to_revenue"] = (estimated_cost / budget["operating_budget_2026_cad"]) * 0.5
        narrative_parts.append(
            f"Transit expansion estimated cost: ${estimated_cost/1e6:.0f}M. "
            f"TTC subsidy would rise from $1.48B to ${(budget['ttc_city_subsidy_cad'] + estimated_cost)/1e9:.2f}B."
        )

    if _mentions(policy, "tax", "levy", "revenue"):
        tax_revenue = budget["property_tax_base_cad"] * pct
        fiscal_deltas["tax_impact"] = pct * 100
        fiscal_deltas["available_budget"] = fiscal_deltas.get("available_budget", 0) + tax_revenue
        narrative_parts.append(
            f"Tax adjustment generates ${tax_revenue/1e6:.0f}M in revenue. "
            f"Property tax impact: +{pct*100:.1f}%."
        )

    if _mentions(policy, "subsidy", "grant", "fund", "invest"):
        fiscal_deltas["available_budget"] = fiscal_deltas.get("available_budget", 0) - estimated_cost
        fiscal_deltas["projected_roi"] = pct * 0.8  # subsidies have partial ROI
        narrative_parts.append(
            f"Subsidy/investment cost: ${estimated_cost/1e6:.0f}M. "
            f"Projected ROI ratio: {pct*0.8:.2f}."
        )

    if _mentions(policy, "cut", "reduce", "austerity", "save"):
        savings = estimated_cost
        fiscal_deltas["available_budget"] = fiscal_deltas.get("available_budget", 0) + savings
        narrative_parts.append(f"Projected savings: ${savings/1e6:.0f}M.")

    if not narrative_parts:
        fiscal_deltas["available_budget"] = -estimated_cost
        narrative_parts.append(
            f"Estimated policy implementation cost: ${estimated_cost/1e6:.0f}M. "
            f"Against 2026 operating budget of ${budget['operating_budget_2026_cad']/1e9:.1f}B."
        )

    remaining = budget["operating_budget_2026_cad"] + fiscal_deltas.get("available_budget", 0)
    if remaining < 0:
        warnings.append(
            f"CRITICAL: Policy cost exceeds entire operating budget. "
            f"Deficit of ${abs(remaining)/1e9:.2f}B projected."
        )
    elif remaining < budget["operating_budget_2026_cad"] * 0.1:
        warnings.append(
            f"WARNING: Policy would consume >90% of operating budget. "
            f"Only ${remaining/1e9:.2f}B remaining."
        )

    new_debt_ratio = budget["debt_service_ratio"] + fiscal_deltas.get("debt_to_revenue", 0)
    if new_debt_ratio > 0.25:
        warnings.append(
            f"Debt-to-revenue ratio would rise to {new_debt_ratio:.1%}, "
            "exceeding the 25% prudential limit."
        )

    return AgentResponse(
        agent_name="Fiscal Architect",
        domain=AgentDomain.FISCAL,
        metric_deltas={},
        fiscal_deltas={k: round(v, 2) for k, v in fiscal_deltas.items()},
        narrative=" ".join(narrative_parts),
        warnings=warnings,
        confidence=min(0.9, 0.3 + (0.6 if _mentions(policy, "budget", "cost", "tax", "fund", "subsidy", "$") else 0.1)),
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class AgentOrchestrator:
    """Runs 5 specialist agents in parallel and merges results."""

    def __init__(self) -> None:
        self.data = TORONTO_DATA

    async def analyze_policy(self, policy_text: str) -> tuple[list[AgentResponse], CityState]:
        """
        Run all 5 agents concurrently, merge their deltas into a CityState.

        Returns:
            (agent_responses, merged_city_state)
        """
        # Run all agents in parallel
        responses: list[AgentResponse] = await asyncio.gather(
            _run_transit_agent(policy_text, self.data),
            _run_eco_agent(policy_text, self.data),
            _run_equity_agent(policy_text, self.data),
            _run_grid_agent(policy_text, self.data),
            _run_fiscal_agent(policy_text, self.data),
        )

        # Compute confidence
        confidence = compute_confidence(policy_text)
        clarification = _generate_clarification(confidence, policy_text)

        # Merge metric deltas
        merged_metrics = Metrics()
        for resp in responses:
            for key, delta in resp.metric_deltas.items():
                if hasattr(merged_metrics, key):
                    current = getattr(merged_metrics, key)
                    setattr(merged_metrics, key, max(0.0, min(1.0, current + delta)))

        # Merge fiscal deltas
        merged_fiscal = Fiscal()
        for resp in responses:
            for key, delta in resp.fiscal_deltas.items():
                if hasattr(merged_fiscal, key):
                    current = getattr(merged_fiscal, key)
                    setattr(merged_fiscal, key, current + delta)

        city_state = CityState(
            metrics=merged_metrics,
            fiscal=merged_fiscal,
            confidence_score=confidence,
            clarification_request=clarification,
        )

        return responses, city_state
