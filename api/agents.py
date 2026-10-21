"""
Live agents for Neur, backed by Amazon Bedrock (Claude).

Each live agent is a function `fn(payload) -> str` that:
  1. loads that agent's system prompt from `agents/<name>/prompt.md`,
  2. sends the prompt plus the input JSON (`payload`) to a Claude model on Bedrock,
  3. returns the model's reply text.

`run_pipeline()` in demo/demo_runner.py parses that text as JSON, validates it,
and falls back to a saved answer if anything goes wrong. So these functions only
need to return the model's raw reply; they don't parse or validate it.

The Bedrock client is created lazily. If boto3 isn't installed or no AWS
credentials/region are configured, `build_live_agents()` returns an empty dict,
and the pipeline runs entirely on saved answers (demo / fallback). That keeps the
server runnable on any machine without AWS set up.

Config (environment variables, see .env.example):
  AWS_REGION          AWS region for Bedrock (e.g. us-east-1)
  BEDROCK_MODEL_ID    Claude model id, e.g. anthropic.claude-3-5-sonnet-20240620-v1:0
  NEUR_AGENT_TIMEOUT  per-agent timeout, enforced by the pipeline (not here)
"""

import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROMPT_DIR = REPO_ROOT / "agents"

# Which prompt file backs each live agent the pipeline understands.
PROMPT_FILES = {
    "market": PROMPT_DIR / "market" / "prompt.md",
    "legal": PROMPT_DIR / "legal" / "prompt.md",
    "finance": PROMPT_DIR / "finance" / "prompt.md",
    "manager": PROMPT_DIR / "manager" / "prompt.md",
}

# Bedrock Converse caps.
MAX_TOKENS = int(os.getenv("NEUR_MAX_TOKENS", "2000"))
TEMPERATURE = float(os.getenv("NEUR_TEMPERATURE", "0.2"))


def _load_prompt(name):
    path = PROMPT_FILES[name]
    return path.read_text(encoding="utf-8")


def _bedrock_client():
    """Return a Bedrock Runtime client, or None if Bedrock isn't usable here.

    Never raises: a missing boto3, missing region, or missing credentials just
    means "no live agents", and the pipeline uses saved answers instead.
    """
    region = os.getenv("AWS_REGION")
    model_id = os.getenv("BEDROCK_MODEL_ID")
    if not region or not model_id or model_id == "your-claude-model-id-here":
        return None
    try:
        import boto3  # imported lazily so the server runs without it
    except ImportError:
        return None
    try:
        return boto3.client("bedrock-runtime", region_name=region)
    except Exception:
        return None


def _make_agent(name, client, model_id, system_prompt):
    """Build one live agent function bound to a prompt and the Bedrock client."""

    def call(payload):
        # The model sees the system prompt (its role) and the input JSON as the
        # user turn. It must reply with only the handoff JSON; the pipeline parses it.
        user_text = json.dumps(payload, ensure_ascii=False)
        response = client.converse(
            modelId=model_id,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_text}]}],
            inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": TEMPERATURE},
        )
        # Converse returns the assistant turn under output.message.content[].text
        parts = response["output"]["message"]["content"]
        return "".join(p.get("text", "") for p in parts)

    call.__name__ = f"call_{name}"
    return call


def build_live_agents():
    """Build the live_agents dict for run_pipeline().

    Returns {} when Bedrock isn't configured, so the pipeline falls back to saved
    answers. Otherwise returns {"market", "legal", "finance", "manager"} -> fn.
    """
    client = _bedrock_client()
    if client is None:
        return {}
    model_id = os.getenv("BEDROCK_MODEL_ID")
    agents = {}
    for name in ("market", "legal", "finance", "manager"):
        try:
            system_prompt = _load_prompt(name)
        except OSError:
            continue
        agents[name] = _make_agent(name, client, model_id, system_prompt)
    return agents


def live_agents_available():
    """True if Bedrock is configured and at least one prompt loaded."""
    return bool(build_live_agents())
