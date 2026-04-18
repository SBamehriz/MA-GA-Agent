# CLAUDE.md — MA-GA-Agent System Orchestrator

> **READ ME BEFORE DOING ANY WORK IN THIS REPO.**
> This file is the single source of truth for how the MA-GA-Agent project is structured, how its documents relate, and how Claude (or any agent) must behave when extending, implementing, or modifying it.
> If this file conflicts with anything in the codebase, this file wins until it is explicitly updated.

---

## 1. Purpose of this Project

MA-GA-Agent ("Master's + Graduate Assistantship Agent") is a single-tenant, agentic admissions and funding operations system. It helps one user apply to Master's programs in Artificial Intelligence and closely related fields while simultaneously discovering and pursuing Graduate / Teaching / Research Assistantships (GA/TA/RA) and other funding that reduces or covers tuition.

The system is designed around four non-negotiable properties:

1. **Truthful** — no fact is stored, used, or submitted without URL-anchored evidence.
2. **Bounded-autonomous** — the system runs end-to-end by default, but every external side-effect (submit, pay, send, impersonate) is approval-gated.
3. **Evidence-first** — every claim carries provenance, freshness, and confidence.
4. **Replayable** — every workflow can be paused, resumed, and re-run deterministically.

This is not a chatbot. It is not a "write my SOP" tool. It is a workflow operator.

---

## 2. High-Level System Summary

The product delivers, per admissions cycle:

- A ranked, evidence-backed shortlist of 30–80 AI-relevant Master's programs.
- Per-program: funding status, fee status, deadlines, required documents, essay prompts, and a resolved human contact when available.
- Draft application materials (SOP, PS, short answers, CV, outreach) grounded in the user's verified story bank.
- Pre-filled, draft-saved applications on the actual portals (Slate, CollegeNET, Liaison GradCAS, ApplyWeb), stopped at the submit gate.
- A unified approval queue for fee-paying, submitting, letter requests, outreach sending, and any external action.
- Deadline tracking, freshness monitoring, and a transparent evidence ledger.

The user's realistic per-cycle workload drops from 100+ hours to ~15–30 hours, concentrated in onboarding, story interview, and approval review.

---

## 3. File Map and How They Connect

This repo uses **documentation-first development**. Code is scaffolded against these files, not the other way around. Every document has exactly one purpose; cross-referencing is deliberate.

| File | Purpose | Depends on | Depended on by |
|---|---|---|---|
| [BLUEPRINT.md](BLUEPRINT.md) | Original master blueprint. Full 18-section design rationale. The "why" behind every decision. | (source of truth for all derivatives) | All other docs |
| [CLAUDE.md](CLAUDE.md) | **This file.** Orchestrator and rules for how Claude must work in this repo. | BLUEPRINT.md | All other docs |
| [plan.md](plan.md) | The implementation plan. Build order, task breakdown, engineer-facing. | BLUEPRINT.md §15, architecture.md, agents.md | roadmap.md, mvp.md |
| [architecture.md](architecture.md) | System architecture. Stack, layers, deployment, cross-cutting concerns. | BLUEPRINT.md §3, §10 | plan.md, agents.md |
| [agents.md](agents.md) | Agent catalog. Per-agent contract, tools, handoffs, escalation rules. | BLUEPRINT.md §4, §11 | plan.md, data-model.md |
| [data-model.md](data-model.md) | Data model. User profile + external-world entities + evidence ledger. | BLUEPRINT.md §5, §6 | agents.md, architecture.md |
| [mvp.md](mvp.md) | What ships in v1. Scope in/out, success metrics, demo flow. | BLUEPRINT.md §14, §18 | plan.md, roadmap.md |
| [roadmap.md](roadmap.md) | Phased roadmap. Phase-by-phase deliverables, dependencies, exit criteria. | BLUEPRINT.md §15 | plan.md |
| [risks.md](risks.md) | Risk matrix. Per-risk detection, mitigation, fallback, runbook. | BLUEPRINT.md §12, §13 | architecture.md, agents.md |

**BLUEPRINT.md is the canon.** If a derivative file contradicts it, the derivative is wrong and must be fixed — not the blueprint, unless a blueprint update has been explicitly agreed to (see §6).

---

## 4. Required Reading Order Before Any Work

Before you edit *any* file, touch *any* code, add *any* feature, or answer *any* question about this system, you MUST:

1. **Read CLAUDE.md** (this file) in full.
2. **Read BLUEPRINT.md §1 and §18** (product vision + final recommendations).
3. **Read the specific derivative file(s) your change touches** in full.
4. **Read any file that the touched file depends on** (see the File Map above).

This is not optional. Partial reading of this repo has produced every wrong decision we care about preventing.

**You are forbidden from:**

