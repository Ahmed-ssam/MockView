import json
import os
import stat

import pytest
from starlette.testclient import TestClient

from app.ai.provider import DemoProvider, GeminiProvider, LLMError, get_provider
from app.core import local
from app.core.security import get_current_user
from app.main import app

KEY = "AIzaSyTestKeyTestKeyTestKey1234567890"


@pytest.fixture
def lm(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_MODE", "1")
    monkeypatch.setenv("MOCKVIEW_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LLM_PROVIDER", "demo")
    return TestClient(app)


def test_settings_are_404_outside_local_mode(monkeypatch):
    monkeypatch.delenv("LOCAL_MODE", raising=False)
    assert TestClient(app).get("/api/v1/settings").status_code == 404
    assert TestClient(app).get("/api/v1/config").json() == {"local_mode": False}


def test_config_reports_local_mode(lm):
    assert lm.get("/api/v1/config").json() == {"local_mode": True}


def test_no_key_means_demo_and_saved_key_means_gemini(lm):
    assert lm.get("/api/v1/settings").json()["provider"] == "demo"
    assert isinstance(get_provider(), DemoProvider)
    r = lm.put("/api/v1/settings", json={"api_key": f"  {KEY}  ", "model": "gemini-2.5-flash"})
    assert r.status_code == 200 and r.json()["key_set"] and r.json()["key_hint"] == "…7890"
    assert KEY not in r.text and KEY not in lm.get("/api/v1/settings").text   # key is never echoed back
    p = get_provider()
    assert isinstance(p, GeminiProvider) and p.api_key == KEY and not p.is_demo
    assert lm.delete("/api/v1/settings/key").json()["provider"] == "demo"
    assert isinstance(get_provider(), DemoProvider)


def test_key_file_is_private_and_input_is_validated(lm, tmp_path):
    lm.put("/api/v1/settings", json={"api_key": KEY})
    f = tmp_path / "settings.json"
    assert json.loads(f.read_text())["api_key"] == KEY
    if os.name == "posix":
        assert stat.S_IMODE(f.stat().st_mode) == 0o600
    assert lm.put("/api/v1/settings", json={"api_key": "short"}).status_code == 422
    assert lm.put("/api/v1/settings", json={"api_key": "a b " * 10}).status_code == 422
    assert lm.put("/api/v1/settings", json={"model": "../../etc"}).status_code == 422


def test_test_button_reports_success_and_failure(lm, monkeypatch):
    monkeypatch.setattr(GeminiProvider, "complete", lambda self, s, u, max_tokens=0: '{"ok": true}')
    assert lm.post("/api/v1/settings/test", json={"api_key": KEY}).json()["ok"] is True

    def boom(self, s, u, max_tokens=0):
        raise LLMError("provider error 403")
    monkeypatch.setattr(GeminiProvider, "complete", boom)
    r = lm.post("/api/v1/settings/test", json={"api_key": KEY}).json()
    assert r["ok"] is False and "403" in r["message"] and "Google rejected this key" in r["message"] and KEY not in r["message"]
    assert lm.post("/api/v1/settings/test", json={}).json()["ok"] is False      # nothing typed, nothing saved


def test_local_user_needs_no_token(lm):
    u = get_current_user(None)
    assert u.id == local.LOCAL_USER_ID and u.role == "user"          # never admin


def test_without_local_mode_a_token_is_still_required(monkeypatch):
    monkeypatch.delenv("LOCAL_MODE", raising=False)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e:
        get_current_user(None)
    assert e.value.status_code == 401


def test_requests_for_other_hostnames_are_refused(lm):
    bad = TestClient(app, base_url="http://evil.example.com")
    assert bad.get("/api/v1/config").status_code == 400
    assert lm.get("/api/v1/config").status_code == 200


def test_limits_are_off_in_local_mode(lm, monkeypatch):
    monkeypatch.setenv("DAILY_INTERVIEW_LIMIT", "0")
    import inspect
    from app.services import interview_engine
    assert "local_mode()" in inspect.getsource(interview_engine.create_interview)


def test_models_endpoint_lists_what_the_key_can_use(lm, monkeypatch):
    from app.ai import models as m
    monkeypatch.setattr(m, "_list_ai_studio", lambda key: ["gemini-2.5-pro", "gemini-embedding-001", "gemini-2.5-flash", "gemini-live-2.5"])
    r = lm.post("/api/v1/settings/models", json={"api_key": KEY}).json()
    assert r["ok"] and r["models"] == ["gemini-2.5-flash", "gemini-2.5-pro"] and r["method"] == "listed"   # non-chat models removed


def test_aq_keys_are_listed_probed_and_never_guessed(lm, monkeypatch):
    from app.ai import models as m
    refuse = lambda key: (_ for _ in ()).throw(LLMError("provider error 404"))
    monkeypatch.setattr(m, "_list_ai_studio", refuse)
    monkeypatch.setattr(m, "_list_vertex", refuse)
    monkeypatch.setattr(m, "_probe", lambda key, base, mid: 200 if "aiplatform" in base and mid in ("gemini-2.5-flash-lite", "gemini-2.5-pro") else 404)
    r = lm.post("/api/v1/settings/models", json={"api_key": "AQ." + "x" * 40}).json()
    assert r["method"] == "probed" and r["models"] == ["gemini-2.5-pro", "gemini-2.5-flash-lite"]


def test_new_style_ai_studio_aq_key_lists_on_the_studio_host(lm, monkeypatch):
    from app.ai import models as m
    monkeypatch.setattr(m, "_list_ai_studio", lambda key: ["gemini-2.5-flash", "gemini-2.5-pro"])
    monkeypatch.setattr(m, "_list_vertex", lambda key: (_ for _ in ()).throw(AssertionError("Vertex must not be needed")))
    r = lm.post("/api/v1/settings/models", json={"api_key": "AQ." + "x" * 40}).json()
    assert r["ok"] and r["method"] == "listed" and r["models"] == ["gemini-2.5-flash", "gemini-2.5-pro"]


def test_list_401_is_not_proof_of_a_bad_key_when_probing_works(lm, monkeypatch):
    from app.ai import models as m
    refuse = lambda key: (_ for _ in ()).throw(LLMError("provider error 401"))
    monkeypatch.setattr(m, "_list_ai_studio", refuse)
    monkeypatch.setattr(m, "_list_vertex", refuse)
    monkeypatch.setattr(m, "_probe", lambda key, base, mid: 200 if "generativelanguage" in base and mid == "gemini-2.5-flash" else 404)
    r = lm.post("/api/v1/settings/models", json={"api_key": "AQ." + "x" * 40}).json()
    assert r["ok"] and r["models"] == ["gemini-2.5-flash"]


def test_rejected_key_gets_a_clear_how_to_fix_message(lm, monkeypatch):
    from app.ai import models as m
    refuse = lambda key: (_ for _ in ()).throw(LLMError("provider error 403"))
    monkeypatch.setattr(m, "_list_ai_studio", refuse)
    monkeypatch.setattr(m, "_list_vertex", refuse)
    monkeypatch.setattr(m, "_probe", lambda key, base, mid: 403)
    r = lm.post("/api/v1/settings/models", json={"api_key": "AQ." + "x" * 40}).json()
    assert r["ok"] is False and "Copy key" in r["message"] and "53 characters" in r["message"] and "x" * 40 not in r["message"]


def test_api_disabled_message_names_the_fix(lm, monkeypatch):
    def boom(self, s, u, max_tokens=0):
        raise LLMError('provider error 403: { "error": { "message": "Generative Language API has not been used in project 1 before or it is disabled." } }')
    monkeypatch.setattr(GeminiProvider, "complete", boom)
    r = lm.post("/api/v1/settings/test", json={"api_key": "AQ." + "y" * 40}).json()
    assert r["ok"] is False and "generativelanguage.googleapis.com" in r["message"]


def test_characters_have_no_names_only_roles_and_default_voices():
    from app.interviewers.data import AVATARS
    assert {a.id for a in AVATARS} == {"alex", "sam", "dana", "noor"}
    for a in AVATARS:
        assert not hasattr(a, "name") and not hasattr(a, "name_ar")
        assert a.role_title and a.role_ar and a.voice_gender in ("male", "female")
    assert [a.voice_gender for a in AVATARS] == ["male", "male", "female", "female"]


def test_greeting_never_introduces_a_name():
    from app.services.interview_engine import _INTRO
    for text in _INTRO.values():
        assert "{name}" not in text and "{role}" not in text


def test_personality_sets_a_real_follow_up_cap():
    from app.interviewers.data import PERSONALITIES
    from app.services.interview_engine import MAX_FOLLOWUPS
    caps = {k: p.behavior["max_followups"] for k, p in PERSONALITIES.items()}
    assert caps == {"friendly": 3, "professional": 4, "strict": 5, "senior_technical": 5}
    assert all(c <= MAX_FOLLOWUPS for c in caps.values())




def _audio(n=4000, mime="audio/webm;codecs=opus"):
    return {"file": ("answer.webm", b"x" * n, mime)}


def test_transcribe_needs_a_key_and_validates_input(lm, monkeypatch):
    assert lm.post("/api/v1/transcribe", files=_audio()).status_code == 409                    # demo mode: no key
    assert lm.post("/api/v1/transcribe", files=_audio(mime="text/plain")).status_code == 415
    assert lm.post("/api/v1/transcribe", files=_audio(n=6 * 1024 * 1024)).status_code == 413
    assert lm.post("/api/v1/transcribe", files=_audio(n=10)).json() == {"text": ""}             # silence/blip: nothing to send


def test_transcribe_uses_the_saved_key_and_never_echoes_it(lm, monkeypatch):
    lm.put("/api/v1/settings", json={"api_key": KEY})
    seen = {}

    def fake(self, audio, mime, language):
        seen.update(n=len(audio), mime=mime, language=language)
        return "I would use a hash map."
    monkeypatch.setattr(GeminiProvider, "transcribe", fake)
    r = lm.post("/api/v1/transcribe", files=_audio(), data={"language": "ar"})
    assert r.status_code == 200 and r.json() == {"text": "I would use a hash map."} and KEY not in r.text
    assert seen == {"n": 4000, "mime": "audio/webm", "language": "ar"}

    def boom(self, audio, mime, language):
        raise LLMError("provider error 403")
    monkeypatch.setattr(GeminiProvider, "transcribe", boom)
    r = lm.post("/api/v1/transcribe", files=_audio())
    assert r.status_code == 502 and "Google rejected this key" in r.json()["detail"] and KEY not in r.text


def test_transcribe_request_carries_audio_and_header_auth(monkeypatch):
    from app.ai import provider as P
    seen = {}

    class R:
        status_code = 200
        def json(self): return {"candidates": [{"content": {"parts": [{"text": " hello world "}]}}]}
    def fake_post(url, headers=None, json=None, timeout=None):
        seen.update(url=url, headers=headers, body=json); return R()
    monkeypatch.setattr(P.httpx, "post", fake_post)
    out = GeminiProvider("AIza" + "k" * 30, "gemini-2.5-flash").transcribe(b"abc", "audio/webm", "en")
    assert out == "hello world" and seen["headers"] == {"x-goog-api-key": "AIza" + "k" * 30}
    parts = seen["body"]["contents"][0]["parts"]
    assert parts[1]["inlineData"] == {"mimeType": "audio/webm", "data": "YWJj"} and "Transcribe" in parts[0]["text"]
