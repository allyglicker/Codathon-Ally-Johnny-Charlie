"""
AWS Lambda handler for Neur's POST /plan, behind a Lambda Function URL.

This is a thin adapter. It turns a Function URL request into the same
`build_plan(body)` call the local HTTP server uses, so the pipeline and the
live Bedrock agents behave identically whether they run locally or in Lambda.
Nothing in api/server.py or run_demo.py changes.

Function URL payload format: 2.0 (the default). We read the HTTP method and
path from `requestContext.http`, the body from `event["body"]` (base64-decoded
if flagged), and return a {statusCode, headers, body} response with CORS.

Routes:
    POST /plan[?demo=1]   -> run the pipeline, return the result JSON
    GET  /health          -> { ok, mode, live_agents }
    OPTIONS *             -> CORS preflight

Environment (set on the Lambda, see infra/README or .env.example):
    NEUR_MODE=fallback                      live agents, saved answers as backup
    AWS_REGION=us-east-2                     (Lambda sets this automatically)
    BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0   inference profile ID
    NEUR_AGENT_TIMEOUT / NEUR_LEGAL_TIMEOUT  per-agent timeouts
"""

import json

from api.server import build_plan, _default_mode
from api.agents import build_live_agents

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def _response(status, obj):
    return {
        "statusCode": status,
        "headers": dict(CORS, **{"Content-Type": "application/json; charset=utf-8"}),
        "body": json.dumps(obj, ensure_ascii=False),
    }


def _request_bits(event):
    """Pull (method, raw_path, query_string, body_text) out of a Function URL event."""
    ctx = (event.get("requestContext") or {}).get("http") or {}
    method = ctx.get("method") or event.get("httpMethod") or "GET"
    path = ctx.get("path") or event.get("rawPath") or "/"
    query = event.get("rawQueryString") or ""

    body_text = event.get("body") or ""
    if event.get("isBase64Encoded") and body_text:
        import base64
        body_text = base64.b64decode(body_text).decode("utf-8")
    return method, path, query, body_text


def lambda_handler(event, context=None):
    method, path, query, body_text = _request_bits(event)

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS, "body": ""}

    if method == "GET" and path.rstrip("/") == "/health":
        return _response(200, {
            "ok": True,
            "mode": _default_mode(),
            "live_agents": bool(build_live_agents()),
        })

    if method == "POST" and path.rstrip("/") == "/plan":
        try:
            body = json.loads(body_text) if body_text.strip() else {}
        except json.JSONDecodeError as err:
            return _response(400, {"error": f"invalid JSON: {err}"})

        # ?demo=1 forces demo mode (stage safety switch), same as the local server.
        if "demo=1" in query:
            if not isinstance(body, dict):
                body = {}
            body["mode"] = "demo"

        try:
            result = build_plan(body)
        except ValueError as err:
            return _response(400, {"error": str(err)})
        except Exception as err:  # a model/pipeline failure shouldn't 500 silently
            return _response(500, {"error": f"{err.__class__.__name__}: {err}"})

        return _response(200, result)

    return _response(404, {"error": "not found", "path": path})
