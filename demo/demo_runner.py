"""
Neur demo runner: runs the agent team and gives every agent a backup path.

Modes (set NEUR_MODE in .env, or pass mode=...):
  live      Call the real agents. If an agent's JSON doesn't parse, retry once with the
            parse error; if it still fails, that agent finishes "flagging" with the
            fallback blocker, so a broken agent looks broken on stage (Johnny's rule).
  fallback  Call the real agents. If one fails, times out, or returns bad JSON, use that
            agent's saved answer instead, tagged so the UI shows "Sample data".
  demo      Saved answers only, with short delays so the animation still plays.
            Agents also receive "run_mode": "demo" (Quill then uses his reference card).

In every mode the Finance numbers go through the real calculator, including Ward's re-check.
Quill gets 45 seconds; if he runs over, he is rerun once in demo mode (integration handoff B.1).

Every output carries "_source": "live", "demo", "demo_fallback" or "failed".

The result's "events" list drives the screen. Each event has:
  event   e.g. "finance.waiting", "legal.done", "manager.conflict"
  agent   "market" | "legal" | "finance" | "manager"
  state   the universal character state: idle | waiting | working | flagging | done
          (Ward also uses "delegating")
  and, when a folder flies: frm, to, tab, est (true if any number is an estimate)

Usage from the back end:
    from demo.demo_runner import run_pipeline
    result = run_pipeline(founder_profile, live_agents={
        "market": call_market, "legal": call_legal, "finance": call_finance,  # fn(payload) -> dict or JSON text
        "manager": call_manager,                                               # optional
    }, mode="fallback")
"""

import concurrent.futures
import copy
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "agents" / "finance"))
from finance_calc import run_finance_math  # noqa: E402

SCENARIO_DIR = HERE / "scenarios"
DEFAULT_SCENARIO = "cookies"
TIMEOUT_SECONDS = float(os.getenv("NEUR_AGENT_TIMEOUT", "25"))
LEGAL_TIMEOUT_SECONDS = float(os.getenv("NEUR_LEGAL_TIMEOUT", "45"))
DEMO_DELAY = float(os.getenv("NEUR_DEMO_DELAY", "1.5"))
BLOCK = "Blocks the plan as written:"

REQUIRED_NUMBERS = {
    "market": ["price_per_unit", "est_monthly_customers", "units_per_customer_per_month"],
    "legal": ["legal_setup_cost", "annual_license_fees"],
}
REQUIRED_FINANCE_LISTS = ["startup_cost_items", "unit_cost_items", "monthly_fixed_cost_items"]
NAME = {"market": "Scout", "legal": "Quill", "finance": "Penny", "manager": "Ward"}
ROLE = {"market": "Customer & Market", "legal": "Legal & Compliance", "finance": "Finance"}


# ---------- scenarios ----------

def list_scenarios():
    return sorted(p.stem for p in SCENARIO_DIR.glob("*.json"))


def load_scenario(name_or_idea=None):
    """Pick a saved scenario by name, or by matching keywords in the founder's idea."""
    text = (name_or_idea or "").lower()
    files = {p.stem: p for p in SCENARIO_DIR.glob("*.json")}
    if text in files:
        return json.loads(files[text].read_text())
    for path in files.values():
        data = json.loads(path.read_text())
        if any(k in text for k in data.get("keywords", [])):
            return data
    return json.loads(files[DEFAULT_SCENARIO].read_text())


# ---------- validation ----------

def _valid(agent, out):
    if not isinstance(out, dict):
        return False
    if agent in REQUIRED_NUMBERS:
        nums = out.get("numbers", {})
        return all(k in nums and isinstance(nums[k], dict) and "value" in nums[k] for k in REQUIRED_NUMBERS[agent])
    if agent == "finance":
        return all(isinstance(out.get(k), list) for k in REQUIRED_FINANCE_LISTS)
    return True


def _parse(out):
    """Agents should return JSON. Accept a dict or JSON text (stray text around it is trimmed)."""
    if isinstance(out, dict):
        return out
    if isinstance(out, str):
        start, end = out.find("{"), out.rfind("}")
        if start != -1 and end > start:
            return json.loads(out[start:end + 1])
    raise ValueError("Agent did not return JSON")


def _call(fn, payload, timeout):
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        return pool.submit(fn, payload).result(timeout=timeout)
    finally:
        pool.shutdown(wait=False)


def _failed_handoff(agent):
    """Johnny's fallback blocker: a broken agent finishes flagging instead of quietly passing."""
    who = ROLE.get(agent, agent)
    out = {
        "agent": agent, "signal": "flag", "tab": f"Blocked: {who} didn't finish"[:40],
        "summary": f"The {who} review didn't complete.",
        "key_findings": [], "numbers": {}, "assumptions": [],
        "risks": [{"risk": f"{BLOCK} {who} review didn't complete. Rerun before relying on this plan.", "severity": "high"}],
        "needs_from_others": [], "next_steps": [], "_source": "failed",
    }
    if agent == "finance":
        out.update({"startup_cost_items": [], "unit_cost_items": [], "monthly_fixed_cost_items": []})
    return out


