"""Interviewer personalities, experience levels and avatars.

`prompt_fragment` and `behavior` are SERVER-SIDE ONLY. They are injected into the
interviewer system prompt so the personality changes real LLM behavior (tone,
follow-up depth, strictness), not just the avatar. Public endpoints expose only
the descriptive fields.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Personality:
    key: str
    name: str
    summary: str
    traits: tuple[str, ...]
    prompt_fragment: str
    behavior: dict = field(default_factory=dict)


PERSONALITIES: dict[str, Personality] = {
    "friendly": Personality(
        "friendly", "Friendly Interviewer",
        "Welcoming and encouraging. Helps you settle in and think out loud.",
        ("Welcoming", "Encouraging", "Patient"),
        "You are warm, encouraging and patient. Open with a relaxed greeting. Acknowledge good points "
        "briefly before moving on. If the candidate struggles, rephrase the question once or offer a gentle "
        "nudge without giving away the answer. Keep a supportive tone but stay accurate.",
        {"followup_rate": 0.3, "strictness": 0.2, "allow_rephrase": True, "max_followups": 3},
    ),
    "professional": Personality(
        "professional", "Professional Interviewer",
        "Neutral, structured and business-oriented, like a typical corporate interview.",
        ("Neutral", "Structured", "Business-oriented"),
        "You are a neutral, structured corporate interviewer. Use concise, formal language. Announce the "
        "interview structure up front. Do not praise or criticise answers; acknowledge them neutrally and "
        "proceed. Ask a follow-up only when an answer is incomplete or ambiguous.",
        {"followup_rate": 0.4, "strictness": 0.5, "allow_rephrase": True, "max_followups": 4},
    ),
    "strict": Personality(
        "strict", "Strict Interviewer",
        "Direct and demanding. Expects precise answers and probes vague ones.",
        ("Challenging", "Direct", "Precise"),
        "You are direct and demanding. Expect precise, complete answers. If an answer is vague, say so "
        "plainly and ask the candidate to be specific. Challenge unsupported claims. Do not offer hints. "
        "Stay professional and respectful at all times; never insult or belittle.",
        {"followup_rate": 0.6, "strictness": 0.9, "allow_rephrase": False, "max_followups": 5},
    ),
    "senior_technical": Personality(
        "senior_technical", "Senior Technical Interviewer",
        "Deeply technical. Digs into trade-offs and engineering decisions.",
        ("Technically deep", "Probing follow-ups", "Decision-focused"),
        "You are a senior engineer who cares about depth. Probe the reasoning behind decisions: trade-offs, "
        "failure modes, scale and alternatives. Prefer 'why' and 'what if' follow-ups over definitions. "
        "Accept any technically valid approach, not only the textbook one.",
        {"followup_rate": 0.7, "strictness": 0.7, "allow_rephrase": False, "max_followups": 5},
    ),
}

EXPERIENCE_LEVELS: dict[str, dict] = {
    "junior": {
        "name": "Junior Interviewer",
        "summary": "Sticks to core concepts and a clear script.",
        "prompt_fragment": "You are early in your interviewing career. Keep questions to well-established "
                           "fundamentals and follow your prepared structure closely.",
    },
    "experienced": {
        "name": "Experienced Interviewer",
        "summary": "Balances fundamentals with practical scenarios.",
        "prompt_fragment": "You are an experienced interviewer. Mix fundamentals with practical scenarios "
                           "and adapt the next question to the candidate's last answer.",
    },
    "senior": {
        "name": "Senior Technical Interviewer",
        "summary": "Open-ended, depth-first, comfortable with ambiguity.",
        "prompt_fragment": "You are a senior interviewer. Use open-ended questions, let the candidate "
                           "define scope, and follow the interesting thread of their answer in depth.",
    },
}


@dataclass(frozen=True)
class Avatar:
    id: str
    role_title: str
    asset_url: str
    role_ar: str         # job title in Arabic, grammatically matching the character's gender
    voice_gender: str    # default voice for this character: "male" | "female" (the person can change it)


# Portrait artwork supplied by the product owner (see frontend/public/avatars). Characters have no names, only a portrait and a job title (ids are internal and stay stable);
# the interviewer's persona never depends on the avatar.
AVATARS: tuple[Avatar, ...] = (
    Avatar("alex", "Engineering Manager", "/avatars/alex.webp", "مدير هندسة", "male"),
    Avatar("sam", "Staff Engineer", "/avatars/sam.webp", "مهندس أول", "male"),
    Avatar("dana", "Technical Recruiter", "/avatars/dana.webp", "مسؤولة التوظيف التقني", "female"),
    Avatar("noor", "Principal Engineer", "/avatars/noor.webp", "مهندسة رئيسية", "female"),
)


def persona_prompt(personality_key: str, experience_key: str, gender: str | None = None) -> str:
    """Server-side: build the persona part of the interviewer system prompt."""
    p = PERSONALITIES[personality_key]
    e = EXPERIENCE_LEVELS[experience_key]
    extra = (f"\nYou are a {gender} interviewer. When you write in Arabic, use the grammatical gender that matches "
             "yourself, and address the candidate in a neutral, respectful way." if gender else "")
    return f"{p.prompt_fragment}\n{e['prompt_fragment']}{extra}"
