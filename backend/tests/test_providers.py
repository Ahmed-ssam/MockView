import httpx
import pytest

from app.ai import provider as P
from app.ai.schemas import CoachSummary


class FakeResp:
    def __init__(self, status=200, body=None, text=""):
        self.status_code, self._body, self.text = status, body, text or str(body)

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


def capture(monkeypatch, resp):
    seen = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        seen.update(url=url, headers=headers, body=json)
        if isinstance(resp, Exception):
            raise resp
        return resp
    monkeypatch.setattr(P.httpx, "post", fake_post)
    return seen


GOOD = {"candidates": [{"content": {"parts": [{"text": '{"summary": "You did well and have one clear next step."}'}]}}]}


@pytest.fixture(autouse=True)
def _clear_host_memory():
    P._WORKING_BASE.clear()


def test_aq_key_is_tried_on_the_ai_studio_host_first_with_header_auth(monkeypatch):
    seen = capture(monkeypatch, FakeResp(200, GOOD))
    out = P.GeminiProvider("AQ.secretkey123", "gemini-2.5-flash").complete_json("sys", "usr", CoachSummary)
    assert out.summary.startswith("You did well")
    assert seen["url"] == "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    assert seen["headers"] == {"x-goog-api-key": "AQ.secretkey123"}
    assert "secretkey123" not in seen["url"]                      # never in the URL
    assert seen["body"]["systemInstruction"]["parts"][0]["text"] == "sys"
    assert seen["body"]["generationConfig"]["responseMimeType"] == "application/json"


def test_ai_studio_key_uses_generativelanguage_host(monkeypatch):
    seen = capture(monkeypatch, FakeResp(200, GOOD))
    P.GeminiProvider("AIzaSyXXXX", "gemini-2.5-flash").complete("s", "u")
    assert seen["url"].startswith("https://generativelanguage.googleapis.com/v1beta/models/")
    seen = capture(monkeypatch, FakeResp(200, GOOD))
    P.GeminiProvider("AIzaSyXXXX", "m", base_url="https://proxy.example/v1/").complete("s", "u")
    assert seen["url"] == "https://proxy.example/v1/models/m:generateContent"


@pytest.mark.parametrize("make", [
    lambda: P.GeminiProvider("AQ.k", "m"),
    lambda: P.OpenAICompatibleProvider("https://x/v1", "AQ.k", "m"),
    lambda: P.AnthropicProvider("AQ.k", "m"),
])
def test_every_failure_becomes_llm_error_and_never_leaks_the_key(monkeypatch, make):
    for resp in (FakeResp(403, None, text="API key AQ.k is not allowed"), httpx.ConnectTimeout("t"),
                 FakeResp(200, None), FakeResp(200, {"unexpected": 1})):
        capture(monkeypatch, resp)
        with pytest.raises(P.LLMError) as e:
            make().complete("s", "u")
        assert "AQ.k" not in str(e.value)


def test_blocked_and_empty_answers(monkeypatch):
    capture(monkeypatch, FakeResp(200, {"promptFeedback": {"blockReason": "SAFETY"}}))
    with pytest.raises(P.LLMError, match="blocked: SAFETY"):
        P.GeminiProvider("AQ.k", "m").complete("s", "u")
    capture(monkeypatch, FakeResp(200, {"candidates": [{"content": {"parts": [{"text": "  "}]}}]}))
    with pytest.raises(P.LLMError, match="empty"):
        P.GeminiProvider("AQ.k", "m").complete("s", "u")


def test_get_provider_selects_gemini(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini"); monkeypatch.setenv("LLM_API_KEY", "AQ.k")
    monkeypatch.delenv("LLM_MODEL", raising=False); monkeypatch.delenv("LLM_BASE_URL", raising=False)
    p = P.get_provider()
    assert p.name == "gemini" and p.model == "gemini-2.5-flash" and "generativelanguage" in p.base


def test_invalid_json_is_retried_then_reported(monkeypatch):
    bad = {"candidates": [{"content": {"parts": [{"text": "not json at all"}]}}]}
    seen = capture(monkeypatch, FakeResp(200, bad))
    with pytest.raises(P.LLMError, match="invalid JSON"):
        P.GeminiProvider("AQ.k", "m").complete_json("s", "u", CoachSummary, retries=1)


def test_aq_key_falls_back_to_vertex_and_remembers_the_working_host(monkeypatch):
    urls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        urls.append(url)
        return FakeResp(403, None, text="not allowed") if "generativelanguage" in url else FakeResp(200, GOOD)
    monkeypatch.setattr(P.httpx, "post", fake_post)
    P.GeminiProvider("AQ.vertexkey123", "m").complete("s", "u")
    assert [u.split("/")[2] for u in urls] == ["generativelanguage.googleapis.com", "aiplatform.googleapis.com"]
    urls.clear()
    P.GeminiProvider("AQ.vertexkey123", "m").complete("s", "u")           # second call goes straight to the host that worked
    assert [u.split("/")[2] for u in urls] == ["aiplatform.googleapis.com"]


def test_aq_key_rejected_everywhere_reports_the_first_hosts_reason(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        return FakeResp(401, None, text="studio says no") if "generativelanguage" in url else FakeResp(403, None, text="vertex says no")
    monkeypatch.setattr(P.httpx, "post", fake_post)
    with pytest.raises(P.LLMError) as e:
        P.GeminiProvider("AQ.badkey12345", "m").complete("s", "u")
    assert "401" in str(e.value) and "badkey12345" not in str(e.value)


def test_quota_error_is_not_retried_on_another_host(monkeypatch):
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append(url)
        return FakeResp(429, None, text="slow down")
    monkeypatch.setattr(P.httpx, "post", fake_post)
    with pytest.raises(P.LLMError):
        P.GeminiProvider("AQ.quotakey123", "m").complete("s", "u")
    assert len(calls) == 1
