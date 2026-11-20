import pytest

from app.scoring.engine import (
    QuestionEval, compute_report, level_for, score_question, CRITERIA_WEIGHTS,
)
from app.specializations.catalog import all_specializations, DEFAULT_QUESTION_MIX, QUESTION_MIX_OVERRIDES


def q(pos, qtype="fundamentals", score=80, verdict="correct", dims=None, follow=None):
    return QuestionEval(pos, qtype, {c: score for c in ("correctness", "completeness", "depth", "relevance", "clarity")},
                        verdict, dims or {"A": 1.0}, follow)


def test_criteria_weights_sum_to_one():
    for qt, w in CRITERIA_WEIGHTS.items():
        assert abs(sum(w.values()) - 1.0) < 1e-9, qt


def test_levels():
    assert level_for(85) == "Excellent"
    assert level_for(84.9) == "Very Good"
    assert level_for(70) == "Very Good"
    assert level_for(55) == "Good"
    assert level_for(54.9) == "Needs Improvement"


def test_verdict_cap_and_contradiction():
    s = score_question(q(1, score=95, verdict="incorrect"))
    assert s.score == 35 and s.capped and s.contradictory
    s = score_question(q(1, score=30, verdict="correct"))
    assert s.contradictory
    assert not score_question(q(1, score=80, verdict="correct")).contradictory


def test_no_answer_is_zero():
    assert score_question(q(1, score=90, verdict="no_answer")).score == 0


def test_followup_blend():
    s = score_question(q(1, score=80, follow=40))
    assert s.score == pytest.approx(0.7 * 80 + 0.3 * 40, abs=0.1)


def test_overall_is_weighted_and_deterministic():
    qs = [q(1, "fundamentals", 100), q(2, "behavioral", 50, "partial")]
    r1, r2 = compute_report(qs, ["A"]), compute_report(qs, ["A"])
    assert r1.overall == r2.overall
    assert r1.overall == pytest.approx((1.0 * 100 + 0.8 * 50) / 1.8, abs=0.1)


def test_dimension_not_assessed_is_none_not_zero():
    r = compute_report([q(1, dims={"A": 1})], ["A", "B"])
    assert r.dimensions["A"] == 80 and r.dimensions["B"] is None


def test_duplicate_positions_rejected():
    with pytest.raises(ValueError):
        compute_report([q(1), q(1)], ["A"])


def test_catalog_has_64_unique_specializations():
    specs = all_specializations()
    assert len(specs) == 64
    assert len({s.slug for s in specs}) == 64


def test_every_spec_is_fully_configured():
    for s in all_specializations():
        assert s.description and s.tools and len(s.technical_topics) >= 6, s.slug
        assert len(s.evaluation_dimensions) == 6, s.slug
        assert len(set(s.evaluation_dimensions)) == 6, s.slug
        assert sum(s.question_categories.values()) == 10, s.slug


def test_dimensions_are_not_all_identical():
    dim_sets = {tuple(s.evaluation_dimensions) for s in all_specializations()}
    assert len(dim_sets) > 50


def test_overrides_sum_to_ten():
    assert sum(DEFAULT_QUESTION_MIX.values()) == 10
    for k, v in QUESTION_MIX_OVERRIDES.items():
        assert sum(v.values()) == 10, k