# ---------- one agent ----------

def run_agent(agent, payload, scenario, live_fn=None, mode="fallback", log=None):
    saved = copy.deepcopy(scenario["finance_raw" if agent == "finance" else agent])

    if mode == "demo" or live_fn is None:
        if DEMO_DELAY:
            time.sleep(DEMO_DELAY)
        saved["_source"] = "demo"
        return saved

    timeout = LEGAL_TIMEOUT_SECONDS if agent == "legal" else TIMEOUT_SECONDS
    attempt_payload = payload
    for attempt in range(2):
        try:
            out = _parse(_call(live_fn, attempt_payload, timeout))
            if not _valid(agent, out):
                raise ValueError("missing required fields")
            out["_source"] = "live"
            return out
        except concurrent.futures.TimeoutError:
            if log is not None:
                log.append(f"{NAME[agent]} timed out after {timeout:.0f}s")
            if agent == "legal" and attempt == 0:
                attempt_payload = dict(payload, run_mode="demo")   # B.1: rerun Quill once in demo mode
                continue
            break
        except Exception as err:   # API error, bad JSON, missing fields
            if log is not None:
                log.append(f"{NAME[agent]} returned an unusable answer: {err}")
            if attempt == 0:
                attempt_payload = dict(payload, parse_error=str(err))   # retry once with the error
                continue
            break

    if mode == "live":
        return _failed_handoff(agent)
    if log is not None:
        log.append(f"{NAME[agent]} switched to its saved answer")
    saved["_source"] = "demo_fallback"
    return saved


# ---------- events ----------

def _has_estimate(out):
    return any(isinstance(v, dict) and v.get("basis") == "estimate" for v in (out.get("numbers") or {}).values())


def _tab(out, agent):
    tab = out.get("tab")
    return tab if isinstance(tab, str) and 0 < len(tab) <= 40 else ROLE.get(agent, agent)


def character_state(agent, event, signal=None):
    """One function for every character: event -> universal state (integration handoff 4.1)."""
    kind = event.split(".", 1)[1]
    if agent == "manager":
        return {"dispatch": "delegating", "review": "working", "conflict": "flagging",
                "roadmap": "done", "forward": "delegating"}.get(kind, "idle")
    if kind == "done":
        return "flagging" if signal == "flag" else "done"
    return {"waiting": "waiting", "received": "working", "search": "working", "note": "working"}.get(kind, "idle")


def _ev(agent, event, signal=None, **folder):
    e = {"event": f"{agent}.{event}", "agent": agent, "state": character_state(agent, f"{agent}.{event}", signal)}
    e.update(folder)
    return e


# ---------- whole pipeline ----------

