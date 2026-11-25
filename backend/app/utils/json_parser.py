"""Safe JSON extraction utilities for LLM responses."""

import json
import re
from typing import Any, Optional


def extract_json_object(raw_text: str) -> Optional[dict[str, Any]]:
    """Extract and parse the first valid JSON object from an LLM response string."""
    if not raw_text:
        return None

    cleaned = raw_text.strip()
    # Strip markdown code fences if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    # Try direct parse first
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Locate outermost braces
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    candidate = cleaned[start : end + 1]
    # Remove trailing commas before closing braces/brackets
    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        return None
    return None
