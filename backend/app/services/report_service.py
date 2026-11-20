"""Finish an interview and build its report.

Everything numeric comes from the deterministic scoring engine. Strengths, weaknesses, recommendations and the
roadmap are derived from stored per-question evaluations (so each traces to real answers). The only LLM call is
the optional coach summary, which falls back to a template if unavailable.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.ai.prompts import coach_prompt
from app.ai.provider import LLMError, LLMProvider
from app.ai.schemas import CoachSummary
from app.db.models import (
    InterviewAnswer, InterviewReport, InterviewSession, LearningRoadmap, QuestionEvaluation, Recommendation,
    SkillEvaluation,
)
from app.scoring.dimensions import dimension_weights_for
from app.scoring.engine import QuestionEval, compute_report, level_for, score_question
from app.services.interview_engine import EngineError, _ordered, get_owned, get_specialization_by_id

log = logging.getLogger("mockview.report")

STRONG, WEAK = 70.0, 55.0


def _short(text: str, n: int = 110) -> str:
    """Trim at a word boundary, never mid-word."""
    text = " ".join(text.split())
    if len(text) <= n:
        return text
    return text[:n].rsplit(" ", 1)[0].rstrip(".,;:?! ") + "..."


def _eval_of(ev: QuestionEvaluation) -> dict[str, float]:
    return {"correctness": ev.correctness, "completeness": ev.completeness, "depth": ev.depth,
            "relevance": ev.relevance, "clarity": ev.clarity}


def _template_summary(overall: float, level_name: str, strengths: list[str], weaknesses: list[str], lang: str) -> str:
    if lang == "ar":
        return (f"حصلت على {overall:.0f}/100 ({level_name}) في هذه الجلسة التدريبية. "
                + (f"من نقاط قوتك: {strengths[0]}. " if strengths else "")
                + (f"أهم مجال للتحسين: {weaknesses[0]}. " if weaknesses else "")
                + "راجع الخطة المقترحة وأعد المحاولة بعد التدرب.")
    s = f"You scored {overall:.0f}/100 ({level_name}) in this practice session. "
    if strengths:
        s += f"A clear strength was {strengths[0]}. "
    if weaknesses:
        s += f"The most valuable area to work on is {weaknesses[0]}. "
    return s + "Follow the study plan below, then try another interview to see how you've progressed."


def finish_interview(db: Session, user_id: str, interview_id: str, provider: LLMProvider) -> dict:
    s = get_owned(db, user_id, interview_id)
    existing = db.query(InterviewReport).filter_by(session_id=s.id).one_or_none()
    if existing:
        return build_report_view(db, s)  # idempotent
    if s.status == "abandoned":
        raise EngineError(409, "This interview was ended early, so no report was generated.")
    qs, answers = _ordered(db, s)
    mains = [q for q in qs if not q.is_followup]
    if not s.intro_done or len(mains) != 10 or any(q.id not in answers for q in mains) \
            or any(q.is_followup and q.id not in answers for q in qs):
        raise EngineError(409, "Answer or skip every question before finishing the interview.")

    spec = get_specialization_by_id(db, s)
    dims = spec.evaluation_dimensions
    evals = {e.question_id: e for e in db.query(QuestionEvaluation).filter(
        QuestionEvaluation.question_id.in_([q.id for q in qs])).all()}
    fu_by_parent = {q.parent_question_id: q for q in qs if q.is_followup}

    inputs: list[QuestionEval] = []
    for q in mains:
        ev = evals[q.id]
        fu = fu_by_parent.get(q.id)
        fu_score = None
        if fu is not None:
            fe = evals[fu.id]
            fu_score = score_question(QuestionEval(fu.position, q.category, _eval_of(fe), fe.verdict, {})).score
        inputs.append(QuestionEval(q.position, q.category, _eval_of(ev), ev.verdict,
                                   dimension_weights_for(q.category, dims), fu_score))
    rep = compute_report(inputs, dims)
    score_by_pos = {sq.position: sq.score for sq in rep.questions}

    # ---- skills: evidence comes from the evaluations of the questions that fed each dimension
    skills: list[SkillEvaluation] = []
    for d in dims:
        feeding = [q for q, qi in zip(mains, inputs) if qi.dimension_weights.get(d, 0) > 0]
        sc = rep.dimensions[d]
        did, missing = [], []
        for q in feeding:
            ev = evals[q.id]
            did += ev.did_well[:2]
            if score_by_pos[q.position] < STRONG:
                missing += ev.missing[:2]
        skills.append(SkillEvaluation(
            session_id=s.id, skill=d, dimension_key=d, score=sc, level=level_for(sc) if sc is not None else None,
            supporting_question_ids=[q.id for q in feeding], evidence=[f"Q{q.position}: {score_by_pos[q.position]:.0f}/100"
                                                                         for q in feeding],
            strengths=did[:4], improvements=missing[:4]))
    assessed = [k for k in skills if k.score is not None]
    strengths = [{"skill": k.skill, "score": k.score, "evidence": k.strengths or k.evidence}
                 for k in sorted(assessed, key=lambda k: -k.score) if k.score >= STRONG][:4]
    weaknesses = [{"skill": k.skill, "score": k.score, "evidence": k.improvements or k.evidence}
                  for k in sorted(assessed, key=lambda k: k.score) if k.score < STRONG][:4]

    # ---- coach summary (only narrative; numbers are already final)
    st_names = [x["skill"] for x in strengths]
    wk_names = [x["skill"] for x in weaknesses]
    summary = _template_summary(rep.overall, rep.level, st_names, wk_names, s.language)
    if not s.demo_mode:
        try:
            system, user = coach_prompt(spec, s.level, s.language, rep.overall, rep.level, rep.dimensions,
                                        st_names, wk_names)
            summary = provider.complete_json(system, user, CoachSummary).summary.strip()
        except LLMError:
            log.warning("coach summary failed; using template", exc_info=True)

    report = InterviewReport(
        session_id=s.id, overall_score=rep.overall, level=rep.level, radar=rep.dimensions,
        strengths=strengths, weaknesses=weaknesses, coach_summary=summary,
        scoring_version=rep.scoring_version, demo_mode=s.demo_mode)
    db.add(report)
    db.add_all(skills)
    db.flush()

    # ---- recommendations: lowest-scoring main questions, grounded in what the evaluator found missing
    recs: list[Recommendation] = []
    weak_qs = sorted((q for q in mains if score_by_pos[q.position] < STRONG), key=lambda q: score_by_pos[q.position])[:6]
    for q in weak_qs:
        sc, ev = score_by_pos[q.position], evals[q.id]
        gaps = ev.missing[:3] or ev.expected_elements[:3]
        recs.append(Recommendation(
            report_id=report.id, priority="high" if sc < 40 else "medium" if sc < WEAK else "recommended",
            topic=f"Question {q.position}: {_short(q.text)}", explanation=ev.explanation or "This answer left gaps.",
            why_it_matters="Gaps here pulled down your score in: " + ", ".join(
                d for d, w in dimension_weights_for(q.category, dims).items()) + ".",
            related_question_id=q.id,
            activity=("Study and practice explaining: " + "; ".join(gaps)) if gaps else
                     "Re-read the model answer and explain it aloud in your own words.",
            expected_improvement="Being able to cover these points unprompted in a retry."))
    db.add_all(recs)
    plan = [{"step": i + 1, "focus": r.topic.rstrip(".?! "), "priority": r.priority, "activity": r.activity}
            for i, r in enumerate(recs)]
    db.add(LearningRoadmap(report_id=report.id, plan=plan))

    s.status, s.completed_at = "completed", datetime.now(timezone.utc)
    db.commit()
    return build_report_view(db, s)


def build_report_view(db: Session, s: InterviewSession) -> dict:
    report = db.query(InterviewReport).filter_by(session_id=s.id).one_or_none()
    if report is None:
        raise EngineError(404, "No report yet for this interview.")
    spec = get_specialization_by_id(db, s)
    qs, answers = _ordered(db, s)
    evals = {e.question_id: e for e in db.query(QuestionEvaluation).filter(
        QuestionEvaluation.question_id.in_([q.id for q in qs])).all()}
    fu_by_parent = {q.parent_question_id: q for q in qs if q.is_followup}

    def item(q):
        ev, a = evals[q.id], answers[q.id]
        return {"id": q.id, "question": q.text, "answer": a.text, "skipped": a.skipped, "score": ev.score,
                "verdict": ev.verdict, "did_well": ev.did_well, "missing": ev.missing,
                "incorrect_statements": ev.incorrect_statements, "explanation": ev.explanation,
                "expected_elements": ev.expected_elements, "improved_answer": ev.improved_answer, "tip": ev.tip}

    breakdown = []
    for q in (x for x in qs if not x.is_followup):
        d = item(q)
        fu = fu_by_parent.get(q.id)
        d.update(position=q.position, category=q.category, followup=item(fu) if fu else None)
        breakdown.append(d)
    skills = db.query(SkillEvaluation).filter_by(session_id=s.id).all()
    order = {n: i for i, n in enumerate(spec.evaluation_dimensions)}
    recs = db.query(Recommendation).filter_by(report_id=report.id).all()
    prio = {"high": 0, "medium": 1, "recommended": 2}
    roadmap = db.query(LearningRoadmap).filter_by(report_id=report.id).one()
    return {
        "id": s.id, "specialization": spec.name, "level": s.level, "difficulty": s.difficulty,
        "language": s.language, "mode": s.mode, "completed_at": s.completed_at, "demo_mode": report.demo_mode, "retry_of_id": s.retry_of_id,
        "can_practice": bool(recs),
        "overall_score": report.overall_score, "performance_level": report.level,
        "scoring_version": report.scoring_version, "radar": report.radar,
        "strengths": report.strengths, "weaknesses": report.weaknesses, "coach_summary": report.coach_summary,
        "skills": [{"skill": k.skill, "score": k.score, "level": k.level, "evidence": k.evidence,
                    "strengths": k.strengths, "improvements": k.improvements}
                   for k in sorted(skills, key=lambda k: order.get(k.dimension_key, 99))],
        "questions": breakdown,
        "recommendations": [{"priority": r.priority, "topic": r.topic, "explanation": r.explanation,
                             "why_it_matters": r.why_it_matters, "activity": r.activity,
                             "expected_improvement": r.expected_improvement}
                            for r in sorted(recs, key=lambda r: prio[r.priority])],
        "roadmap": roadmap.plan,
    }


def start_practice(db: Session, user_id: str, interview_id: str, provider: LLMProvider) -> InterviewSession:
    """New full interview that targets the weak areas of a finished one (same settings, linked to it)."""
    from app.db.models import JobDescription, UploadedResume
    from app.schemas.interview import InterviewConfig
    from app.services.interview_engine import create_interview

    s = get_owned(db, user_id, interview_id)
    report = db.query(InterviewReport).filter_by(session_id=s.id).one_or_none()
    if report is None:
        raise EngineError(409, "Finish the interview and view its report before practicing its weak areas.")
    recs = db.query(Recommendation).filter_by(report_id=report.id).all()
    if not recs:
        raise EngineError(422, "Nothing to practice: no weak questions in that report. Try a harder difficulty instead.")

    focus = [f"Weak skill: {w['skill']} (scored {w['score']:.0f})" for w in report.weaknesses]
    for r in recs[:6]:
        ev = db.query(QuestionEvaluation).filter_by(question_id=r.related_question_id).one_or_none()
        gaps = (ev.missing[:2] or ev.expected_elements[:2]) if ev else []
        if gaps:
            focus.append("Missed earlier: " + "; ".join(g[:120] for g in gaps))
    spec = get_specialization_by_id(db, s)
    jd = db.get(JobDescription, s.job_description_id) if s.job_description_id else None
    resume = db.get(UploadedResume, s.resume_id) if s.resume_id else None
    cfg = InterviewConfig(
        specialization_slug=spec.slug, level=s.level, difficulty=s.difficulty, language=s.language, mode=s.mode,
        duration_min=s.duration_min or 30, personality=s.personality_id, interviewer_experience=s.interviewer_experience,
        avatar_id=s.avatar_id, target_job_title=jd.title if jd else None, job_description=jd.body if jd else None,
        custom_instructions=s.custom_instructions, resume_id=resume.id if resume and not resume.deleted_at else None)
    return create_interview(db, user_id, cfg, provider, retry_of=s.id, focus=focus[:10])
