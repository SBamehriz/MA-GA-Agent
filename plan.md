# plan.md — Implementation Plan

> Engineer-facing build plan for MA-GA-Agent.
> Source of truth: [BLUEPRINT.md](BLUEPRINT.md). Architectural detail: [architecture.md](architecture.md). Agent contracts: [agents.md](agents.md). Data: [data-model.md](data-model.md). Scope: [mvp.md](mvp.md). Phase gates: [roadmap.md](roadmap.md). Risk controls: [risks.md](risks.md).

Read [CLAUDE.md](CLAUDE.md) before editing this file.

---

## 1. Plan Philosophy

- **Documentation-first.** No code lands without the corresponding spec update.
- **Spine before features.** Build evidence ledger, entity model, and workflow engine before writing agents.
- **Vertical slices over horizontal layers.** End-to-end on 5 institutions before 5x the breadth.
- **Golden-set regression from day one.** Every extractor is regression-tested against a hand-annotated set.
- **Approval-gated from day one.** Never introduce an external side-effect without a gate.

---

## 2. Repo Scaffolding (Task 0)

Directory layout (to be created when implementation begins):

```
/app                      # Next.js App Router (frontend + API)
  /(dashboard)            # authenticated app
  /(onboarding)           # onboarding flow
  /api                    # route handlers (thin)
/packages
  /db                     # Drizzle schema, migrations, queries
  /agents                 # agent modules (pure functions + tools)
  /workflows              # Inngest workflow definitions
  /extractors             # per-field extractors with Zod schemas
  /portal-adapters        # Slate, CollegeNET, Liaison, ApplyWeb, generic
  /writing                # draft/critique/rewrite loop
  /evidence               # evidence ledger utilities
  /contacts               # contact resolution + enrichment
  /shared                 # types, env, error classes, logging
/worker-browser           # separate deployable: Playwright worker (VM)
/scripts                  # ops scripts (golden-set runs, seeding)
/fixtures
  /golden                 # hand-annotated admissions pages
  /seeds                  # seed institutions
/docs                     # this doc set
```

Environment config: managed via `vercel.ts` (typed) + `vercel env pull` for local dev. See [architecture.md](architecture.md) §6.

---

## 3. Build Sequence (Chronological)

This sequence maps to [roadmap.md](roadmap.md) phases but is the engineer-level checklist.

### Task Group A — Foundations (Phase 0–1 start)

1. Create repo scaffolding (see §2).
2. Set up Neon Postgres project; create initial schema per [data-model.md](data-model.md).
3. Set up Inngest project; define an empty `coordinator` workflow.
4. Set up Vercel AI Gateway; route calls through it exclusively.
5. Set up Sentry + Axiom + OpenTelemetry tracing.
6. Provision Playwright worker VM (Fly.io or Hetzner); expose via signed HTTPS endpoint.
7. Set up Clerk for auth (Vercel Marketplace integration).
8. Implement evidence ledger tables + write-time validator that rejects unsourced facts.
9. Write 30-institution golden set (hand-annotated: program title, deadlines, fees, funding policy, top-3 faculty).

Exit: a test that writes a program record without evidence fails loudly.

### Task Group B — Research & Extraction (Phase 1)

1. Seed `university` table with curated list (CSRankings top-50 + 20 mid-tier + user-supplied).
2. Implement `UniversityDiscoveryAgent` (deterministic + Tavily search).
3. Implement `ProgramQualificationAgent` with keyword + faculty-alignment classifier.
4. Implement `RequirementsExtractionAgent` (Zod-schema extractor).
5. Implement `FeeAndWaiverAgent`.
6. Implement `FundingDiscoveryAgent` + `FundingClassificationAgent` (taxonomy-first).
7. Implement `DeadlineAgent` with two-source rule.
8. Implement PDF ingestion pipeline.
9. Golden-set regression harness: run all extractors against fixtures, produce per-field F1.

Exit: ≥85% field accuracy on 20-institution subset; evidence coverage = 100%.

### Task Group C — Scoring & Dashboard (Phase 2)

1. Implement scoring SQL + materialized view per [BLUEPRINT.md §8].
2. Implement status machine (`auto_progress_free`, `apply_now`, etc.).
3. Build dashboard routes: program list, evidence inspector, confidence badges.
4. Build onboarding flow (three sessions per [BLUEPRINT.md §5.6]).
5. Build profile attestation gate.

Exit: user can view scored list and override pins/blacklist.

### Task Group D — Writing (Phase 3)