- Answering "how should we X" without having read at least CLAUDE.md and the relevant derivative file.
- Adding new files without updating this file's File Map.
- Summarizing the system from memory if you have not re-read the docs in the current session.

---

## 5. Behavioral Rules for Claude When Working Here

These rules override default behaviors.

### 5.1 Truthfulness rules

- **Never invent program names, deadlines, fees, professor names, or funding figures.** If the docs do not specify, say "unspecified" or flag the question. Never fill in a plausible-sounding value.
- **Never claim a source exists that you have not seen.** If a spec says "we use Inngest," do not claim Inngest has a feature you did not verify.
- **When writing user-facing copy, placeholder content must be obvious placeholder** (e.g., `{{program_name}}`, `<TBD>`), never a realistic fake.

### 5.2 Scope rules

- **Do not expand scope.** If the docs say "MVP excludes outreach sending," do not add outreach sending "since it's easy." Features live where they live.
- **Do not introduce new dependencies without updating architecture.md.** Every library, service, or provider must be listed there with a rationale.
- **Do not merge responsibilities across agents.** Agents are deliberately single-purpose; merging creates coordination bugs.

### 5.3 Safety rules

- **Never generate code that auto-submits an application**, auto-pays a fee, auto-sends external communication, or auto-creates accounts using the user's legal identity without the approval-gate pattern described in risks.md and agents.md.
- **Never store raw credentials** in code, comments, env vars checked into git, or any DB field. Vault-only.
- **Never ship a feature that writes to an external system without an idempotency key.**
- **Never bypass the evidence requirement.** Every stored fact must have an `evidence_id[]`. No exceptions, even for "obvious" data.

### 5.4 Consistency rules

- **Use the same terminology across files.** The glossary (§9) is authoritative. If `funding_class` is the term, do not say "funding category" in one file and `funding_type` in another.
- **Use the same entity names as data-model.md.** Do not invent `Institution` when data-model.md says `university`.
- **Use the same agent names as agents.md.** Do not rename `FundingClassificationAgent` to `FundingClassifier` in a code scaffold.

### 5.5 Realism rules

- Assume portals break. Assume pages drift. Assume LinkedIn ambiguity. Assume the user will not answer your question for 48 hours.
- Do not design for happy paths only. Every workflow must specify what happens at each failure branch.
- Do not assume pages are reachable. Robots.txt, anti-bot, auth walls, 429s, and dead links are normal.

---

## 6. No-Rewrite Rule

**You may not rewrite the system from scratch.** Not in a refactor, not in a "let's simplify" pass, not in a subagent.

Allowed:
- Incremental edits to any derivative document.
- Additions that extend a section without contradicting it.
- Scaffold code that implements what is specified.

Forbidden:
- Replacing a derivative file with a "cleaner" version that drops edge cases.
- Ignoring BLUEPRINT.md because "we can figure it out as we go."
- Collapsing agents into a single monolithic "do everything" agent.
- Removing safety gates because they feel excessive.
- Rewriting entity names for aesthetics.
- Migrating to a "better" tech stack without an architecture.md update and explicit agreement.

If you believe a real rewrite is necessary, stop and produce a written proposal. Do not implement unilaterally.

---

## 7. Update Propagation Rules

When one file changes, other files may need updates. Propagation is explicit, not implicit.

| If you change... | You must also check / update |
|---|---|
| BLUEPRINT.md | All derivative files; treat as a semver-minor or major update |
| CLAUDE.md | Notify user in summary; this file's changes affect all work |
| architecture.md (stack change) | plan.md, roadmap.md, risks.md |
| architecture.md (layer/service) | agents.md, data-model.md |
| agents.md (new agent) | architecture.md, data-model.md (if new entity), plan.md, roadmap.md |
| agents.md (agent contract change) | data-model.md (inputs/outputs), any workflow doc |
| data-model.md (new entity) | agents.md (who owns it), architecture.md (storage layer) |
| data-model.md (field change) | agents.md (extraction), risks.md (freshness SLA if new volatility class) |
| mvp.md (scope change) | plan.md, roadmap.md, risks.md |
| roadmap.md (phase shift) | plan.md, mvp.md |
| risks.md (new risk) | Relevant agent's failure-mode section; approval rules if needed |

**Rule:** every PR / patch that touches a doc must include a "Propagation Checklist" at the bottom confirming which of the above were checked.

---

## 8. System-Wide Constraints (NEVER violate)

These are not preferences. They are invariants.

