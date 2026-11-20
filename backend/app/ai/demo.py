"""DEMO mode generators. Template-based and heuristic: NOT real AI.

Used only when no LLM provider is configured. Sessions produced this way are stored
with demo_mode=true and badged in the UI; nobody should treat their feedback as real.
"""
from __future__ import annotations

import re

from app.ai.schemas import AnswerTurn, EvalBody, FollowUp, PlannedQuestion, QuestionPlan
from app.specializations.catalog import SpecializationConfig

_TEMPLATES = {
    "fundamentals": "In {name}, explain what '{t}' means and why it matters in practice.",
    "deep_dive": "Go deeper on '{t}' in {name}: what are the main trade-offs or failure modes you would watch for?",
    "problem_solving": "You are asked to solve a problem involving '{t}' in {name}. Walk me through how you would approach it.",
    "scenario": "Describe a realistic situation in {name} where '{t}' became critical, and how you would handle it.",
    "critical_thinking": "A colleague claims '{t}' is always handled the same way in {name}. How would you evaluate that claim?",
    "behavioral": "Tell me about a time you had to explain a technical decision about '{t}' to someone less technical.",
}


def demo_plan(spec: SpecializationConfig, slots: list[str]) -> QuestionPlan:
    topics = spec.technical_topics
    qs = []
    for i, qtype in enumerate(slots):
        t = topics[i % len(topics)]
        words = [w for w in re.findall(r"[A-Za-z]{4,}", t.lower())][:3] or ["concept"]
        qs.append(PlannedQuestion(
            position=i + 1,
            text=_TEMPLATES[qtype].format(name=spec.name, t=t),
            reference_elements=[*words, "a concrete example"],
        ))
    return QuestionPlan(questions=qs)


def demo_turn(reference: list[str], answer: str, allow_followup: bool) -> AnswerTurn:
    """Heuristic only: scores by answer length and keyword overlap with the reference points."""
    tokens = set(re.findall(r"[a-z]{4,}", answer.lower()))
    ref_words = {w for r in reference for w in re.findall(r"[a-z]{4,}", r.lower())}
    overlap = len(tokens & ref_words) / max(1, len(ref_words))
    n_words = len(answer.split())
    length = min(1.0, n_words / 60)
    base = int(100 * (0.55 * overlap + 0.45 * length))
    score = max(0, min(100, base))
    verdict = "correct" if score >= 75 else "partial" if score >= 50 else "incomplete" if score >= 20 else "incorrect"
    followup = FollowUp(needed=allow_followup and verdict in ("partial", "incomplete"),
                        question="Can you give a concrete example of how that works in practice?"
                        if allow_followup and verdict in ("partial", "incomplete") else None)
    return AnswerTurn(
        evaluation=EvalBody(
            correctness=score, completeness=score, depth=max(0, score - 5), relevance=min(100, score + 5), clarity=score,
            verdict=verdict,
            did_well=[],
            missing=[],
            explanation="DEMO MODE: simulated score based on answer length and keyword overlap. Not real AI feedback.",
            expected_elements=list(reference),
            improved_answer="",
            tip="Configure an AI provider to get real, specific feedback.",
        ),
        followup=followup,
        reply="Thank you. [demo]",
    )