1. Implement story bank data model + voice anchor capture.
2. Implement `WritingAgent` with draft/critique/rewrite loop.
3. Implement fact-check step (deterministic mapping of claims → story bank / profile fields).
4. Implement style-check (voice anchor similarity, cliché scan, originality heuristic).
5. Build essay review UI with inline critic notes and diff.

Exit: 3 SOPs + 5 short answers reviewed with ≤30% line-level edits by user.

### Task Group E — Portal Automation (Phase 4)

1. Implement `PortalAdapter` interface + generic fallback.
2. Implement Slate adapter (most common at R1 grad schools).
3. Implement CollegeNET adapter.
4. Implement Liaison GradCAS adapter.
5. Implement ApplyWeb adapter.
6. Implement draft-saving + state checkpointing per section.
7. Implement fee-page detection → approval gate.
8. Implement submission-gate proxy-click UX.
9. Build Playwright trace capture + action log per run.
10. Implement golden-set weekly regression of 5 canonical applications.

Exit: 5 real applications prepared to submit gate across 4 portals.

### Task Group F — Contact Intelligence (Phase 5)

1. Implement `ContactDiscoveryAgent` (faculty/grad-school/lab page crawlers).
2. Implement `ProfileEnrichmentAgent` via approved provider (Proxycurl or equivalent).
3. Implement role taxonomy + match scoring.
4. Build contact explorer UI (for internal-use, not outreach yet).
5. Implement `OutreachStrategyAgent` for drafting (not sending) per [BLUEPRINT.md §11].
6. Build outreach approval queue (drafts visible, send disabled in v1).

Exit: 30 contacts resolved with ≥0.85 confidence; 10 outreach drafts reviewed.

### Task Group G — Reliability (Phase 6)

1. Implement freshness SLAs per record class (see [data-model.md](data-model.md) §8).
2. Implement weekly refresh workflows.
3. Implement golden-set regression CI job.
4. Write runbooks for each top-10 risk in [risks.md](risks.md).
5. Load test the Playwright worker at expected concurrency.
6. Audit: 1-week continuous operation without human patching.

Exit: SLOs green, zero unrecovered failures in a week.

### Task Group H — Outreach Activation (Phase 7, post-MVP)

1. Enable outreach sending behind per-channel rate limits.
2. Implement reply tracking.
3. Implement outreach-outcome feedback into scoring.

Exit: first outreach sent with user approval; reply parsed and attached to opportunity.

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
- Every LLM call is logged through the Vercel AI Gateway (token counts, latency, model, cache hit).

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

- Dev, preview, staging, prod. Preview = per-PR.
- Env vars via `vercel env` only. No `.env` files in git.
- Secrets via Vercel env + Vault integrations (1Password).
- Prod DB branches for schema migrations using Neon's branching.

---

## 5. Definitions of Done

Per task group:

| Group | Definition of Done |
|---|---|
| A | Evidence-ledger write validator blocks unsourced writes; golden set committed. |
| B | Golden-set field F1 ≥0.85; 100% evidence coverage; per-field regression in CI. |
| C | Scored list renders with confidence badges; pins/blacklist persist across cycles. |
| D | Fact-check rejects any draft claim not mappable to story bank or profile. |
| E | One real application prepared on each of Slate/CollegeNET/Liaison/ApplyWeb with Playwright trace. |
| F | Outreach draft generated for 10 real contacts with rationale + evidence; send button disabled. |
| G | Weekly regression green; freshness SLA violations block actions on affected records. |
| H | Sent outreach tracked end-to-end; per-channel caps enforced. |

---

## 6. Pitfalls to Avoid

- **Starting with portal automation.** Without solid research and extraction, you automate bad data.
- **Skipping the evidence ledger.** Without it, every later step rots silently.
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
3. `packages/shared/env.ts` — typed env via `vercel.ts`.
4. `packages/evidence/validator.ts` — write-time evidence enforcement.
5. `packages/workflows/coordinator.ts` — Inngest coordinator workflow skeleton.
6. `packages/extractors/deadline.ts` — first specialized extractor with Zod schema + golden-set fixture.
7. `fixtures/golden/institutions.json` — 30 hand-annotated records.
8. `scripts/run-golden.ts` — regression harness.
9. `app/(onboarding)/page.tsx` — onboarding session 1.
10. `packages/portal-adapters/slate/detect.ts` — first adapter fingerprint.

Do not ship (5) through (10) in one PR. Ship 1–4 first, prove the spine works, then add surface.

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
- It does not replace [BLUEPRINT.md](BLUEPRINT.md); it operationalizes it.

---

*This plan is a living document. Update it whenever [roadmap.md](roadmap.md) or [mvp.md](mvp.md) change, per the Propagation Rules in [CLAUDE.md](CLAUDE.md).*
