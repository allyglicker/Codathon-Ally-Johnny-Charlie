# Start here: first message to paste into Kiro

Open the `neur` folder in Kiro (the steering file in `.kiro/steering/neur.md` loads automatically), then paste everything between the lines below as your first message.

---

You're building **Neur**, an agentic launch planner for first-time founders, for an AWS code-a-thon. Everything you need is in this repo. Read these first, in this order, before writing any code:

1. `.kiro/steering/neur.md`: what we're building, project structure, demo mode, characters, and the Git rules. Follow it for every task.
2. `docs/handoff-format.md`: the JSON every agent returns. **Where any document disagrees with this one or with `agents/manager/prompt.md`, those two win.**
3. `docs/integration-handoff.md`: Johnny's integration spec: events, the visual signal, character states, Quill's setup.
4. `agents/*/prompt.md`: the four system prompts (Ward, Scout, Quill, Penny). Use them as written.
5. `app/launch-desk.html`: the finished, scripted demo screen. **This is the look and the order of events the live app must match.** Open it in a browser first.

**What exists already (don't rewrite it):**
- `agents/finance/finance_calc.py`: Penny's calculator. All money math goes through it.
- `demo/demo_runner.py`: runs the whole team, with live, fallback and demo modes, and returns the event list that drives the screen. Wire the app through `run_pipeline()`.
- `app/characters/*.js`: Ward, Quill, Scout and Penny, drawn on canvas. Plain JavaScript, no dependencies.

**What to build, in this order (commit after each step):**
1. Repo setup: check `.gitignore`, `.env.example` and `README.md` are right, then make the first commit and push.
2. Run the tests: `python agents/finance/finance_calc.py` and `python demo/demo_runner.py cookies` (should print $1,040 to start and break-even 300).
3. A small backend API with one endpoint, `POST /plan`, that takes a founder profile, calls `run_pipeline()`, and returns its result as JSON. Each live agent is a function that sends that agent's prompt (`agents/<name>/prompt.md`) plus the input JSON to the model and returns the reply text.
4. The front end: the intake screen (5 quick questions, one per screen), then a live version of `app/launch-desk.html` that plays `result["events"]` in order instead of its scripted steps, using **one** function that calls `setState` on the right character for each event, then the roadmap.
5. A `?demo=1` switch and a quiet "Sample data" tag whenever `used_saved_answers` is true.
6. Deploy to AWS.

**Suggested AWS setup** (check with the team before you lock it in):
- Model calls: **Amazon Bedrock** with a Claude model, so no API keys live in the code; the app uses an IAM role.
- Backend: Python (the calculator and runner are already Python), as an AWS Lambda behind API Gateway or a small App Runner service.
- Front end: static files on **AWS Amplify Hosting** (or S3 + CloudFront).
- Settings in environment variables only: `NEUR_MODE`, `NEUR_AGENT_TIMEOUT`, `NEUR_LEGAL_TIMEOUT`, `NEUR_DEMO_DELAY`, plus the Bedrock model ID and region.

**Rules:**
- Never commit secrets. AWS credentials and keys go in `.env` (ignored) or IAM roles, never in the repo.
- Don't change the shared demo script, numbers or captions in `app/launch-desk.html`, the agent prompts, or the character files without asking.
- If Quill's web search tool can't be attached the way the rest of the app is built, stop and tell us. Demo mode already covers it.
- After each step, tell us in one line what you committed and to which branch, then wait for "next."

Start with step 1.

---
