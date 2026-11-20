"""Deterministic scoring engine (SCORING_VERSION 1.0).

The LLM only supplies per-criterion scores, a verdict and evidence. Every
number shown in a report (question score, dimension score, overall score,
level) is computed here, with no LLM involvement.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

SCORING_VERSION = "1.0"

CRITERIA = ("correctness", "completeness", "depth", "relevance", "clarity")

# Criterion weights per question type (each row sums to 1.0).
CRITERIA_WEIGHTS: dict[str, dict[str, float]] = {
    "fundamentals":     {"correctness": 0.35, "completeness": 0.25, "depth": 0.15, "relevance": 0.10, "clarity": 0.15},
    "deep_dive":        {"correctness": 0.30, "completeness": 0.20, "depth": 0.30, "relevance": 0.10, "clarity": 0.10},
    "problem_solving":  {"correctness": 0.30, "completeness": 0.20, "depth": 0.15, "relevance": 0.25, "clarity": 0.10},
    "scenario":         {"correctness": 0.25, "completeness": 0.20, "depth": 0.15, "relevance": 0.30, "clarity": 0.10},
    "critical_thinking": {"correctness": 0.25, "completeness": 0.20, "depth": 0.30, "relevance": 0.10, "clarity": 0.15},
    "behavioral":       {"correctness": 0.10, "completeness": 0.25, "depth": 0.15, "relevance": 0.25, "clarity": 0.25},
}

# Weight of each question type in the overall score.
QUESTION_TYPE_WEIGHTS: dict[str, float] = {
    "fundamentals": 1.0, "deep_dive": 1.2, "problem_solving": 1.2,
    "scenario": 1.0, "critical_thinking": 1.0, "behavioral": 0.8,
}

# Verdict -> maximum allowed question score (guards against inflated LLM scores).
VERDICT_CAPS: dict[str, float] = {
    "correct": 100, "partial": 85, "incomplete": 70,
    "unsupported": 50, "incorrect": 35, "no_answer": 0,
}
# Verdict -> minimum plausible score; below this the evaluation is contradictory.
VERDICT_FLOORS: dict[str, float] = {
    "correct": 60, "partial": 35, "incomplete": 20,
    "unsupported": 0, "incorrect": 0, "no_answer": 0,
}

FOLLOWUP_BLEND = 0.30  # follow-up share of a main question's score

LEVELS = ((85, "Excellent"), (70, "Very Good"), (55, "Good"), (0, "Needs Improvement"))


@dataclass
class QuestionEval:
    position: int                      # 1..10 (main question)
    qtype: str
    criteria: dict[str, float]         # 0-100 each
    verdict: str
    dimension_weights: dict[str, float]  # radar dimension -> weight (any positive numbers)
    followup_score: float | None = None  # already-computed score of the follow-up, if any


@dataclass
class ScoredQuestion:
    position: int
    score: float
    contradictory: bool
    capped: bool


@dataclass
class Report:
    overall: float
    level: str
    questions: list[ScoredQuestion] = field(default_factory=list)
    dimensions: dict[str, float | None] = field(default_factory=dict)  # None = not assessed
    scoring_version: str = SCORING_VERSION


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, float(x)))


def level_for(score: float) -> str:
    for threshold, name in LEVELS:
        if score >= threshold:
            return name
    return LEVELS[-1][1]


def criteria_score(criteria: dict[str, float], qtype: str) -> float:
    w = CRITERIA_WEIGHTS[qtype]
    return sum(w[c] * _clamp(criteria.get(c, 0)) for c in CRITERIA)


def score_question(q: QuestionEval) -> ScoredQuestion:
    if q.verdict not in VERDICT_CAPS:
        raise ValueError(f"unknown verdict: {q.verdict}")
    raw = criteria_score(q.criteria, q.qtype)
    cap = VERDICT_CAPS[q.verdict]
    capped = raw > cap
    score = min(raw, cap)
    # Contradiction: verdict says one thing, criteria say another -> flag for re-evaluation.
    contradictory = raw < VERDICT_FLOORS[q.verdict] or capped and q.verdict in ("incorrect", "no_answer") and raw > cap + 25
    if q.followup_score is not None:
        score = (1 - FOLLOWUP_BLEND) * score + FOLLOWUP_BLEND * _clamp(q.followup_score)
    return ScoredQuestion(q.position, round(_clamp(score), 1), contradictory, capped)


def compute_report(questions: Iterable[QuestionEval], dimensions: Iterable[str]) -> Report:
    qs = list(questions)
    if not qs:
        raise ValueError("no questions to score")
    positions = [q.position for q in qs]
    if len(set(positions)) != len(positions):
        raise ValueError("duplicate main question positions")

    scored = [score_question(q) for q in qs]

    total_w = sum(QUESTION_TYPE_WEIGHTS[q.qtype] for q in qs)
    overall = sum(QUESTION_TYPE_WEIGHTS[q.qtype] * s.score for q, s in zip(qs, scored)) / total_w

    dims: dict[str, float | None] = {}
    for d in dimensions:
        num = den = 0.0
        for q, s in zip(qs, scored):
            w = q.dimension_weights.get(d, 0.0)
            if w > 0:
                num += w * s.score
                den += w
        dims[d] = round(num / den, 1) if den else None

    overall = round(_clamp(overall), 1)
    return Report(overall=overall, level=level_for(overall), questions=scored, dimensions=dims)
