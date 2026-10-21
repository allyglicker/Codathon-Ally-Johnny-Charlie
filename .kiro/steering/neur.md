# Neur: Build Instructions for Kiro

Paste this as your first prompt in Kiro, or save it as a steering file at `.kiro/steering/neur.md` so Kiro follows it for every task.

---

## What we're building

Neur is a web app that helps anyone who dreams of starting a business. The founder answers 5 quick questions, and a team of AI agents builds them a one-page launch plan.

- **Manager agent ("Ward"):** collects the founder's answers, sends work to the other agents, checks their answers against each other for conflicts, and writes the final launch roadmap.
- **Customer & Market agent ("Scout", a platypus):** customers, competitors, pricing.
- **Legal & Compliance agent ("Quill", an owl):** business structure, licenses, setup costs.
- **Finance agent ("Penny", a piggy bank):** estimates costs. A calculator function (code, not AI) does the math: break-even, runway, profit per unit, funding gap.

Run order: Market and Legal run at the same time, then Finance (it needs their numbers), then the Manager checks everything. Every agent returns the same JSON handoff format. See `docs/handoff-format.md`.

**The agents must visibly work with each other, not just side by side.** The UI shows each handoff between agents and the Manager's conflict check, as in the design mockups.

## Web app: three screens (desktop web)

1. **What's your dream?** One question per screen, tap-to-answer where possible (idea + example chips, city, budget slider, hours chips, timeline).
2. **Your team is on it.** Manager on top, three agents below, connecting lines that light up as each handoff happens, a live caption of the current step, and a log of what the agents are telling each other.
3. **Your launch plan.** Verdict banner, three big numbers (cost to open, sales to break even, how long the money lasts), a price slider that recalculates instantly using the calculator, "Watch out for" cards, a first-5-steps checklist, Will it sell?, and Getting legal.

Plain language everywhere. No business jargon without a short explanation.

## Project structure

```
neur/
├── README.md, .gitignore, .env.example
├── .kiro/steering/neur.md          this file
├── docs/
│   ├── KIRO_START.md               the first message and build order
│   ├── handoff-format.md           the JSON every agent returns (wins any conflict)
│   ├── integration-handoff.md      Johnny's spec: events, visual signal, character states, Quill setup
│   └── persona-handoff.md          Johnny's spec for the character drawings
├── agents/
│   ├── manager/prompt.md           Ward
│   ├── market/prompt.md            Scout (Charlie's final)
│   ├── legal/prompt.md             Quill
│   └── finance/
│       ├── prompt.md               Penny
│       └── finance_calc.py
├── demo/
│   ├── demo_runner.py
│   └── scenarios/
│       ├── cookies.json
│       └── dog-walking.json
└── app/
    ├── launch-desk.html            the scripted demo screen with all four characters
    └── characters/                 ward.js, quill.js, market.js, finance.js, crew-preview.html
```

If the back end is JavaScript/TypeScript, port `finance_calc.py` to that language and keep the formulas exactly the same. Keep the original Python file in the repo for reference.

## Demo mode: every agent needs a backup path

We're presenting live, so every agent must have a way to keep the demo running if something breaks (no internet, slow API, bad JSON). `demo/demo_runner.py` already does this. Wire the app through it:

- **Route every agent call through `run_pipeline()`** in `demo/demo_runner.py`, passing each live agent function in `live_agents`. Don't call agents directly from the UI.
- **Three modes, set by `NEUR_MODE` in `.env`** (add it to `.env.example`, default `fallback`):
  - `live`: real agents only; errors show as errors (for testing).
  - `fallback`: try the real agent; if it fails, times out (`NEUR_AGENT_TIMEOUT`, default 25 seconds) or returns bad JSON, use that agent's saved answer. **Use this mode for the presentation.**
  - `demo`: saved answers only, with a short delay per agent (`NEUR_DEMO_DELAY`, default 1.5 seconds) so the handoff animation still plays.
