# Neur

Neur helps anyone who dreams of starting a business turn an idea into a first launch plan. The founder answers five quick questions, and a team of AI agents works together to build a one-page launch roadmap: who will buy, what it costs, what it takes to be legal, and the first five steps.

Built for the AWS code-a-thon by Ally Glicker, Johnny and Charlie.

## The team of agents

| Character | Role | What it does |
|---|---|---|
| **Ward** | Manager | Collects the founder's answers, sends work out, checks every answer against the others, writes the roadmap |
| **Scout** (a platypus) | Customer & Market | Customers, competition, price, demand, how to reach buyers |
| **Quill** (an owl) | Legal & Compliance | Business structure, licenses, local rules, setup costs, blockers |
| **Penny** (a piggy bank) | Finance | Estimates costs; a calculator does the math: break-even, runway, funding gap |

**Run order:** Scout and Quill work at the same time. Penny goes next, because she needs Scout's price and Quill's costs. Ward checks everything, sends at most one follow-up, then writes the roadmap. Every agent returns the same JSON format (`docs/handoff-format.md`), which is how they pass work to each other.

## Run it locally

```bash
# 1. Settings
cp .env.example .env          # then fill in your values

# 2. Tests (no model calls needed)
python agents/finance/finance_calc.py
python demo/demo_runner.py cookies       # $1,040 to start, break-even 300, re-check 162 at $5
python demo/demo_runner.py dog-walking

# 3. The scripted demo screen
open app/launch-desk.html                 # or double-click it
open app/characters/crew-preview.html     # the characters, animated
```

## Modes

Set `NEUR_MODE` in `.env`:
- `live`: real agents; a broken agent finishes "flagging" so it looks broken.
- `fallback`: real agents, with each agent's saved answer as a backup (shows a "Sample data" tag). Recommended for judging.
- `demo`: saved answers only, no model calls.

## Project structure

```
neur/
├── README.md, .gitignore, .env.example
├── .kiro/steering/neur.md        Build rules for Kiro
├── docs/                         Handoff format, integration and persona specs, Kiro start message
├── agents/
│   ├── manager/prompt.md         Ward
│   ├── market/prompt.md          Scout
│   ├── legal/prompt.md           Quill
│   └── finance/                  Penny: prompt.md, finance_calc.py
├── demo/                         demo_runner.py + saved scenarios (cookies, dog-walking)
└── app/
    ├── launch-desk.html          The scripted demo screen, with all four characters
    └── characters/               ward.js, quill.js, market.js, finance.js, crew-preview.html
```

Neur gives general guidance, not legal, tax or financial advice. Every roadmap points the founder to their local Small Business Development Center (SBDC) to confirm.
