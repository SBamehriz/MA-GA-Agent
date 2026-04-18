# plan.md — Implementation Plan

> Engineer-facing build plan for MA-GA-Agent.
> Source of truth: [BLUEPRINT.md](BLUEPRINT.md). Architectural detail: [architecture.md](architecture.md). Agent contracts: [agents.md](agents.md). Data: [data-model.md](data-model.md). Scope: [mvp.md](mvp.md). Phase gates: [roadmap.md](roadmap.md). Risk controls: [risks.md](risks.md).

Read [CLAUDE.md](CLAUDE.md) before editing this file.

---

## 1. Plan Philosophy

- **Documentation-first.** No code lands without the corresponding spec update.
- **Profile-and-evidence spine before outward automation.** Build the user memory layer, evidence ledger, and typed workflow contracts before discovery breadth, writing breadth, or portal work.
- **Local-first execution before hosted polish.** The existing hosted scaffold stays, but local usefulness comes first.
- **Vertical slices over horizontal layers.** End-to-end on 5 institutions before 5x the breadth.
- **Golden-set regression from day one.** Every extractor is regression-tested against a hand-annotated set.
- **Approval-gated from day one.** Never introduce an external side-effect without a gate.

---

## 2. Repo Scaffolding (Task 0)

Directory layout (already scaffolded; preserve it and fill it in incrementally):

```
/app                      # existing operator surface (keep thin early)
  /(dashboard)            # deprioritized until discovery/writing need richer review
  /(onboarding)           # highest-priority UI surface if UI is needed
  /api                    # thin route handlers; scripts may still drive early execution
/packages
  /db                     # Drizzle schema, migrations, queries
  /agents                 # agent modules (pure functions + tools)
  /workflows              # typed workflow definitions
  /extractors             # per-field extractors with Zod schemas
  /portal-adapters        # preserved for later browser-automation phase
  /writing                # draft/critique/rewrite loop
  /evidence               # evidence ledger utilities
  /contacts               # contact resolution + enrichment
  /shared                 # types, env, error classes, logging
/worker-browser           # preserved but dormant until browser automation later
/scripts                  # primary early execution surface (local runs, seeding, onboarding)
/fixtures
  /golden                 # hand-annotated admissions pages
  /seeds                  # seed institutions
```

The current scaffold should be kept. Early implementation may rely on `/scripts` and package entrypoints before expanding dashboard, auth, or hosted infrastructure work.

Environment config: typed env/config first. Hosted-provider-specific wiring remains optional until later phases. See [architecture.md](architecture.md) §6.

---

## 3. Build Sequence (Chronological)

This sequence maps to [roadmap.md](roadmap.md) phases but is the engineer-level checklist.

### Task Group A — Foundations (Phase 0)

1. Preserve the current repo scaffolding (see §2); do not rebuild it.
2. Set up a Postgres-compatible DB and create the initial schema per [data-model.md](data-model.md).
3. Define typed env/config that works locally.
4. Implement evidence ledger tables + write-time validator that rejects unsourced facts.
5. Define the typed event registry and a local coordinator shell.
6. Commit the initial curated seed list and golden-set fixture format.

Exit: a test that writes a record without evidence fails loudly, and the project can run locally without hosted blockers.

### Task Group B — Onboarding & Memory (Phase 1)

1. Implement `user_profile_revision` plus source-document tracking for resume, transcript, and related materials.
2. Implement onboarding-answer ingestion and attestation.
3. Implement story-bank data model + `verified_by_user` flow.
4. Implement voice-anchor capture/storage.
5. Emit `onboarding.complete` only after profile attestation and story verification.
6. Add the thinnest possible local trigger/review surface (script first; UI only where it helps review).

Exit: one real user profile revision, verified stories, and a voice anchor can be persisted locally and reused downstream.

### Task Group C — Program / Funding / Contact Discovery (Phase 2)

1. Seed `university` table with a curated list (CSRankings top-50 + 20 mid-tier + user-supplied).
2. Implement `UniversityDiscoveryAgent` (deterministic + search).
3. Implement `ProgramQualificationAgent` with keyword + faculty-alignment classifier.
4. Implement `RequirementsExtractionAgent` (Zod-schema extractor).
5. Implement `FeeAndWaiverAgent`.
6. Implement `FundingDiscoveryAgent` + `FundingClassificationAgent` (taxonomy-first).
7. Implement `ContactDiscoveryAgent` + `ProfileEnrichmentAgent`.
8. Implement `DeadlineAgent` with two-source rule.
9. Implement PDF ingestion pipeline + golden-set regression harness.

