"""
Neur backend API.

One real endpoint:

    POST /plan
        Body: a founder profile, either bare:
            { "idea": "...", "location": "...", "startup_budget": 1500,
              "hours_per_week": 10, "timeline": "...", "experience": "..." }
        or wrapped: { "founder_profile": { ... }, "mode": "fallback",
                      "scenario_name": "cookies" }
        Runs the whole agent team through run_pipeline() and returns its result
        (mode, scenario, outputs, events, warnings, used_saved_answers) as JSON.

    GET /health
        { "ok": true, "mode": "...", "live_agents": false }

Every agent call goes through run_pipeline(); the UI never calls agents directly.
The mode comes from the request body, else NEUR_MODE in the environment, else
"fallback". Live agents are wired in only when Amazon Bedrock is configured
(see api/agents.py); otherwise the pipeline runs on saved answers.

Run it:
    python api/server.py            # serves on 0.0.0.0:8000
    PORT=9000 python api/server.py  # custom port

This uses only the Python standard library, so there are no dependencies to
install for the demo. boto3 is needed only for live Bedrock calls.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from demo.demo_runner import run_pipeline  # noqa: E402
from api.agents import build_live_agents  # noqa: E402

MAX_BODY_BYTES = 256 * 1024  # a founder profile is tiny; cap to be safe
PROFILE_KEYS = (
    "idea", "location", "startup_budget", "hours_per_week", "timeline", "experience",
)


def _default_mode():
    return os.getenv("NEUR_MODE", "fallback")


def _extract_request(body):
    """Pull (founder_profile, mode, scenario_name) out of a request body.

    Accepts a bare profile or one wrapped as {"founder_profile": {...}, ...}.
    """
    if not isinstance(body, dict):
        raise ValueError("request body must be a JSON object")

    if isinstance(body.get("founder_profile"), dict):
        profile = body["founder_profile"]
        mode = body.get("mode")
        scenario_name = body.get("scenario_name")
    elif any(k in body for k in PROFILE_KEYS):
        profile = {k: body[k] for k in PROFILE_KEYS if k in body}
        mode = body.get("mode")
        scenario_name = body.get("scenario_name")
    else:
        raise ValueError(
            "no founder profile found; send profile fields (idea, location, ...) "
            "or a 'founder_profile' object"
        )

    return profile, (mode or _default_mode()), scenario_name


def build_plan(body):
    """Run the pipeline for one request body and return its result dict."""
    profile, mode, scenario_name = _extract_request(body)
    # ?demo=1 / forced demo is handled at the HTTP layer by overriding `mode`.
    live_agents = {} if mode == "demo" else build_live_agents()
    return run_pipeline(
        founder_profile=profile,
        live_agents=live_agents,
        mode=mode,
        scenario_name=scenario_name,
    )


class NeurHandler(BaseHTTPRequestHandler):
    server_version = "NeurAPI/1.0"

    # ---- helpers ----

    def _send_json(self, status, obj):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self._cors()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def _cors(self):
        # The front end is served separately (Amplify / S3+CloudFront), so allow it.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY_BYTES:
            raise ValueError("request body too large")
        raw = self.rfile.read(length)
        if not raw.strip():
            return {}
        return json.loads(raw.decode("utf-8"))

    def log_message(self, fmt, *args):
        # Quieter default logging; keep it on stderr.
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # ---- routes ----

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/health":
            self._send_json(200, {
                "ok": True,
                "mode": _default_mode(),
                "live_agents": bool(build_live_agents()),
            })
            return
        self._send_json(404, {"error": "not found", "path": path})

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        query = self.path.split("?", 1)[1] if "?" in self.path else ""
        if path != "/plan":
            self._send_json(404, {"error": "not found", "path": path})
            return

        try:
            body = self._read_body()
        except json.JSONDecodeError as err:
            # JSONDecodeError subclasses ValueError, so catch it first.
            self._send_json(400, {"error": f"invalid JSON: {err}"})
            return
        except ValueError as err:
            self._send_json(413, {"error": str(err)})
            return

        # ?demo=1 forces demo mode regardless of the body (stage safety switch).
        if "demo=1" in query:
            if not isinstance(body, dict):
                body = {}
            body["mode"] = "demo"

        try:
            result = build_plan(body)
        except ValueError as err:
            self._send_json(400, {"error": str(err)})
            return
        except Exception as err:  # pipeline/model failure shouldn't crash the server
            self._send_json(500, {"error": f"{err.__class__.__name__}: {err}"})
            return

        self._send_json(200, result)


def main():
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    httpd = ThreadingHTTPServer((host, port), NeurHandler)
    live = bool(build_live_agents())
    print(f"Neur API on http://{host}:{port}")
    print(f"  mode: {_default_mode()}   live agents (Bedrock): {live}")
    print("  POST /plan   GET /health")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
        httpd.shutdown()


if __name__ == "__main__":
    main()
