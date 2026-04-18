# architecture.md - System Architecture

> Runtime profile, layers, optional deployment choices, and cross-cutting concerns for MA-GA-Agent.
> Source: [BLUEPRINT.md](BLUEPRINT.md), [agents.md](agents.md), [data-model.md](data-model.md), [risks.md](risks.md).

Read [CLAUDE.md](CLAUDE.md) before editing this file.

---

## 1. Architectural Style

MA-GA-Agent is a **single-user, local-first modular monolith** with event-driven workflow boundaries.

Key decisions:

- **One user, one operator context.** This is not a public SaaS system and does not need multi-tenant architecture.
- **Local-first execution.** The first useful slices must run from the current repo, packages, and scripts without being blocked on hosted auth, deployment, or dashboard breadth.
- **Workflow boundaries stay.** Even in local-first mode, onboarding, discovery, writing, approvals, and later automation should remain explicit workflow/state-machine boundaries.
- **Browser automation is preserved, not prioritized.** The separate worker remains part of the architecture, but it is intentionally later.

---

## 2. Current Runtime Baseline

The current implementation block should run with:

- `packages/*` as the real business-logic surface
- `/scripts` as the preferred early execution surface
- a local Postgres-compatible data model
- typed workflow events and local workflow helpers
- optional thin UI surfaces only where human review materially helps

This block does **not** require:

- hosted auth
- deployment-first infrastructure
- notification delivery
- dashboard expansion
- browser automation

---

## 3. Preserved Hosted Topology Later

The existing hosted direction remains valid when it becomes necessary:

- Next.js app for richer review and approval surfaces
- hosted Postgres if local storage stops being sufficient
- durable workflow infrastructure when local orchestration is no longer enough
- a separate Playwright worker when browser automation becomes active
- hosted observability and notification plumbing once there is enough runtime value to justify them

Keeping these later options in the design is useful. Making them blockers now is not.

---

## 4. Layer Model

### 4.1 `packages/db`

Owns:

- one local user record
- `user_profile_revision`
- source documents
- onboarding answers
- profile fields and attestation state
- stories and voice anchor records
- later external-world entities and approval data

Rules:

- typed records
- explicit revision state
- provenance/evidence support where applicable
- no raw credential storage

### 4.2 `packages/agents`

Owns agent-specific contracts and pure execution logic.

Current implementation priority:

1. `UserProfileIngestionAgent`
2. `StoryBankBuilderAgent`
3. discovery agents
4. `WritingAgent`
5. later automation/support agents

Rules:

- no cross-agent calls
- deterministic-first where possible
- evidence-first for factual claims
- preserve agent boundaries even when only a subset is active

### 4.3 `packages/workflows`

Owns state-machine boundaries and typed events.

Current focus:

- local onboarding-memory workflow
- explicit `onboarding.complete` gating

Later focus:

- research sweep
- writing orchestration
- approvals
- refresh/monitoring
- portal-driving

### 4.4 `/scripts`

Primary early execution surface for:

- local onboarding-memory runs
- local discovery runs
- test harnesses and smoke paths

Scripts are preferred before UI expansion because they keep momentum high and scope low.

### 4.5 `/app`

Optional operator console.

Current priority:

- low, except for a truly helpful onboarding review surface

Non-goal right now:

- building product-like auth, dashboard, or broad UI coverage before the core operator becomes useful

### 4.6 `worker-browser`

Preserved for later browser automation.

Why it remains separate:

- stateful sessions
- long-running browser work
- portal-specific drift handling

Why it is deferred:

- onboarding memory, discovery, writing, and preparation must be correct before portal-driving adds value

---

## 5. Runtime and Dependency Profile

### 5.1 Current implementation block

| Layer | Current choice | Notes |
|---|---|---|
| Runtime | Node.js + TypeScript | matches current scaffold |
| Execution surface | local scripts + package entrypoints | preferred early path |
| App shell | existing Next.js scaffold | keep thin and optional |
| Validation | TypeScript + Zod-style contracts | strong typed boundaries |
| Storage | local Postgres-compatible model / in-memory scaffolding while bootstrapping | enough for one-user onboarding-memory work |
| Workflow boundary | typed local events + state machines | hosted orchestration not required yet |

### 5.2 Later/optional stack

| Concern | Later option |
|---|---|
| Hosted app shell | Next.js routes and server actions |
| Hosted auth | Clerk or equivalent |
| Hosted DB | Neon or similar |
| Durable workflows | Inngest or equivalent |
| Model gateway | Vercel AI Gateway or equivalent |
| Notifications | email / in-app / SMS |
| Browser automation | VM-hosted Playwright worker |

These remain options, not current prerequisites.

---

## 6. Cross-Cutting Rules

### 6.1 Evidence and provenance

- No factual downstream use without evidence or an explicit attestation/review state.
- Onboarding-memory records must retain links back to source documents and/or onboarding answers.
- Verified stories are the only story inputs allowed into writing.

### 6.2 Approval and safety

- External side-effects remain approval-gated by design.
- The first onboarding-memory block may use direct local verification/attestation instead of a full approval queue.
- Approval infrastructure stays in the architecture but is not a blocker for the first slice.

### 6.3 Freshness

- External-world data must remain freshness-aware.
- Freshness enforcement matters later for discovery and application prep.
- Freshness is not the blocking concern for the first onboarding-memory slice.

### 6.4 Observability

- Keep the architecture compatible with spans, logs, and replay.
- Do not make hosted observability plumbing a prerequisite for early local usefulness.

---

## 7. Priority Order

The architecture must support this implementation order:

1. onboarding and deep user profile memory
2. program / funding / contact discovery
3. writing and resume tailoring
4. application preparation and checklist generation
5. approval-based automation support
6. browser automation later

Any architectural change that pulls the repo away from this order is suspect and should be challenged.

---

## 8. What This File Must Stay In Sync With

- [plan.md](plan.md) for build order
- [workflows.md](workflows.md) for active workflow boundaries
- [data-model.md](data-model.md) and [schemas.md](schemas.md) for onboarding-memory entities
- [mvp.md](mvp.md) for what actually counts as shipped value
- [roadmap.md](roadmap.md) for phased sequencing
