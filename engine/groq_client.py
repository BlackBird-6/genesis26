"""
Toronto Climate Pulse — Groq API Client

Async client for querying Llama-3-8B via Groq's API.
Each call returns a strict JSON response:
  {"delta": float, "confidence": float, "reasoning": str}
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL: str = "llama-3.1-8b-instant"
GROQ_API_URL: str = "https://api.groq.com/openai/v1/chat/completions"

# Shared async client — created lazily
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


def _extract_json(text: str) -> dict[str, Any]:
    """
    Extract a JSON object from LLM output.

    Handles cases where the LLM wraps JSON in markdown code fences
    or adds conversational text around it.
    """
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    md_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if md_match:
        try:
            return json.loads(md_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding any JSON object in the text
    brace_match = re.search(r"\{[^{}]*\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from LLM response: {text[:200]}")


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


async def query_agent(
    system_prompt: str,
    user_prompt: str,
) -> dict[str, float]:
    """
    Query a single Groq Llama-3 agent.

    Returns:
        {"delta": float, "confidence": float, "reasoning": str}
        delta clamped to [-0.5, 0.5], confidence clamped to [0.0, 1.0]
    """
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")

    client = _get_client()

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 256,
    }

    resp = await client.post(
        GROQ_API_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
    )

    if resp.status_code != 200:
        body = resp.text
        raise RuntimeError(f"Groq API error {resp.status_code}: {body[:500]}")


    data = resp.json()
    content = data["choices"][0]["message"]["content"]

    parsed = _extract_json(content)

    delta = float(parsed.get("delta", 0.0))
    confidence = float(parsed.get("confidence", 0.5))
    reasoning = str(parsed.get("reasoning", ""))

    return {
        "delta": round(_clamp(delta, -0.5, 0.5), 4),
        "confidence": round(_clamp(confidence, 0.0, 1.0), 4),
        "reasoning": reasoning,
    }
