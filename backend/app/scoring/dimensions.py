"""Deterministic mapping from question type to a specialization's six radar dimensions.

Every specialization lists six dimensions in a fixed role order (see catalog.py):
  0 fundamentals, 1 core area, 2 secondary area, 3 problem solving, 4 practical, 5 communication
The LLM never decides which dimension a question feeds; this map does, so radar
scores are reproducible and auditable.
"""
from __future__ import annotations

# question type -> {dimension index: weight}
TYPE_DIMENSION_WEIGHTS: dict[str, dict[int, float]] = {
    "fundamentals":      {0: 1.0, 1: 0.5},
    "deep_dive":         {1: 1.0, 2: 1.0},
    "problem_solving":   {3: 1.0, 4: 0.5},
    "scenario":          {4: 1.0, 2: 0.5},
    "critical_thinking": {2: 1.0, 3: 0.5},
    "behavioral":        {5: 1.0},
}


def dimension_weights_for(qtype: str, dimensions: list[str]) -> dict[str, float]:
    if len(dimensions) != 6:
        raise ValueError("expected exactly six radar dimensions")
    return {dimensions[i]: w for i, w in TYPE_DIMENSION_WEIGHTS[qtype].items()}