1. **No auto-submit.** The system never clicks the final submit button on any application in v1. A human-initiated "proxy click" confirms.
2. **No auto-pay.** Fees are never charged without an explicit user approval referencing the specific program and amount.
3. **No auto-send.** Emails, LinkedIn messages, and any external message require explicit per-message user approval.
4. **No unsourced facts.** Any record without `evidence_id[]` is invalid and blocked at write time.
5. **No vault-free credentials.** Raw passwords never touch our DB. Integration with 1Password / Bitwarden only.
6. **No silent failures.** If a step fails, the user sees it — in-app, with confidence and evidence.
7. **No out-of-scope PhD workflows in v1.** Different norms; separate product.
8. **No multi-tenant in v1.** One user.
9. **No letter storage.** Recommenders upload to portals directly.
10. **No ToS violations for data providers.** Scraping LinkedIn directly is forbidden; use approved providers or user-authenticated sessions.
11. **Every factually verifiable claim in generated writing must map to the verified story bank or a profile field.** Subjective claims are allowed; new verifiable claims are not.
12. **Freshness SLAs are law.** A record past its SLA is blocked from use until refreshed.

---

## 9. Glossary (terminology is fixed)

| Term | Definition |
|---|---|
| **Opportunity** | A GA/TA/RA/fellowship/grader role with associated funding. |
| **Program** | A specific Master's degree offering (e.g., "MS in AI, UGA"). |
| **Funding class** | Enum: `full_tuition_plus_stipend`, `full_tuition_only`, `partial_tuition`, `stipend_only`, `fee_reduction_only`, `case_by_case`, `unclear`. |
| **Relevance class** | Enum: `core`, `adjacent`, `tangential`, `rejected`. |
| **Evidence** | A URL-anchored quoted text record supporting a stored fact. |
| **Freshness SLA** | Max age of a record's evidence before it is blocked from use. |
| **Approval gate** | A required user decision before an external side-effect. |
| **Proxy click** | UX where automation prepares the submit action and user clicks a confirm button that releases it. |
| **Story bank** | ~30 user-verified vignettes used for all generated writing. |
| **Portal adapter** | A module that knows how to drive one specific admissions portal. |
| **Coordinator** | The top-level workflow that dispatches agents and owns cycle state. |
| **Golden set** | A hand-annotated set of real admissions pages used to benchmark extraction. |
| **Voice anchor** | 3–5 paragraphs of the user's own writing used as a style constraint. |

If a new term appears in a derivative file, add it here.

---

## 10. Decision Defaults

When a decision must be made and docs are silent, these defaults apply:

- **Sync vs async:** async.
- **Deterministic vs LLM:** deterministic first, LLM fallback at lower confidence.
- **Auto vs approval:** approval when in doubt.
- **Store now vs fetch later:** store with evidence; refresh per freshness SLA.
- **Fewer fields vs more fields:** fewer, typed, with provenance.
- **Agentic vs templated writing:** templated skeleton with agentic personalization.
- **Escalate to user vs guess:** escalate.
- **Specialize prompt vs generic:** specialize for the 5 highest-stakes fields (deadline, fee, tuition coverage, stipend, required documents).

---

## 11. When Claude Is Uncertain

If you hit ambiguity while working in this repo:

1. **Check CLAUDE.md, BLUEPRINT.md, and the relevant derivative file.** Most ambiguity is resolved there.
2. **Prefer the safest / least-autonomous interpretation.** If in doubt, add an approval gate.
3. **Surface the uncertainty to the user** with: (a) the ambiguous question, (b) the two or three viable interpretations, (c) which one you would pick and why.
4. **Do not silently resolve it.** Silent decisions on ambiguous points are how the system drifts.

---

## 12. How to Start a New Work Session

Every new session in this repo should begin with:

1. Open `CLAUDE.md`, `BLUEPRINT.md`, and the specific derivative file(s) relevant to the task.
2. State the task in one sentence.
3. Identify which files the task touches (use the File Map).
4. Identify which constraints from §5 and §8 apply.
5. Propose the change before executing if it touches BLUEPRINT.md, architecture.md, agents.md, or data-model.md.

---

## 13. Audit Questions Before Shipping Any Change

Before committing code or merging a doc update, answer these:

- Did I introduce an external side-effect? If yes, is it approval-gated?
- Did I add a stored field? Does it have an evidence path? A freshness SLA?
- Did I add a new dependency? Is it in architecture.md?
- Did I rename or collapse an agent? Is agents.md still consistent?
- Did I add a new entity? Is it in data-model.md?
- Did I change the MVP scope? Is mvp.md updated?
- Did I add a risk surface? Is it in risks.md?
- Did I update the Propagation Checklist?

If any answer is no and should be yes, stop and fix before proceeding.

---

## 14. Non-Negotiable North Star

> **Be loud about uncertainty, silent about success.**
> One wrong submission, one wrong-person email, or one mis-classified "tuition waiver" destroys more trust than a hundred quiet wins create.
> Design, build, and ship accordingly.

---

*Last updated: initial creation. Update this file first when anything system-wide changes.*