Exit: ≥85% field accuracy on a 20-institution subset; evidence coverage = 100%; contact intelligence is usable internally.

### Task Group D — Writing & Resume Tailoring (Phase 3)

1. Implement `WritingAgent` with draft/critique/rewrite loop.
2. Implement fact-check step (deterministic mapping of claims → story bank / profile fields).
3. Implement style-check (voice-anchor similarity, cliché scan, originality heuristic).
4. Implement resume/CV tailoring alongside essays and short answers.
5. Add a minimal review path for generated artifacts.

Exit: 3 SOPs + 5 short answers + 2 tailored resume variants reviewed with ≤30% line-level edits by user.

### Task Group E — Application Preparation & Checklist Generation (Phase 4)

1. Implement application packet assembly from profile, evidence, and writing artifacts.
2. Implement per-program checklist generation (required docs, missing items, blockers).
3. Implement readiness states (`ready_for_review`, `missing_material`, `needs_user_input`, etc.).
4. Generate application-ready bundles without requiring portal automation.

Exit: top programs can be marked ready-for-review with complete packet/checklist state.

### Task Group F — Approval-Based Automation Support (Phase 5)

1. Implement approval queue core + audit trail.
2. Implement pause/resume workflow helpers.
3. Implement batch approvals where appropriate.
4. Implement emergency stop.

Exit: risky actions cannot proceed without explicit user approval and can be resumed safely.

### Task Group G — Browser Automation Later (Phase 6)

1. Implement `PortalAdapter` interface + generic fallback.
2. Implement Slate adapter first, then CollegeNET, Liaison GradCAS, and ApplyWeb.
3. Implement draft-saving + state checkpointing per section.
4. Implement fee-page detection → approval gate.
5. Implement submission-gate proxy-click UX.
6. Build Playwright trace capture + action log per run.
7. Implement golden-set weekly regression of canonical applications.

Exit: real applications can be prepared to submit gate without violating the earlier safety model.

### Task Group H — Reliability & Hosted Hardening (Phase 7, later)

1. Implement freshness SLAs per record class (see [data-model.md](data-model.md) §8).
2. Implement weekly refresh workflows.
3. Implement golden-set regression CI job.
4. Write runbooks for each top risk in [risks.md](risks.md).
5. Load test the Playwright worker only once browser automation exists.
6. Add hosted deployment hardening only when the local-first operator is already useful.

Exit: SLOs are green and the system runs reliably in whichever environment is actually needed.

---

## 4. Cross-Cutting Engineering Requirements

### 4.1 Idempotency

- Every external side-effect has an idempotency key: `sha256(user_id + action + target + payload_hash)`.
- Key is persisted before the action and checked on retry.
- Keys are scoped per action type; a submit key and a pay key for the same application are distinct.

### 4.2 Observability

- Every agent invocation produces a span.
- Every extraction produces an `extraction_attempt` row (success or failure).
- Every portal run produces a Playwright trace in object storage.
- Every LLM call is logged through the shared AI wrapper (token counts, latency, model, cache hit); a hosted gateway is optional.

### 4.3 Testing

- **Unit:** extractors, classifiers, scoring formula, evidence validators.
- **Integration:** agent workflows against fixtures (no live web).
- **End-to-end (dev):** full research sweep against a staged 5-institution set.
- **Golden-set regression:** CI-enforced; regressions block merges.
- **Portal smoke:** one synthetic application per portal per day in staging.

### 4.4 Migration discipline

- Schema migrations via Drizzle; never hand-edited SQL in prod.
- Data migrations are reversible or gated behind an approval step.
- Entity renames require an alias table for one cycle before removal.

### 4.5 Environment discipline

- Support local dev first; add preview/staging/prod only when they are genuinely needed.
- Env vars come from typed local env/config. No `.env` files in git.
- Secrets stay in environment management + Vault integrations (1Password).
- Hosted DB branching/migration discipline is added only when a hosted DB actually exists.

