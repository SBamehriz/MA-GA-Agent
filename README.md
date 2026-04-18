# MA-GA-Agent

A **local-first personal admissions and funding agent** for one user. It helps you apply to Master's programs in AI (and related fields) while simultaneously hunting for Graduate / Teaching / Research Assistantships and other funding that reduces or covers tuition.

Everything runs on your laptop. Nothing is sent to a hosted AI provider. The only AI model is **`qwen3:8b`** running locally via [Ollama](https://ollama.com).

> Not sure where to start? Read [`docs/NON_TECHNICAL_GUIDE.md`](docs/NON_TECHNICAL_GUIDE.md). It assumes zero coding background.

---

## What this tool does

1. **Onboarding** — reads your resume, transcript, and answers, builds a verified profile and a story bank, registers your writing voice.
2. **Discovery** — finds Master's programs, finds GA / TA / RA / fellowship funding, finds the right contacts, with a source attached to every fact.
3. **Writing** — drafts SOPs, short answers, cover letters, outreach, and tailored resumes. Refuses to write any fact it cannot trace to your profile or to evidence.
4. **Application prep** — per program, builds a checklist + readiness state and produces an explicit approval queue of decisions waiting on you.
5. **Approvals + persistence** — saves everything; lets you resolve approvals; resumes from saved state.

It deliberately does **not** submit applications, pay fees, send emails, or log into portals. Those side-effects are gated behind explicit human action and are not part of this build. See [`CLAUDE.md`](CLAUDE.md) §8 for the full invariants.

---

## Quick start (5 steps)

```bash
# 1. Install dependencies
pnpm install

# 2. Install and start the local model (one-time, ~6 GB download)
brew install ollama          # or platform installer from ollama.com
ollama serve                 # leave this terminal running
ollama pull qwen3:8b         # in a second terminal

# 3. Verify the model
pnpm check:model             # must end with "OK: local model is configured correctly."

# 4. Run the whole pipeline end-to-end (recommended)
pnpm run:full-cycle
#    …or run the steps one by one:
# pnpm run:onboarding
# pnpm run:research-sweep
# pnpm run:writing
# pnpm run:application-prep
# pnpm run:approval-cycle

# 5. Read the results
ls out/                      # writing/, application-prep/, approval-cycle/, full-cycle/
```

When you are ready to use the system for *yourself*, copy `fixtures/seeds/onboarding-sample.json` to a new file, replace the values with your real profile, and pass that path to `pnpm run:onboarding fixtures/seeds/me.json`.

---

## Documentation

| Doc | Audience | What it covers |
| --- | --- | --- |
| [`docs/NON_TECHNICAL_GUIDE.md`](docs/NON_TECHNICAL_GUIDE.md) | First-time non-technical user | Plain-language walkthrough end to end. |
| [`docs/SETUP_MODEL.md`](docs/SETUP_MODEL.md) | Anyone setting up the local model | Ollama install, `qwen3:8b` pull, troubleshooting. |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Operator | Exact commands, in order, with expected output. |
| [`CLAUDE.md`](CLAUDE.md) | Anyone (or any agent) editing this repo | Hard rules, invariants, file map, terminology. |
| [`BLUEPRINT.md`](BLUEPRINT.md) | Designers | Full system rationale. |
| [`agents.md`](agents.md), [`data-model.md`](data-model.md), [`architecture.md`](architecture.md), [`plan.md`](plan.md), [`roadmap.md`](roadmap.md), [`mvp.md`](mvp.md), [`risks.md`](risks.md) | Engineers | Per-area design docs. |
| [`implementation-notes.md`](implementation-notes.md) | Engineers | Honest blockers + safe defaults log per implemented block. |

---

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm check:model` | Verify the local Ollama endpoint and that `qwen3:8b` is pulled. |
| `pnpm typecheck` | Run TypeScript across the whole repo. |
| `pnpm run:onboarding [fixture.json]` | Build profile + story bank + voice anchor. |
| `pnpm run:research-sweep` | Discover programs + funding + contacts (evidence-backed). |
| `pnpm run:writing` | Generate grounded drafts (SOP, short answer, cover letter, outreach, tailored resume). |
| `pnpm run:application-prep` | Build per-program checklists, readiness, and approval items. |
| `pnpm run:approval-cycle` | Persist everything, simulate approval decisions, demonstrate workflow resume. |
| `pnpm run:full-cycle` | Run all five steps above in order, fail-fast, then audit and produce per-application "ready-to-apply" packets under `out/full-cycle/packets/<applicationId>/`. |

---

## Configuration

Optional environment variables, all with safe defaults. Copy `.env.example` to `.env` only if you want to override.

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOCAL_MODEL_ENDPOINT` | `http://localhost:11434` | Ollama HTTP endpoint. |
| `LOCAL_MODEL_NAME` | `qwen3:8b` | Model tag (must already be pulled). |
| `LOCAL_MODEL_TIMEOUT_MS` | `120000` | Per-request timeout in ms. Bump on CPU-only setups. |

---

## Status

Implemented blocks (in build order):

- onboarding-memory — profile ingestion, story bank, voice anchor, verification
- research sweep — university / program / funding / contact discovery with evidence enforcement
- writing engine — grounded drafter + critic + fact-check + style-check loop
- application preparation — per-program checklist + readiness + approval queue
- approval resolution + persistence — `application` / `applicationArtifact` / `approvalRequest` tables, `resolveApproval`, workflow resume
- local model integration (this block) — single-model `qwen3:8b` client + non-technical docs

Deferred (not started):

- portal automation (`ApplicationExecutionAgent`)
- outreach sending
- recommender coordination
- hosted auth, dashboard UI, deployment

See [`roadmap.md`](roadmap.md) and [`implementation-notes.md`](implementation-notes.md) for details.
