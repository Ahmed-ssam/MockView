"""Interview engine: session creation, question planning, adaptive turn handling.

Rules enforced here (not left to the model):
  * exactly 10 main questions per session, fixed at creation, types follow the specialization's mix
  * follow-ups never replace or add main questions; max 1 per main question, max MAX_FOLLOWUPS per interview
  * evaluation scores come from the deterministic scoring engine, never from the LLM's own number
  * hidden reference points and scores are never returned while the interview is running
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.ai.demo import demo_plan, demo_turn
from app.ai.prompts import intro_prompt, plan_prompt, turn_prompt
from app.ai.provider import LLMError, LLMProvider
from app.ai.schemas import AnswerTurn, EvalBody, FollowUp, IntroReply, QuestionPlan
from app.db.models import (
    InterviewAnswer, InterviewQuestion, InterviewSession, JobDescription, QuestionEvaluation, UsageEvent,
)
from app.interviewers.data import AVATARS, PERSONALITIES, persona_prompt
from app.schemas.interview import InterviewConfig
from app.schemas.views import AnswerResult, InterviewerOut, InterviewView, MessageOut, Progress, QuestionOut
from app.scoring.engine import QuestionEval, score_question
from app.services.seed import ensure_interviewer_refs, ensure_profile, ensure_specialization
from app.specializations.catalog import SpecializationConfig, get_specialization

log = logging.getLogger("mockview.engine")

TOTAL_MAIN = 10
MAX_FOLLOWUPS = 5
TYPE_ORDER = ("fundamentals", "deep_dive", "problem_solving", "scenario", "critical_thinking", "behavioral")


class EngineError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def daily_limit() -> int:
    return int(os.getenv("DAILY_INTERVIEW_LIMIT", "3"))


def global_daily_limit() -> int:
    """Cap on interviews started by ALL users per UTC day: a hard ceiling on AI spend. 0 disables it."""
    return int(os.getenv("GLOBAL_DAILY_INTERVIEW_LIMIT", "300"))


def slots_for(spec: SpecializationConfig) -> list[str]:
    slots = [t for t in TYPE_ORDER for _ in range(spec.question_categories.get(t, 0))]
    assert len(slots) == TOTAL_MAIN, f"{spec.slug}: question mix must total {TOTAL_MAIN}"
    return slots


# ---------------------------------------------------------------- text templates
_INTRO = {
    "en": "Hello, and welcome! I'll be interviewing you today. It's really nice to meet you, and thank you for making "
          "the time. This is a {minutes}-minute practice interview for {field}. We'll start with a short introduction, "
          "then I'll ask you 10 main questions, and sometimes a follow-up when I'd like to hear more of your "
          "thinking. Take your time, and feel free to ask me to repeat anything.",
    "ar": "مرحباً وأهلاً بك! سأتولى مقابلتك اليوم، ويسعدني لقاؤك، وشكراً لأنك خصصت وقتك لهذه المقابلة. هذه مقابلة "
          "تدريبية مدتها {minutes} دقيقة في مجال {field}. سنبدأ بتعريف قصير، ثم نتناول 10 أسئلة رئيسية، "
          "وأحياناً سؤال متابعة لأسمع المزيد عن طريقة تفكيرك. خذ وقتك، ويمكنك أن تطلب إعادة أي سؤال.",
}
_INTRO_Q = {
    "en": "To begin, could you tell me a little about yourself: your background, the work you've done, "
          "and what brought you to {field}?",
    "ar": "لنبدأ، هل يمكنك أن تحدثني قليلاً عن نفسك: خلفيتك، والأعمال التي قمت بها، وما الذي جذبك إلى مجال {field}؟",
}
_INTRO_REPLY_FALLBACK = {
    "en": "Thank you for sharing that, it's really helpful to hear. Let's move on to the questions.",
    "ar": "شكراً لمشاركتك، هذا مفيد جداً. لننتقل إلى الأسئلة.",
}
_INTRO_EXTRA = {
    "friendly": {"en": " Relax, there are no trick questions here.", "ar": " لا تقلق، لا توجد أسئلة مخادعة هنا."},
    "professional": {"en": "", "ar": ""},
    "strict": {"en": " Please keep your answers precise and specific.", "ar": " أرجو أن تكون إجاباتك دقيقة ومحددة."},
    "senior_technical": {"en": " I'm as interested in your reasoning and trade-offs as in the final answer.",
                         "ar": " يهمني منطق تفكيرك والمفاضلات بقدر اهتمامي بالإجابة النهائية."},
}
_CLOSING = {"en": "That was the last question. Thank you. Your answers are ready to be evaluated.",
            "ar": "كان هذا آخر سؤال. شكراً لك، إجاباتك جاهزة للتقييم."}
_SKIP_REPLY = {"en": "No problem, let's move on.", "ar": "لا بأس، لننتقل."}


def _gender(s: InterviewSession) -> str:
    return next(a for a in AVATARS if a.id == s.avatar_id).voice_gender


def _intro(s: InterviewSession, spec_name: str) -> str:
    av = next(a for a in AVATARS if a.id == s.avatar_id)
    pk = s.personality_id
    return (_INTRO[s.language].format( minutes=s.duration_min, field=spec_name)
            + _INTRO_EXTRA[pk][s.language])


# ---------------------------------------------------------------- creation
def create_interview(db: Session, user_id: str, cfg: InterviewConfig, provider: LLMProvider, *,
                     retry_of: str | None = None, focus: list[str] | None = None) -> InterviewSession:
    spec = get_specialization(cfg.specialization_slug)
    assert spec is not None  # validated by InterviewConfig

    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today = db.query(UsageEvent).filter(UsageEvent.created_at >= start_of_day)
    from app.core.local import local_mode
    if not local_mode() and today.filter(UsageEvent.user_id == user_id).count() >= daily_limit():
        raise EngineError(429, f"Daily limit of {daily_limit()} interviews reached. Please come back tomorrow.")
    if not local_mode() and global_daily_limit() and today.count() >= global_daily_limit():
        raise EngineError(503, "MockView has reached its capacity for today. Please try again tomorrow.")

    resume = None
    if cfg.resume_id:
        from app.services import resume_service
        resume = resume_service.get_owned(db, user_id, cfg.resume_id)  # 404 unless it is the caller's own

    slots = slots_for(spec)
    demo = provider.is_demo
    if demo:
        plan = demo_plan(spec, slots)
    else:
        system, user = plan_prompt(spec, cfg.level, cfg.difficulty, cfg.language, slots,
                                   cfg.target_job_title, cfg.job_description, cfg.custom_instructions,
                                   (resume.parsed or {}).get("text") if resume else None, focus)
        t0 = time.monotonic()
        plan = provider.complete_json(system, user, QuestionPlan)  # raises LLMError; nothing is saved
        log.info("plan generated in %d ms", (time.monotonic() - t0) * 1000)

    ensure_profile(db, user_id)
    spec_row = ensure_specialization(db, spec)
    ensure_interviewer_refs(db, cfg.personality, cfg.avatar_id)

    jd_id = None
    if cfg.job_description:
        jd = JobDescription(user_id=user_id, title=cfg.target_job_title, body=cfg.job_description)
        db.add(jd)
        db.flush()
        jd_id = jd.id

    s = InterviewSession(
        user_id=user_id, specialization_id=spec_row.id, level=cfg.level, difficulty=cfg.difficulty,
        language=cfg.language, mode=cfg.mode, duration_min=cfg.duration_min, personality_id=cfg.personality,
        avatar_id=cfg.avatar_id, interviewer_experience=cfg.interviewer_experience, job_description_id=jd_id, resume_id=resume.id if resume else None,
        custom_instructions=cfg.custom_instructions, demo_mode=demo, retry_of_id=retry_of,
    )
    db.add(s)
    db.add(UsageEvent(user_id=user_id))
    db.flush()
    for pq in sorted(plan.questions, key=lambda q: q.position):
        # question TYPE comes from the fixed slot order, not from the model
        db.add(InterviewQuestion(session_id=s.id, position=pq.position, is_followup=False,
                                 category=slots[pq.position - 1], text=pq.text.strip(),
                                 reference_elements=[r.strip() for r in pq.reference_elements]))
    db.commit()
    db.refresh(s)
    return s


# ---------------------------------------------------------------- state
def _ordered(db: Session, s: InterviewSession) -> tuple[list[InterviewQuestion], dict[str, InterviewAnswer]]:
    qs = sorted(db.query(InterviewQuestion).filter_by(session_id=s.id).all(), key=lambda q: (q.position, q.is_followup))
    answers = {a.question_id: a for a in db.query(InterviewAnswer).filter(
        InterviewAnswer.question_id.in_([q.id for q in qs])).all()} if qs else {}
    return qs, answers


def _qout(q: InterviewQuestion | None) -> QuestionOut | None:
    if q is None:
        return None
    return QuestionOut(id=q.id, position=q.position, text=q.text, is_followup=q.is_followup,
                       kind="followup" if q.is_followup else "main")


def build_view(db: Session, s: InterviewSession) -> InterviewView:
    spec = get_specialization_by_id(db, s)
    qs, answers = _ordered(db, s)
    current = next((q for q in qs if q.id not in answers), None)

    intro_q_text = _INTRO_Q[s.language].format(field=spec.name)
    messages = [MessageOut(role="interviewer", text=_intro(s, spec.name)),
                MessageOut(role="interviewer", text=intro_q_text, question_id="intro")]
    if not s.intro_done:
        # Warm-up phase: later questions stay hidden until the introduction is answered or skipped.
        current_out: QuestionOut | None = QuestionOut(id="intro", position=0, text=intro_q_text,
                                                      is_followup=False, kind="intro")
    else:
        current_out = _qout(current)
        messages.append(MessageOut(role="candidate", text=s.candidate_intro or "(Skipped)", question_id="intro"))
        if s.intro_reply:
            messages.append(MessageOut(role="interviewer", text=s.intro_reply, question_id="intro"))
        for q in qs:
            messages.append(MessageOut(role="interviewer", text=q.text, question_id=q.id))
            a = answers.get(q.id)
            if a is None:
                break
            messages.append(MessageOut(role="candidate", text="(Skipped)" if a.skipped else a.text, question_id=q.id))
            if a.reply:
                messages.append(MessageOut(role="interviewer", text=a.reply, question_id=q.id))
        if current is None:
            messages.append(MessageOut(role="interviewer", text=_CLOSING[s.language]))

    av = next(a for a in AVATARS if a.id == s.avatar_id)
    answered_main = sum(1 for q in qs if not q.is_followup and q.id in answers)
    return InterviewView(
        id=s.id, status=s.status, demo_mode=s.demo_mode, specialization_slug=spec.slug,
        specialization_name=spec.name, level=s.level, difficulty=s.difficulty, language=s.language,
        duration_min=s.duration_min, mode=s.mode,
        interviewer=InterviewerOut(role_title=av.role_ar if s.language == "ar" else av.role_title,
                                   avatar_url=av.asset_url, personality=PERSONALITIES[s.personality_id].name,
                                   voice_gender=av.voice_gender),
        progress=Progress(answered_main=answered_main,
                          current_position=current_out.position if current_out else None),
        current_question=current_out, messages=messages, ready_to_finish=s.intro_done and current is None,
        started_at=s.started_at,
    )


def get_specialization_by_id(db: Session, s: InterviewSession) -> SpecializationConfig:
    from app.db.models import Specialization
    row = db.get(Specialization, s.specialization_id)
    spec = get_specialization(row.slug)
    assert spec is not None
    return spec


def get_owned(db: Session, user_id: str, interview_id: str) -> InterviewSession:
    s = db.get(InterviewSession, interview_id)
    if s is None or s.user_id != user_id:
        raise EngineError(404, "Interview not found")  # same answer for "missing" and "not yours"
    return s


def abandon(db: Session, user_id: str, interview_id: str) -> InterviewView:
    s = get_owned(db, user_id, interview_id)
    if s.status == "in_progress":
        s.status = "abandoned"
        s.completed_at = datetime.now(timezone.utc)
        db.commit()
    return build_view(db, s)


# ---------------------------------------------------------------- answering
def _skipped_turn(reference: list[str]) -> AnswerTurn:
    return AnswerTurn(evaluation=EvalBody(
        correctness=0, completeness=0, depth=0, relevance=0, clarity=0, verdict="no_answer",
        explanation="This question was skipped.", expected_elements=list(reference)))


def _llm_turn(provider: LLMProvider, spec: SpecializationConfig, s: InterviewSession, q: InterviewQuestion,
              answer: str, parent: tuple[str, str] | None, reference: list[str], allow_followup: bool) -> AnswerTurn:
    persona = persona_prompt(s.personality_id, s.interviewer_experience, _gender(s))
    system, user = turn_prompt(spec, s.level, s.difficulty, s.language, persona, q.category,
                               q.text, reference, answer, parent, allow_followup)
    if s.candidate_intro:  # context for a personal tone only; the prompt forbids scoring against it
        system, user = turn_prompt(spec, s.level, s.difficulty, s.language, persona, q.category, q.text,
                                   reference, answer, parent, allow_followup, background=s.candidate_intro)
    turn = provider.complete_json(system, user, AnswerTurn)
    if score_question(_qe(q, turn)).contradictory:
        log.info("contradictory evaluation for question %s; re-evaluating once", q.id)
        turn = provider.complete_json(
            system, user + "\nYour previous evaluation was internally inconsistent (the verdict did not match the "
                           "scores). Re-evaluate carefully and keep them consistent.", AnswerTurn)
    return turn


def _qe(q: InterviewQuestion, turn: AnswerTurn) -> QuestionEval:
    e = turn.evaluation
    return QuestionEval(position=q.position, qtype=q.category, verdict=e.verdict, dimension_weights={},
                        criteria={"correctness": e.correctness, "completeness": e.completeness,
                                  "depth": e.depth, "relevance": e.relevance, "clarity": e.clarity})


def _submit_intro(db: Session, s: InterviewSession, spec: SpecializationConfig, text: str, skipped: bool,
                  provider: LLMProvider) -> AnswerResult:
    """Warm-up: store the introduction, react to it warmly, move on. Never scored, never counted."""
    fallback = _INTRO_REPLY_FALLBACK[s.language]
    if skipped:
        intro, reply = None, _SKIP_REPLY[s.language]
    else:
        intro = text[:3000]
        if s.demo_mode:
            reply = fallback + " [demo]"
        else:
            try:
                system, user = intro_prompt(spec, s.level, s.language,
                                            persona_prompt(s.personality_id, s.interviewer_experience, _gender(s)), intro)
                reply = provider.complete_json(system, user, IntroReply).reply.strip()
            except LLMError:
                # Purely a courtesy line: a neutral template is fine here (nothing is scored from it).
                log.warning("intro reply generation failed; using the neutral template", exc_info=True)
                reply = fallback
    s.candidate_intro, s.intro_reply, s.intro_done = intro, reply, True
    db.commit()
    view = build_view(db, s)
    return AnswerResult(interviewer_message=reply, next_question=view.current_question, progress=view.progress,
                        ready_to_finish=view.ready_to_finish, demo_mode=s.demo_mode)


def submit_answer(db: Session, user_id: str, interview_id: str, text: str, skipped: bool, source: str,
                  provider: LLMProvider) -> AnswerResult:
    s = get_owned(db, user_id, interview_id)
    if s.status != "in_progress":
        raise EngineError(409, "This interview is already finished.")
    text = text.strip()
    if not skipped and not text:
        raise EngineError(422, "Please type an answer or choose to skip.")

    spec = get_specialization_by_id(db, s)
    if not s.intro_done:
        return _submit_intro(db, s, spec, text, skipped, provider)
    qs, answers = _ordered(db, s)
    q = next((x for x in qs if x.id not in answers), None)
    if q is None:
        raise EngineError(409, "All questions are answered. Finish the interview to see your report.")

    parent_q = next((x for x in qs if x.id == q.parent_question_id), None)
    parent = (parent_q.text, answers[parent_q.id].text) if parent_q is not None else None
    reference = list((parent_q or q).reference_elements or [])
    n_followups = sum(1 for x in qs if x.is_followup)
    # The interviewer's personality really changes the interview: gentler interviewers probe less often.
    cap = min(MAX_FOLLOWUPS, PERSONALITIES[s.personality_id].behavior.get("max_followups", MAX_FOLLOWUPS))
    allow_followup = (not q.is_followup) and (not skipped) and n_followups < cap

    if skipped:
        turn = _skipped_turn(reference)
    elif s.demo_mode:
        turn = demo_turn(reference, text, allow_followup)
    else:
        turn = _llm_turn(provider, spec, s, q, text, parent, reference, allow_followup)  # may raise LLMError

    scored = score_question(_qe(q, turn))
    e = turn.evaluation
    reply = _SKIP_REPLY[s.language] if skipped else (turn.reply.strip() or None)

    db.add(InterviewAnswer(question_id=q.id, text=text or "(skipped)", transcript_source=source,
                           reply=reply, skipped=skipped))
    db.add(QuestionEvaluation(
        question_id=q.id, correctness=e.correctness, completeness=e.completeness, depth=e.depth,
        relevance=e.relevance, clarity=e.clarity, verdict=e.verdict, score=scored.score,
        did_well=e.did_well, missing=e.missing, incorrect_statements=e.incorrect_statements,
        explanation=e.explanation, expected_elements=e.expected_elements or reference,
        improved_answer=e.improved_answer, tip=e.tip))

    fu: FollowUp = turn.followup
    if allow_followup and fu.needed and fu.question and e.verdict != "no_answer":
        db.add(InterviewQuestion(session_id=s.id, position=q.position, parent_question_id=q.id, is_followup=True,
                                 category=q.category, text=fu.question, reference_elements=reference))
    db.commit()

    view = build_view(db, s)
    return AnswerResult(
        interviewer_message=reply or "", next_question=view.current_question, progress=view.progress,
        ready_to_finish=view.ready_to_finish, demo_mode=s.demo_mode)