def run_pipeline(founder_profile=None, live_agents=None, mode=None, scenario_name=None):
    mode = mode or os.getenv("NEUR_MODE", "fallback")
    run_mode = "demo" if mode == "demo" else "live"
    live_agents = live_agents or {}
    scenario = load_scenario(scenario_name or (founder_profile or {}).get("idea"))
    profile = founder_profile or scenario["founder_profile"]
    warnings, events = [], []

    # 1. Ward sends the profile to Scout and Quill at the same time; Penny waits.
    events.append(_ev("manager", "dispatch", frm="Ward", to="Scout, Quill", tab="Profile"))
    events.append(_ev("finance", "waiting"))
    events.append(_ev("market", "received"))
    events.append(_ev("legal", "received"))
    base = {"founder_profile": profile, "outputs_so_far": {}, "run_mode": run_mode}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        f_market = pool.submit(run_agent, "market", base, scenario, live_agents.get("market"), mode, warnings)
        f_legal = pool.submit(run_agent, "legal", base, scenario, live_agents.get("legal"), mode, warnings)
        market, legal = f_market.result(), f_legal.result()

    # 2. Quill returns; any note he has for Scout is passed along by Ward.
    events.append(_ev("legal", "done", legal.get("signal"), frm="Quill", to="Ward", tab=_tab(legal, "legal"), est=_has_estimate(legal)))
    for req in legal.get("needs_from_others", []):
        if req.get("agent") == "customer_market":
            # NOTE: Scout runs in parallel, so in live mode his answer may not reflect this note yet.
            events.append(_ev("manager", "forward", frm="Ward", to="Scout", tab="Note from Quill", note=req.get("request", "")))
            events.append(_ev("market", "note"))
    events.append(_ev("market", "done", market.get("signal"), frm="Scout", to="Ward", tab=_tab(market, "market"), est=_has_estimate(market)))

    # 3. Penny gets everything, estimates costs, and the calculator does the math.
    events.append(_ev("manager", "dispatch", frm="Ward", to="Penny", tab="Profile + 2 handoffs"))
    events.append(_ev("finance", "received"))
    fin_payload = {"founder_profile": profile, "outputs_so_far": {"customer_market": market, "legal": legal}, "run_mode": run_mode}
    finance_raw = run_agent("finance", fin_payload, scenario, live_agents.get("finance"), mode, warnings)
    finance = run_finance_math(finance_raw, profile, market, legal)
    finance["_source"] = finance_raw.get("_source", "live")
    if finance_raw.get("_source") == "failed":
        finance.update({"signal": "flag", "tab": finance_raw["tab"]})
        finance["risks"] = finance_raw["risks"] + finance["risks"]
    events.append(_ev("finance", "done", finance["signal"], frm="Penny", to="Ward", tab=finance["tab"], est=True))

    # 4. Ward checks the handoffs against each other.
    events.append(_ev("manager", "review"))
    manager = copy.deepcopy(scenario["manager"])
    live_mgr = live_agents.get("manager")
    if live_mgr and mode != "demo":
        try:
            mgr_out = _parse(_call(live_mgr, {"founder_profile": profile, "outputs": {"market": market, "legal": legal, "finance": finance}}, TIMEOUT_SECONDS))
            if "roadmap" in mgr_out:
                manager = mgr_out
                manager["_source"] = "live"
        except Exception as err:
            if mode == "live":
                raise
            warnings.append(f"Ward switched to his saved answer: {err.__class__.__name__}: {err}")
            manager["_source"] = "demo_fallback"
    manager.setdefault("_source", "demo" if mode == "demo" else "demo_fallback")

    flagged = [a for a, o in (("market", market), ("legal", legal), ("finance", finance)) if o.get("signal") == "flag"]
    if flagged or manager.get("exchanges"):
        events.append(_ev("manager", "conflict", flagged=flagged))
    for ex in manager.get("exchanges", []):
        if "recheck_price" in ex and "price_per_unit" not in market.get("numbers", {}):
            warnings.append("Skipped Ward's price re-check: Scout's answer has no price")
            continue
        if "recheck_price" in ex:
            events.append(_ev("manager", "dispatch", frm="Ward", to="Penny", tab=ex["value"]))
            events.append(_ev("finance", "received"))
            m2 = copy.deepcopy(market)
            m2["numbers"]["price_per_unit"]["value"] = ex["recheck_price"]
            recheck = run_finance_math(finance_raw, profile, m2, legal)   # the real calculator, never faked
            be2 = recheck["numbers"]["break_even_units_per_month"]["value"]
            tab2 = f"Break-even {be2:.0f}/mo at ${ex['recheck_price']:g}" if be2 is not None else "No break-even"
            events.append(_ev("finance", "done", recheck["signal"], frm="Penny", to="Ward", tab=tab2, est=True))
            finance["recheck"] = {"price": ex["recheck_price"], "numbers": recheck["numbers"], "signal": recheck["signal"]}
        else:
            events.append({"event": "manager.exchange", "agent": "manager", "state": "delegating",
                           "frm": ex.get("from"), "to": ex.get("to"), "tab": ex.get("value")})

    events.append(_ev("manager", "roadmap", frm="Ward", to="Founder",
                      tab=manager.get("roadmap", {}).get("verdict_title", "Launch roadmap")))

    outputs = {"market": market, "legal": legal, "finance": finance, "manager": manager}
    return {
        "mode": mode,
        "scenario": scenario["scenario"],
        "founder_profile": profile,
        "outputs": outputs,
        "events": events,
        "warnings": warnings,
        "used_saved_answers": any(o.get("_source") in ("demo", "demo_fallback") for o in outputs.values()),
    }


if __name__ == "__main__":
    # Quick check: python demo/demo_runner.py [scenario]
    os.environ.setdefault("NEUR_DEMO_DELAY", "0")
    DEMO_DELAY = float(os.environ["NEUR_DEMO_DELAY"])
    name = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SCENARIO
    r = run_pipeline(mode="demo", scenario_name=name)
    n = r["outputs"]["finance"]["numbers"]
    print(f"Scenario: {r['scenario']}  (mode: {r['mode']})")
    print(f"  Cost to open:   ${n['startup_cost_total']['value']:,.0f}")
    print(f"  Break-even:     {n['break_even_units_per_month']['value']:.0f} per month")
    print("  Signals:        " + ", ".join(f"{NAME[a]} {r['outputs'][a].get('signal')}" for a in ("market", "legal", "finance")))
    print("  Events:")
    for i, e in enumerate(r["events"], 1):
        fly = f"  [{e.get('frm')} -> {e.get('to')}: {e.get('tab')}]" if e.get("tab") else ""
        print(f"    {i:2}. {e['event']:<18} {NAME[e['agent']]:<6} -> {e['state']}{fly}")
