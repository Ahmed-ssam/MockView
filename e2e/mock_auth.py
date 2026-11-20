"""Minimal stand-in for Supabase GoTrue, for local E2E only. Signs real HS256 JWTs."""
import json, os, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from jose import jwt

SECRET = "e2e-secret"
APP_META = {"role": "admin"} if os.environ.get("MOCK_ADMIN") == "1" else {}
USER = {"id": "11111111-1111-4111-8111-111111111111", "email": "tester@example.com",
        "aud": "authenticated", "role": "authenticated", "app_metadata": APP_META, "user_metadata": {"display_name": "Test User"},
        "created_at": "2026-01-01T00:00:00Z"}


def session():
    exp = int(time.time()) + 3600
    tok = jwt.encode({"sub": USER["id"], "aud": "authenticated", "exp": exp, "email": USER["email"],
                      "role": "authenticated", "app_metadata": APP_META}, SECRET, algorithm="HS256")
    return {"access_token": tok, "token_type": "bearer", "expires_in": 3600, "expires_at": exp,
            "refresh_token": "refresh", "user": USER}


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def _json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); body = json.loads(self.rfile.read(n) or b"{}")
        if "/auth/v1/token" in self.path:
            if "grant_type=password" in self.path and body.get("password") != "correct-horse-1":
                return self._json(400, {"error": "invalid_grant", "error_description": "Invalid login credentials"})
            return self._json(200, session())
        if "/auth/v1/logout" in self.path:
            self.send_response(204); self._cors(); self.end_headers(); return
        self._json(404, {})

    def do_GET(self):
        if "/auth/v1/user" in self.path:
            return self._json(200, USER)
        self._json(404, {})

    def log_message(self, *a):
        pass


ThreadingHTTPServer(("127.0.0.1", 54321), H).serve_forever()
