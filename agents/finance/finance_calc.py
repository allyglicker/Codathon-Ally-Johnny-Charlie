"""
Neur Finance calculator.

The Finance agent (AI) estimates costs item by item.
This function does the arithmetic so the numbers are always correct,
then returns Finance's handoff in the shared format for the manager.

Usage:
    handoff = run_finance_math(finance_raw, founder_profile, market_out, legal_out)
"""

import math


def _num(agent_output, key):
    """Read a value from another agent's `numbers` block, or None if missing."""
    try:
        return float(agent_output["numbers"][key]["value"])
    except (KeyError, TypeError, ValueError):
        return None


def _sum(items):
    return sum(float(i.get("cost", 0) or 0) for i in (items or []))


def run_finance_math(finance_raw, founder_profile, market_out, legal_out):
    # Inputs from the other agents
    price = _num(market_out, "price_per_unit")
    customers = _num(market_out, "est_monthly_customers")
    units_per_customer = _num(market_out, "units_per_customer_per_month")
    legal_setup = _num(legal_out, "legal_setup_cost") or 0
    annual_fees = _num(legal_out, "annual_license_fees") or 0
    # Marketing comes from Customer & Market (optional keys), so Finance never double-counts it
    mkt_startup = _num(market_out, "est_marketing_cost_startup") or 0
    mkt_monthly = _num(market_out, "est_marketing_cost_monthly") or 0
    price_low = _num(market_out, "price_range_low")
    price_high = _num(market_out, "price_range_high")
    budget = float(founder_profile.get("startup_budget", 0) or 0)

    # Totals from Finance's estimates (+ legal and marketing costs from the other agents,
    # added here so they're never double-counted)
    startup_total = _sum(finance_raw.get("startup_cost_items")) + legal_setup + mkt_startup
    cost_per_unit = _sum(finance_raw.get("unit_cost_items"))
    monthly_fixed = _sum(finance_raw.get("monthly_fixed_cost_items")) + annual_fees / 12 + mkt_monthly

    # The math
    profit_per_unit = (price - cost_per_unit) if price is not None else None
    if profit_per_unit is not None and profit_per_unit > 0:
        break_even = math.ceil(monthly_fixed / profit_per_unit)
    else:
        break_even = None  # no break-even possible (or no price yet)

    money_left = budget - startup_total
    funding_gap = max(0.0, -money_left)
    if money_left <= 0:
        runway = 0.0
    elif monthly_fixed > 0:
        runway = money_left / monthly_fixed
    else:
        runway = None  # no monthly bills, so money doesn't run down

    expected_units = (
        customers * units_per_customer
        if customers is not None and units_per_customer is not None
        else None
    )

    def n(value, unit, basis):
        return {"value": None if value is None else round(value, 2), "unit": unit, "basis": basis}

    numbers = {
        "startup_cost_total": n(startup_total, "USD", "estimate"),
        "monthly_fixed_costs": n(monthly_fixed, "USD/month", "estimate"),
        "cost_per_unit": n(cost_per_unit, "USD", "estimate"),
        "profit_per_unit": n(profit_per_unit, "USD", "calculated"),
        "break_even_units_per_month": n(break_even, "units/month", "calculated"),
        "runway_months": n(runway, "months", "calculated"),
        "funding_gap": n(funding_gap, "USD", "calculated"),
        "expected_monthly_units": n(expected_units, "units/month", "calculated"),
    }
    # Break-even at the top of Market's price range, so the Manager can suggest a raise without another call
    if price_high is not None and price_high - cost_per_unit > 0:
        numbers["break_even_at_price_high"] = n(math.ceil(monthly_fixed / (price_high - cost_per_unit)), "units/month", "calculated")

    # Automatic money checks (added on top of the AI's own risks).
    # Visual Signal rule: "high" is used ONLY for blockers, and every blocker starts with BLOCK.
    BLOCK = "Blocks the plan as written:"
    risks = []
    for r in finance_raw.get("risks", []):
        r = dict(r)
        if r.get("severity") == "high" and not str(r.get("risk", "")).startswith(BLOCK):
            r["severity"] = "medium"
        risks.append(r)
    needs = list(finance_raw.get("needs_from_others", []))
    block_tab = None

    if price is None:
        risks.append({"risk": "No price from Customer & Market yet, so break-even can't be calculated.", "severity": "medium"})
        needs.append({"agent": "customer_market", "request": "Please provide price_per_unit."})
    elif profit_per_unit <= 0:
        risks.append({"risk": f"{BLOCK} the price (${price:.2f}) doesn't cover the cost to make one unit (${cost_per_unit:.2f}), so every sale loses money. Fix: raise the price or cut the cost per unit.", "severity": "high"})
        needs.append({"agent": "customer_market", "request": "Price is at or below cost. Suggest a higher price or a premium option."})
        block_tab = "Blocked: price below cost"

    if funding_gap > 0:
        risks.append({"risk": f"{BLOCK} opening costs ${startup_total:,.0f}, which is ${funding_gap:,.0f} more than the ${budget:,.0f} budget. Fix: start smaller, save the difference first, or look into a small microloan.", "severity": "high"})
        block_tab = block_tab or f"Blocked: ${funding_gap:,.0f} over budget"
    elif runway is not None and runway < 6:
        risks.append({"risk": f"Money left after opening covers only about {runway:.1f} months of bills with no sales.", "severity": "medium"})

    if price is not None and price_high is not None and price_low is not None and not (price_low <= price <= price_high):
        risks.append({"risk": f"Price (${price:.2f}) is outside the competitor range (${price_low:.2f}-${price_high:.2f}).", "severity": "medium"})

    if break_even is not None and expected_units is not None and break_even > expected_units:
        risks.append({"risk": f"Break-even needs {break_even} sales a month, but the market estimate is about {expected_units:.0f}.", "severity": "medium"})

    # Requests other agents sent to Finance: keep Finance's answers, and flag any left unanswered
    asked = [r for r in market_out.get("needs_from_others", []) + legal_out.get("needs_from_others", []) if r.get("agent") == "finance"]
    responses = list(finance_raw.get("responses_to_others", []))
    answered = {r.get("request") for r in responses}
    unanswered = [r["request"] for r in asked if r.get("request") not in answered]

    # Visual signal + folder tab, decided from the real numbers (overrides the AI's guess)
    flagged = any(str(r.get("risk", "")).startswith(BLOCK) for r in risks)
    if flagged:
        tab = block_tab or "Blocked: money doesn't work"
    elif break_even is not None:
        tab = f"${startup_total:,.0f} start · break-even {break_even}/mo"
    else:
        tab = f"${startup_total:,.0f} to start"
    if len(tab) > 40:
        tab = f"${startup_total:,.0f} to start"

    return {
        "agent": "finance",
        "signal": "flag" if flagged else "clear",
        "tab": tab,
        "unit_definition": market_out.get("unit_definition", finance_raw.get("unit_definition")),
        "summary": finance_raw.get("summary", ""),
        "key_findings": finance_raw.get("key_findings", []),
        "numbers": numbers,
        "cost_breakdown": {
            "startup": finance_raw.get("startup_cost_items", []) + [{"item": "Legal setup (from Legal)", "cost": legal_setup}] + ([{"item": "Marketing to launch (from Market)", "cost": mkt_startup}] if mkt_startup else []),
            "per_unit": finance_raw.get("unit_cost_items", []),
            "monthly": finance_raw.get("monthly_fixed_cost_items", []) + [{"item": "License fees, monthly share (from Legal)", "cost": round(annual_fees / 12, 2)}] + ([{"item": "Marketing (from Market)", "cost": mkt_monthly}] if mkt_monthly else []),
        },
        "responses_to_others": responses,
        "unanswered_requests": unanswered,
        "assumptions": finance_raw.get("assumptions", []),
        "risks": risks,
        "needs_from_others": needs,
        "next_steps": finance_raw.get("next_steps", []),
    }