- **Saved answers live in `demo/scenarios/*.json`,** one file per business idea, holding a saved output for every agent (Market, Legal, Finance cost estimates, and the Manager's conflict exchanges and roadmap). The runner picks a scenario by matching keywords in the founder's idea and defaults to cookies.
- **The Finance math always runs through the real calculator,** even with saved answers, including the Manager's price re-check. The price slider must keep working in every mode.
- **Use `result["events"]`** to drive the screen. Each event has `event` (like `finance.waiting` or `legal.done`), `agent`, the character `state` to set, and, when a folder flies, `frm`, `to`, `tab` and `est` (dashed folder edge). It's the same shape in every mode.
- **Every output carries `_source`** (`live`, `demo`, or `demo_fallback`). Show a small, quiet "Sample data" tag on screen 3 whenever `used_saved_answers` is true, and log `result["warnings"]` to the console so the team can see what fell back.
- Add a hidden keyboard shortcut or a `?demo=1` URL option that forces demo mode, so we can switch instantly on stage without editing files.
- To add a new demo idea, copy `cookies.json`, change the values, and keep every required number key from `docs/handoff-format.md`.
- Test command: `python demo/demo_runner.py cookies`. It should print cost to open $1,040, break-even 300, and 17 events ending with Penny's re-check (break-even 162 at $5) and Ward delivering the roadmap.

## Characters and the visual signal

`app/launch-desk.html` is the finished scripted demo: the live app should look like it and play events in the same order. The characters live in `app/characters/`: `ward.js` (Ward, Manager), `quill.js` (Quill, Legal), `market.js` (Scout, Customer & Market) and `finance.js` (Penny, Finance). Each is plain JavaScript with no dependencies.

- Give each canvas `aspect-ratio: 270 / 260`, then call `createWard`, `createQuill`, `createMarket` or `createFinance` on it.
- Every character accepts the five universal states: `idle`, `waiting`, `working`, `flagging`, `done` (Ward also has `delegating`).
- Drive all of them with **one** function that reads each event's `state` and calls `setState`. No per-agent branches in the animation code.
- Every specialist JSON has `signal` (`clear` or `flag`) and `tab` (folder text, 40 characters or fewer). An agent finishes `flagging` when `signal` is `flag`. Penny's `signal` and `tab` come from the calculator.
- `crew-preview.html` shows Scout, Quill and Penny animated side by side, for checking.

## Git and GitHub: do this as we work

This project is connected to GitHub. Handle Git for us automatically:

1. **Set up the repo files first**, before writing app code:
   - `.gitignore` covering dependencies and build output (`node_modules/`, `dist/`, `build/`, `__pycache__/`, `.venv/`), environment files (`.env`, `.env.local`), OS and editor files (`.DS_Store`, `.vscode/`, `.idea/`), and log files.
   - `.env.example` listing every environment variable the app needs, with placeholder values only.
   - `README.md` with: what Neur is (2-3 sentences), the agent team and run order, how to install and run it locally, the project structure, and the team (Ally, Johnny, Charlie).
2. **Never commit secrets.** No AWS keys, API keys, or tokens in any committed file. Real values go only in `.env`, which is ignored. If you see a secret about to be committed, stop and tell us.
3. **Commit after every working step,** not in one big batch at the end. Small commits with clear messages that say what changed, for example:
   - `Add finance agent prompt and calculator`
   - `Build intake screen with example idea chips`
   - `Connect market agent output to finance agent`
4. **Pull before you push** so teammates' work isn't overwritten.
5. **Use a branch per piece of work** when more than one of us is building at once (`finance-agent`, `market-agent`, `legal-agent`, `ui`), then merge into `main` once it runs. Ask before merging if there are conflicts.
6. **Keep `main` working.** Only merge code that runs. Before a merge, run the app, the calculator test (`python agents/finance/finance_calc.py`) and the demo test (`python demo/demo_runner.py cookies`) to check nothing broke. Commit the demo scenario files; they contain no secrets.
7. **Update the README** whenever setup steps, environment variables, or the project structure change.
8. After each push, tell us in one line what was committed and to which branch.

## Rules for the build

- Agents return **only** JSON in the shared handoff format. Validate it before passing it on. If an agent returns bad JSON, retry once, then show a friendly error.
- The Finance numbers always come from the calculator, never typed by the AI.
- Label estimates as estimates. Never present a guess as a fact.
- Show a one-line note on the plan screen: general guidance, not legal or financial advice; confirm legal and tax steps with your local Small Business Development Center (SBDC).
