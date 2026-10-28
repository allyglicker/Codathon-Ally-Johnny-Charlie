# Neur

Neur helps anyone who dreams of starting a business turn an idea into a first launch plan. The founder answers five quick questions, and a team of AI agents works together to build a one-page launch roadmap: who will buy, what it costs, what it takes to be legal, and the first five steps.

Built for the AWS code-a-thon by Ally Glicker, Johnny and Charlie.

**Live demo:** https://main.d2jortcwl57u5p.amplifyapp.com (hosted on AWS Amplify, runs the whole agent team in the browser).

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

# 4. The backend API (standard library only)
python api/server.py                      # serves on http://localhost:8000
curl -X POST http://localhost:8000/plan \
  -H 'Content-Type: application/json' \
  -d '{"idea":"Homemade cookies","location":"Milledgeville, GA","startup_budget":1500}'

# 5. The live app (intake -> team at work -> roadmap)
#    The app is fully static: by default it runs the agent team in the
#    browser (demo mode), so no backend is needed.
python -m http.server 8080 --directory app
open http://localhost:8080/            # self-contained, no API required

#    To use the real Python backend instead, run the API (step 4) and point
#    the app at it:
open "http://localhost:8080/?api=http://localhost:8000"
```

## Deploying (AWS Amplify Hosting)

The `app/` folder is a static site, so it deploys to Amplify Hosting with no
build step. The public build runs the whole team in the browser via
`app/pipeline.js` + `app/scenarios.js` (a faithful port of the demo-mode
`run_pipeline()` and the finance calculator), so the hosted site needs no
backend, no AWS credentials, and makes no paid model calls.

Manual deploy (what the live demo uses):

```bash
APP_ID=$(aws amplify create-app --name neur --platform WEB \
  --region us-east-2 --query app.appId --output text)
aws amplify create-branch --app-id "$APP_ID" --branch-name main --region us-east-2
( cd app && zip -r -q /tmp/neur_app.zip . )
# create-deployment returns a jobId + zipUploadUrl; upload, then start:
# curl --upload-file /tmp/neur_app.zip "<zipUploadUrl>"
# aws amplify start-deployment --app-id "$APP_ID" --branch-name main --job-id <jobId> --region us-east-2
```

To wire continuous deploys from GitHub instead, connect the repo in the Amplify
console (one-time OAuth) and set the branch's output directory to `app`.

## The API

`api/server.py` is a small HTTP backend (Python standard library, no extra
dependencies). Every agent call goes through `run_pipeline()` in
`demo/demo_runner.py`; the UI never calls agents directly.

- `POST /plan` takes a founder profile (bare fields, or wrapped in
  `founder_profile`, plus optional `mode` and `scenario_name`), runs the agent
  team, and returns the pipeline result: `mode`, `scenario`, `outputs`,
  `events`, `warnings`, and `used_saved_answers`.
- `POST /plan?demo=1` forces demo mode, the on-stage safety switch.
- `GET /health` reports the current mode and whether live agents (Bedrock) are wired in.

Live agents call a Claude model on **Amazon Bedrock** (`api/agents.py`), using an
IAM role and the `AWS_REGION` / `BEDROCK_MODEL_ID` settings, no API keys. When
Bedrock isn't configured, the pipeline runs on the saved answers in
`demo/scenarios/`, so the server works on any machine without AWS set up.

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
├── api/
│   ├── server.py                 POST /plan, GET /health (standard library)
│   └── agents.py                 live agents on Amazon Bedrock (Claude)
└── app/
    ├── index.html                The live app: intake, team at work, roadmap
    ├── app.js                    Intake flow, plays result.events, roadmap + price slider
    ├── pipeline.js               In-browser demo pipeline (port of run_pipeline, demo mode)
    ├── scenarios.js              Saved scenarios embedded for the static build
    ├── launch-desk.html          The scripted demo screen, with all four characters
    └── characters/               ward.js, quill.js, market.js, finance.js, crew-preview.html
```

## The live app

By default the app is self-contained: with no `?api=` URL it runs the whole
agent team in the browser (`app/pipeline.js` + `app/scenarios.js`) in demo
mode, so the public build needs no backend. Point it at the Python API with
`?api=https://...` to use the real agents instead.

`app/index.html` + `app/app.js` are the three screens the founder sees:

1. **What's your dream?** Five quick questions, one per screen, with example chips,
   a budget slider and tap-to-answer options.
2. **Your team is on it.** The Launch Desk layout. The app POSTs the profile to
   `/plan`, then plays `result["events"]` in order. One function drives every
   character: it reads each event's `state` and calls `setState` on the right
   one (no per-agent branches). Folders fly between agents, Ward's trays fill,
   and a live log shows what the agents tell each other.
3. **Your launch plan.** Verdict banner, three big numbers (cost to open, sales
   to break even, how long the money lasts), a price slider that recalculates
   break-even instantly with the calculator's formula, "Watch out for" cards, a
   first-5-steps checklist, "Will it sell?" and "Getting legal".

A quiet **Sample data** tag shows whenever `used_saved_answers` is true, and
`result["warnings"]` are logged to the console. Force demo mode with `?demo=1`
in the URL or by pressing **d** on the team screen. Point the app at a different
API with `?api=https://...`.

Neur gives general guidance, not legal, tax or financial advice. Every roadmap points the founder to their local Small Business Development Center (SBDC) to confirm.
