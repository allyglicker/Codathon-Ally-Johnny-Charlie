# Neur: Shared Handoff Format

Every sub-agent (Customer & Market, Finance, Legal & Compliance) gets the same input and returns the same output shape. That's what lets the manager compare their answers and catch conflicts.

## Run order

1. Manager collects the founder profile.
2. **Customer & Market** and **Legal & Compliance** run (at the same time is fine).
3. **Finance** runs last, because it needs the price from Market and the setup costs from Legal.
4. Manager reviews all three, flags conflicts, and writes the launch roadmap.

## Input every agent receives

```json
{
  "founder_profile": {
    "idea": "Homemade cookies sold from my kitchen",
    "location": "Milledgeville, GA",
    "startup_budget": 1500,
    "hours_per_week": 10,
    "timeline": "Open within 3 months",
    "experience": "Has baked for 5 years, no business experience"
  },
  "outputs_so_far": { }
}
```

`outputs_so_far` holds the other agents' finished handoffs. Finance uses it to read the price and legal costs.

## Output every agent must return

```json
{
  "agent": "customer_market | finance | legal",
  "summary": "2-3 plain-language sentences a beginner would understand.",
  "key_findings": [
    "Short, specific finding",
    "Another finding"
  ],
  "numbers": {
    "price_per_unit": { "value": 3.5, "unit": "USD", "basis": "estimate" }
  },
  "assumptions": [
    "Anything the agent guessed instead of knowing"
  ],
  "risks": [
    { "risk": "What could go wrong", "severity": "high | medium | low" }
  ],
  "needs_from_others": [
    { "agent": "finance", "request": "Check whether this price covers ingredient costs" }
  ],
  "next_steps": [
    "One concrete action the founder can take this week"
  ]
}
```

## Required numbers by agent

Each agent must include these keys in `numbers` (they can add more). Fixed key names mean the manager and Finance can find them without guessing.

| Agent | Required keys |
|---|---|
| Customer & Market | `price_per_unit`, `est_monthly_customers`, `units_per_customer_per_month` (optional: `est_marketing_cost_startup`, `est_marketing_cost_monthly`, `price_range_low`, `price_range_high`) |
| Legal & Compliance | `legal_setup_cost`, `annual_license_fees` |
| Finance | `startup_cost_total`, `monthly_fixed_costs`, `cost_per_unit`, `profit_per_unit`, `break_even_units_per_month`, `runway_months`, `funding_gap`, `expected_monthly_units` |

Finance's numbers are filled in by the calculator function (`finance_calc.py`), not typed by the AI, so they're always arithmetically correct.

Use `"basis": "estimate"` for guesses, `"basis": "calculated"` for anything worked out from other numbers, and `"basis": "researched"` for numbers taken from a real source (add `"source": "<url>"` next to it). The Manager labels estimates so the founder knows what to double-check, and shows researched numbers with their source.

## Agreed definitions

- **`unit_definition`** (Customer & Market, top-level text field, required): what one unit is, like `"one cookie"`, `"one dozen box"`, or `"one 30-minute walk"`. Market picks it because the price is set per unit. Finance costs exactly that unit.
- **`price_per_unit`** is **before sales tax.** Sales tax is collected for the state, not income, so it stays out of break-even.
- **`est_monthly_customers`** is a **steady month** once the business is running (about month 3 onward), not the slow first months. Runway already assumes zero sales, so a slow start is covered there. It's used for the Manager's capacity check and the expected monthly profit.
- **Marketing costs** are estimated by Customer & Market (it knows the channels). The calculator adds them to startup and monthly costs; Finance does not list them.
- **Price range** (`price_range_low` / `price_range_high`) comes from competitor pricing. The calculator also reports `break_even_at_price_high`, so the Manager can suggest a price raise without another call.
- **Requests between agents:** an agent answers requests addressed to it in `responses_to_others` (`agent`, `request` copied exactly, `answer`). Finance runs after Market and Legal, so it answers their requests directly; the calculator lists anything left unanswered in `unanswered_requests` for the Manager.

## Demo backup for every agent

Every agent also needs a **saved answer** in `demo/scenarios/<idea>.json`, in this exact output format, so the app can keep running if the live agent fails during the presentation. When you finish your agent, run it once on the cookie example and check that your saved answer in `cookies.json` matches the shape it actually returns. If your agent's output changes, update the saved answer too.

## Rules for all agents

- Plain language. The user may have never run a business.
- Return **only** the JSON, no extra text, so the manager can read it reliably.
- If you don't know something, put it in `assumptions` and don't present it as fact.
- Keep `key_findings` to 3-5 items and `next_steps` to 2-3.