---

## 5. Definitions of Done

Per task group:

| Group | Definition of Done |
|---|---|
| A | Evidence-ledger write validator blocks unsourced writes; local runtime path works. |
| B | One attested profile revision, verified stories, and a voice anchor persist locally. |
| C | Golden-set field F1 ≥0.85; 100% evidence coverage; contact intelligence available for internal use. |
| D | Fact-check rejects any draft claim not mappable to story bank or profile; resume tailoring works from the same memory layer. |
| E | Top targets have complete packet/checklist readiness without portal automation. |
| F | Approval queue can pause/resume risky actions with auditability. |
| G | One real application can be prepared to submit gate with Playwright trace once browser automation starts. |
| H | Weekly regression green; freshness SLA violations block actions on affected records. |

---

## 6. Pitfalls to Avoid

- **Starting with portal automation.** Without solid research and extraction, you automate bad data.
- **Starting with auth, deployment wiring, or dashboard polish.** Those are support layers, not the core value.
- **Skipping the evidence ledger.** Without it, every later step rots silently.
- **Treating browser automation as the MVP proof.** The system should already be useful before it touches a portal.
- **Single generic LLM prompt for all extractions.** The top-5 fields need specialized prompts and validators.
- **Letting the WritingAgent invent facts.** The fact-check step is non-negotiable and must run before user review.
- **Putting Playwright in Vercel Functions.** Serverless kills session state. Use a VM.
- **Scraping LinkedIn directly.** Use an approved provider or a user-authenticated session; otherwise you will be blocked and possibly in ToS trouble.
- **Designing for happy paths.** Every step needs a failure branch.

---

## 7. First 10 Concrete Files to Write

Once implementation begins, this is the ordered first set:

1. `packages/db/schema.ts` — entities per [data-model.md](data-model.md).
2. `packages/db/migrations/0001_init.sql` — generated from schema.
3. `packages/shared/env.ts` — typed local-first env/config.
4. `packages/evidence/validator.ts` — write-time evidence enforcement.
5. `packages/workflows/coordinator.ts` — local coordinator workflow skeleton.
6. `packages/workflows/onboarding.ts` — onboarding-memory workflow.
7. `packages/agents/user-profile-ingestion/index.ts` — onboarding answer + source-doc ingestion.
8. `packages/agents/story-bank-builder/index.ts` — story draft + verification flow.
9. `scripts/run-onboarding.ts` — thin local trigger for the first slice.
10. `fixtures/golden/institutions.json` — curated discovery seed / golden-set starter.

Do not ship (5) through (10) in one PR. Ship 1–4 first, then the onboarding-memory slice, then discovery.

---

## 8. Operational Checklists

### 8.1 When adding a new extractor

- [ ] Zod schema in `packages/extractors`.
- [ ] At least 3 fixtures in `fixtures/golden`.
- [ ] Regression run passes.
- [ ] Freshness SLA entry in [data-model.md](data-model.md).
- [ ] Entry in [agents.md](agents.md) if it changes an agent's responsibility.

### 8.2 When adding a new portal adapter

- [ ] Implements `PortalAdapter` interface fully.
- [ ] Never implements `submit` (only `prepare_submit`).
- [ ] Fee-page detection included.
- [ ] Session recovery path specified.
- [ ] Entry in [architecture.md](architecture.md) §browser-automation.

### 8.3 When adding a new external dependency

- [ ] Justified in [architecture.md](architecture.md).
- [ ] Risk considered in [risks.md](risks.md).
- [ ] Cost implication documented.
- [ ] ToS reviewed for automated use.

---

## 9. What This Plan Does NOT Do

- It does not authorize auto-submit, auto-pay, or auto-send. These are permanently out of scope for v1.
- It does not authorize PhD workflows, multi-tenant support, or mobile apps in v1.
- It does not authorize scraping any platform outside its ToS.
- It does not require hosted deployment, auth expansion, or dashboard expansion before the first useful slice.
- It does not replace [BLUEPRINT.md](BLUEPRINT.md); it operationalizes it.

---

*This plan is a living document. Update it whenever [roadmap.md](roadmap.md) or [mvp.md](mvp.md) change, per the Propagation Rules in [CLAUDE.md](CLAUDE.md).*