if __name__ == "__main__":
    # Cookie example for testing
    import json

    founder = {"idea": "Homemade cookies from my kitchen", "location": "Milledgeville, GA", "startup_budget": 1500, "hours_per_week": 10}
    market = {"numbers": {"price_per_unit": {"value": 3.5}, "est_monthly_customers": {"value": 60}, "units_per_customer_per_month": {"value": 4}}}
    legal = {"numbers": {"legal_setup_cost": {"value": 150}, "annual_license_fees": {"value": 120}}}
    finance_raw = {
        "summary": "Your biggest costs are a mixer and your first batch of supplies.",
        "startup_cost_items": [{"item": "Stand mixer", "cost": 300}, {"item": "Baking sheets and tools", "cost": 120}, {"item": "First supplies", "cost": 200}, {"item": "Logo and simple website", "cost": 150}],
        "unit_cost_items": [{"item": "Ingredients", "cost": 0.45}, {"item": "Packaging", "cost": 0.25}, {"item": "Card fees (~3%)", "cost": 0.11}],
        "monthly_fixed_cost_items": [{"item": "Website hosting", "cost": 20}, {"item": "Insurance", "cost": 40}],
        "key_findings": [], "assumptions": [], "risks": [], "needs_from_others": [], "next_steps": [],
    }
    print(json.dumps(run_finance_math(finance_raw, founder, market, legal), indent=2))
