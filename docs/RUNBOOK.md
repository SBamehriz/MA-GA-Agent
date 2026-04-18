# Runbook

Exact commands, in order, to run the system end to end on your own machine.

If you have never used a terminal before, read [`NON_TECHNICAL_GUIDE.md`](NON_TECHNICAL_GUIDE.md) first — it explains the same flow in plain language.

---

## 0. One-time setup

```bash
# Clone and enter the repo
git clone <your-fork-url> ma-ga-agent
cd ma-ga-agent

# Install dependencies (uses pnpm)
pnpm install

# Copy the env template (optional — the defaults work)
cp .env.example .env

# Install and start the local model (see docs/SETUP_MODEL.md for full details)
brew install ollama                 # or platform-specific installer
ollama serve                        # leave this terminal running
ollama pull qwen3:8b                # in another terminal, ~6 GB download
```

Verify the model is reachable before going further:

```bash
pnpm check:model
```

You should see `OK: local model is configured correctly.` at the bottom. If not, follow the `Hint:` line printed by the probe, then read [`SETUP_MODEL.md`](SETUP_MODEL.md).

Verify the codebase compiles:

```bash
pnpm typecheck
```

---

## 0.5 Quick path: run everything end-to-end

If you just want to see the whole pipeline run top-to-bottom against the bundled sample profile, use:

```bash
pnpm run:full-cycle
```

This chains the five steps below (`run:onboarding` → `run:research-sweep` → `run:writing` → `run:application-prep` → `run:approval-cycle`) in strict order. It stops immediately if any step fails, then produces an **audit** of what actually got generated and a per-application "ready-to-apply" bundle at:

```
out/full-cycle/summary.json
out/full-cycle/packets/<applicationId>/packet.md         # human-readable overview
out/full-cycle/packets/<applicationId>/packet.json       # structured packet
out/full-cycle/packets/<applicationId>/sop.md            # full SOP text
out/full-cycle/packets/<applicationId>/personal-statement.md
out/full-cycle/packets/<applicationId>/cover-letter.md
out/full-cycle/packets/<applicationId>/resume-tailored.md
```

Useful flags (all optional):

```bash
pnpm run:full-cycle -- --fixture=fixtures/seeds/me.json
pnpm run:full-cycle -- --resume=/absolute/path/to/my-resume.pdf
pnpm run:full-cycle -- --skip-onboarding --skip-research   # re-run later stages only
pnpm run:full-cycle -- --no-audit                          # pipeline only, no sidecar packets
```

> The system still does **not** submit anything, pay any fees, or send any messages. Resume "attachment" here means *linking* the PDF path; uploading to portals is out of scope for this build.

If you prefer to step through the pipeline yourself (useful for debugging or first use), keep reading — the rest of this runbook walks through each command individually.

---

## 1. Add your information

The system runs against a JSON file that describes the user (you), their resume, their transcript, their stories, and their voice. The starting fixture is at:

```
fixtures/seeds/onboarding-sample.json
```

For your first dry run, leave it as-is — it ships with a realistic sample profile. When you are ready to use the system for *your own* applications, copy that file to a new name (e.g., `fixtures/seeds/me.json`) and edit it. The structure is documented inline in the existing file.

> **Important.** Every claim the system later writes about you (in essays, in cover letters, in resumes) must trace back to a value in this file or to a verified story. The grounding system *blocks* anything it cannot trace. There is no shortcut.

---

## 2. Run onboarding

Loads the profile JSON, parses the source documents, builds the story bank, registers the voice anchor, and emits onboarding-completion events.

```bash
pnpm run:onboarding
```

To use a custom fixture instead of the default:

```bash
pnpm run:onboarding fixtures/seeds/me.json
```

Expected: a summary table of the parsed profile, the story bank (~30 vignettes), the voice anchor status, and `onboarding.complete` at the end.

---

## 3. Run discovery (research sweep)

Finds candidate Master's programs and funding opportunities (GA / TA / RA / fellowships), classifies funding, finds program contacts, and stores everything with evidence.

```bash
pnpm run:research-sweep
```

Expected: a list of universities → programs → funding opportunities + contacts, each with a `confidence` score and an `evidence_id[]`. The integration audit at the end should report **0 unsourced rows**. If anything has a missing source, the run fails loudly — that is correct behavior, never silently fix it.

---

## 4. Run writing

Generates first-cut drafts for SOPs, short answers, cover letters, outreach, and tailored resumes — grounded in the profile and discovery data.

```bash
pnpm run:writing
```

Expected: artifacts saved under `out/writing/*.md` and `*.json`, with per-artifact `readiness` (`ready`, `needs_user_input`, `style_failed`, `grounding_failed`). Anything not `ready` will be picked up by the application-prep step as a missing or edit-required item.

> **Note.** The deterministic drafter does not call the LLM by default. The LLM client (`packages/ai`) is wired up for future opt-in personalisation passes that respect grounding; the default writing pipeline does not need it to function.

---

## 5. Run application prep

Builds an `ApplicationPacket` per program: the checklist of required documents, the readiness state, and the approval-queue items.

```bash
pnpm run:application-prep
```

Expected: per program, a checklist (required / completed / missing), a readiness state (`ready`, `needs_user_input`, `blocked`), and a list of approval items waiting for your decision. JSON snapshots saved under `out/application-prep/`.

---

## 6. Run the approval cycle

Persists everything from steps 2–5 into the local data store, simulates resolving a few approvals, and demonstrates that the workflow can resume from saved state.

```bash
pnpm run:approval-cycle
```

Expected: before/after snapshots of the persisted state, three resolved decisions (one approve, one request-edit, one missing-input approve), a pending queue for the rest, and an integration audit confirming no side-effect approvals were persisted. Output saved to `out/approval-cycle/`.

---

## 7. Resolving real approvals (manual)

Right now decisions are simulated by the harness. The real "click approve in a UI" surface is not built yet (that is a deferred block). Until then, you have two paths:

- **Inspect the queue.** Open `out/approval-cycle/snapshot__after-decisions.json` and read the `approvalRequest` rows. Each one has a `reason`, `groundingSummary`, `evidenceSummary`, and `actionType`.
- **Resolve in code.** Import `resolveApproval` from `packages/approvals/resolver` and call it from a script of your own. The harness `scripts/run-approval-cycle.ts` is the reference example.

Decisions allowed: `approve`, `reject`, `request_edit`, `skip`.

---

## 8. Common follow-ups

| You want to... | Command |
| --- | --- |
| Re-check the local model is alive | `pnpm check:model` |
| Re-run only onboarding | `pnpm run:onboarding` |
| Re-run only discovery | `pnpm run:research-sweep` |
| Re-run only writing | `pnpm run:writing` |
| Confirm the codebase still type-checks | `pnpm typecheck` |
| Reset and re-run the full chain | run steps 2 → 6 in order |

---

## What this runbook does NOT do

- It does not submit any application.
- It does not pay any fee.
- It does not send any email.
- It does not contact any recommender.
- It does not log into any portal.

Those are deferred. See [`CLAUDE.md`](../CLAUDE.md) §8 for the full invariants list. Anything that would do one of those things is required to be approval-gated and is not in this block.
