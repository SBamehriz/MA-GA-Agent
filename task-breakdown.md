# task-breakdown.md — MVP Engineering Task Breakdown

> Actionable task list for the MVP. Organized by area. Every task has name, description, priority, dependencies, and done criteria.
>
> Source: [CLAUDE.md](CLAUDE.md), [plan.md](plan.md), [roadmap.md](roadmap.md), [mvp.md](mvp.md), [architecture.md](architecture.md), [agents.md](agents.md), [data-model.md](data-model.md), [risks.md](risks.md), [implementation-sequence.md](implementation-sequence.md), [repo-structure.md](repo-structure.md), [schemas.md](schemas.md), [workflows.md](workflows.md), [api-spec.md](api-spec.md), [agent-prompts.md](agent-prompts.md).
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 0. Priority Legend

- **P0** — blocking: no phase can proceed without it.
- **P1** — in-phase must-have.
- **P2** — important but phase can demo without it.
- **P3** — nice-to-have inside MVP window.

Dependencies reference task IDs (e.g., `INF-02`) or phase exits (`Phase 0 Exit`).

---

## 1. Infrastructure (INF)

### INF-01 — Repo scaffolding

- **Description:** Create pnpm workspace, directory structure per [repo-structure.md](repo-structure.md), tsconfig.base, ESLint with boundaries plugin, Prettier, EditorConfig.
- **Priority:** P0
- **Dependencies:** none.
- **Done:** `pnpm install` and `pnpm typecheck` pass on CI.

### INF-02 — Typed env (`vercel.ts` + `packages/shared/env.ts`)

- **Description:** Zod-validated env; `.env.example` mirror; boot-time abort on missing vars.
- **Priority:** P0
- **Dependencies:** INF-01.
- **Done:** unit test rejects a missing required var; CI fails if `.env.example` drifts from schema.

### INF-03 — Clerk auth + middleware

- **Description:** Clerk provider, MFA enforced on primary user, middleware gates `(dashboard)` and `(onboarding)`.
- **Priority:** P0
- **Dependencies:** INF-02.
- **Done:** anonymous requests to gated routes 302 to sign-in; integration tests green.

### INF-04 — Neon Postgres project + Drizzle setup

- **Description:** Provision dev, preview, prod branches; Drizzle config; migration scripts; connection pooling.
- **Priority:** P0
- **Dependencies:** INF-02.
- **Done:** `pnpm db:migrate` applies cleanly on each branch; rollback works.

### INF-05 — Inngest project + signing

- **Description:** Create Inngest project; register webhook at `/api/inngest`; signing key in env.
- **Priority:** P0
- **Dependencies:** INF-02.
- **Done:** a trigger from server action causes a registered function to run.

### INF-06 — Vercel AI Gateway

- **Description:** Gateway configured; per-task routing table; prompt caching enabled; CI lint rule forbids direct provider SDK imports outside `packages/shared/ai.ts`.
- **Priority:** P0
- **Dependencies:** INF-02.
- **Done:** smoke prompt routes through gateway; a lint violation fails CI.

### INF-07 — Observability (Sentry + Axiom + OTel)

- **Description:** Sentry init; Axiom logger; OpenTelemetry traces propagated including through gateway.
- **Priority:** P0
- **Dependencies:** INF-02.
- **Done:** smoke test produces one span in Axiom, one error in Sentry, one trace with AI-gateway child span.

### INF-08 — Playwright worker VM (skeleton)

- **Description:** Dockerfile, Fastify server, mTLS, `/health` endpoint, Fly.io deploy.
- **Priority:** P0
- **Dependencies:** INF-02, INF-07.
- **Done:** `workerClient.health()` returns ok over mTLS; plain HTTPS rejected.

### INF-09 — Vercel Blob + Upstash Redis

- **Description:** Provision private Blob; Upstash Redis instance; helpers in `packages/shared/rate-limit.ts`.
- **Priority:** P0
- **Dependencies:** INF-02.
- **Done:** integration test uploads + reads a test blob; rate-limit helper enforces a per-key window.

### INF-10 — CI pipelines

- **Description:** `ci.yml`, `boundaries.yml`, `db-migrate.yml`, `golden.yml` (placeholder), `deploy.yml`.
- **Priority:** P0
- **Dependencies:** INF-01.
- **Done:** all workflows green on main; PR checks required.

---

## 2. Database (DB)

### DB-01 — Enums + base tables

- **Description:** Implement all enums from [schemas.md §2](schemas.md); base tables `user`, `user_profile_revision`, `story`, `voice_anchor`, `vault_reference`.
- **Priority:** P0
- **Dependencies:** INF-04.
- **Done:** migration applies on a fresh branch; `pnpm typecheck` passes against Drizzle types.

### DB-02 — External-world tables

- **Description:** `university`, `school_or_college`, `department`, `graduate_program`, `admissions_cycle`, `application_deadline`, `fee_policy`, `requirement_set`, `essay_prompt`, `funding_opportunity`, `portal_binding`, `professor`, `lab`, `person`, `person_role`, `linkedin_profile`, `professional_profile`, `field_candidate`.
- **Priority:** P0
- **Dependencies:** DB-01.
- **Done:** full schema migration applies; every interpreted table has `evidence_id` NOT NULL + CHECK length ≥1.

### DB-03 — Append-only audit tables

- **Description:** `evidence`, `action_log`, `extraction_attempt`, `idempotency_ledger`. Postgres role with SELECT+INSERT only for app user; trigger blocking non-INSERT.
- **Priority:** P0
- **Dependencies:** DB-01.
- **Done:** direct UPDATE/DELETE attempts fail with role-level error.

### DB-04 — Application runtime tables

- **Description:** `application`, `application_section_state`, `application_artifact`, `approval_request`, child profile tables.
- **Priority:** P0
- **Dependencies:** DB-01, DB-02.
- **Done:** full CRUD round-trip tests pass; `application` UNIQUE on `(user_id, program_id, cycle_id)` enforced.

### DB-05 — Indexes

- **Description:** Create all indexes from [schemas.md §10](schemas.md).
- **Priority:** P0
- **Dependencies:** DB-02, DB-04.
- **Done:** `EXPLAIN ANALYZE` on key queries uses expected indexes.

### DB-06 — Evidence write-time validator

- **Description:** `packages/evidence/validator.ts` + DB trigger + wrapper inserts only.
- **Priority:** P0 (blocking for Phase 0 exit)
- **Dependencies:** DB-02, DB-03.
- **Done:** unit + integration test: any interpreted-table insert without evidence throws at application layer and is rejected at DB.

### DB-07 — Freshness SLA helpers

- **Description:** `packages/evidence/freshness.ts` + `packages/db/freshness.ts`; query wrappers return `stale: true` for stale records.
- **Priority:** P1
- **Dependencies:** DB-02, DB-06.
- **Done:** property test covers each record class per [data-model.md §3](data-model.md).

### DB-08 — `source_quality` seed

- **Description:** Seed domain-quality table (.edu 0.9, .gov 0.9, approved aggregators 0.7, etc.).
- **Priority:** P1
- **Dependencies:** DB-02.
- **Done:** all 30 golden-set source domains have entries.

### DB-09 — Data export + deletion scripts

- **Description:** `scripts/export-user.ts`, delete script honoring retention rules.
- **Priority:** P2
- **Dependencies:** DB-02, DB-03, DB-04.
- **Done:** dry-run export produces valid JSON bundle; delete preserves `evidence` (non-PII).

---

## 3. Workflows (WF)

### WF-01 — Inngest coordinator skeleton

- **Description:** `packages/workflows/coordinator.ts` with no-op steps matching the research sweep; typed event registry.
- **Priority:** P0
- **Dependencies:** INF-05.
- **Done:** `cycle.started` event runs coordinator to `cycle.complete`.

### WF-02 — Onboarding workflow

- **Description:** Implement per [workflows.md §3](workflows.md). Includes attestation gate approval pattern.
- **Priority:** P1
- **Dependencies:** WF-01, DB-01, DB-04, AG-USR-PROFILE (§4), AG-STORY-BANK.
- **Done:** a test user completes three sessions and attests; revision locked.

### WF-03 — Research sweep workflow

- **Description:** Fan-out coordinator per [workflows.md §4](workflows.md).
- **Priority:** P0
- **Dependencies:** WF-01, agents in §4.
- **Done:** 20 institutions processed end-to-end with 100% evidence coverage.

### WF-04 — Funding verification workflow

- **Description:** Per [workflows.md §5](workflows.md). Includes conflict approvals on critical funding fields.
- **Priority:** P1
- **Dependencies:** WF-03, AG-FUNDING-DISCOVERY, AG-FUNDING-CLASSIFICATION.
- **Done:** R5 regression passes (soft phrases never classified as full).

### WF-05 — Contact discovery workflow

- **Description:** Per [workflows.md §6](workflows.md). Internal-only use in MVP.
- **Priority:** P2 (Phase 5)
- **Dependencies:** WF-03, AG-CONTACT-DISCOVERY, AG-PROFILE-ENRICHMENT.
- **Done:** 30 contacts resolved with ≥0.85 confidence on golden test set.

### WF-06 — Writing workflow

- **Description:** Per [workflows.md §7](workflows.md). Includes draft/critique/rewrite loop + fact-check + style-check.
- **Priority:** P1 (Phase 3)
- **Dependencies:** WF-01, AG-WRITING, story bank + voice anchor captured.
- **Done:** 3 SOPs + 5 short answers reviewed with ≤30% line-level edits by user.

### WF-07 — Application preparation workflow

- **Description:** Per [workflows.md §8](workflows.md). Portal adapters, fee-page gate, submission-preview, proxy-click release.
- **Priority:** P1 (Phase 4)
- **Dependencies:** WF-01, BA-* (§7), AG-APPLICATION-EXECUTION, AP-* (§8).
- **Done:** 5 real applications prepared to submit gate across 4+1 portals.

### WF-08 — Approval resolution workflow

- **Description:** Per [workflows.md §9](workflows.md).
- **Priority:** P0
- **Dependencies:** AP-01, AP-02.
- **Done:** round-trip: create approval → decide → waiting workflow resumes.

### WF-09 — Batch approvals workflow

- **Description:** Per [workflows.md §10](workflows.md).
- **Priority:** P1
- **Dependencies:** WF-08.
- **Done:** approving 10 free apps with one batch emits 10 individual actions with audit trail.

### WF-10 — Deadline monitor workflow

- **Description:** Per [workflows.md §11](workflows.md).
- **Priority:** P1
- **Dependencies:** WF-01, DB-02.
- **Done:** 14/7/3/1-day escalations fire with correct urgency and evidence check.

### WF-11 — Refresh workflow

- **Description:** Per [workflows.md §12](workflows.md). Nightly + event-driven.
- **Priority:** P1
- **Dependencies:** WF-01, DB-07.
- **Done:** stale-record action test: action halted until refresh completes.

### WF-12 — Emergency stop workflow

- **Description:** Per [workflows.md §13](workflows.md).
- **Priority:** P0
- **Dependencies:** INF-05, INF-08, AP-01.
- **Done:** stop cancels all runs, logs out portals, expires pending approvals.

---

## 4. Agents (AG)

Each task creates: `packages/agents/<name>/contract.ts`, `prompt.ts`, `index.ts`; registers with event registry; writes golden-set regression.

### AG-UNIV-DISC — UniversityDiscoveryAgent

- **Description:** Implement per [agents.md §4.1](agents.md) and [agent-prompts.md §1](agent-prompts.md).
- **Priority:** P1 (Phase 1)
- **Dependencies:** DB-02, INF-06, crawlers (EXT-01).
- **Done:** discovery test rediscovers 5 seeded universities; escalates unseen high-signal institution.

### AG-PROG-QUAL — ProgramQualificationAgent

- **Description:** Classify relevance class per [agents.md §4.2](agents.md) / [agent-prompts.md §2](agent-prompts.md).
- **Priority:** P1
- **Dependencies:** AG-UNIV-DISC, EXT-01.
- **Done:** ≥0.85 class agreement on 20-institution golden subset.

### AG-REQ — RequirementsExtractionAgent

- **Description:** `requirement_set` + `essay_prompt` extraction.
- **Priority:** P1
- **Dependencies:** AG-PROG-QUAL, EXT-02.
- **Done:** per-field F1 ≥0.85 on LoR count, GRE policy, SOP required.

### AG-FEE — FeeAndWaiverAgent

- **Description:** Fee amount + waiver workflow per [agents.md §4.4](agents.md).
- **Priority:** P1
- **Dependencies:** AG-PROG-QUAL, EXT-02.
- **Done:** fee F1 ≥0.85.

### AG-FUNDING-DISCOVERY — FundingDiscoveryAgent

- **Description:** Enumerate opportunities per [agents.md §4.5](agents.md) / [agent-prompts.md §3](agent-prompts.md).
- **Priority:** P1
- **Dependencies:** AG-PROG-QUAL, EXT-01.
- **Done:** 10 real opportunities discovered with evidence on golden set.

### AG-FUNDING-CLASSIFICATION — FundingClassificationAgent

- **Description:** Taxonomy-first classification per [agents.md §4.6](agents.md) / [agent-prompts.md §4](agent-prompts.md) (R5 gating).
- **Priority:** P1
- **Dependencies:** AG-FUNDING-DISCOVERY, CL-02.
- **Done:** manual audit agreement ≥0.90 on n=30; soft-phrase regression passes.

### AG-DEADLINE — DeadlineAgent

- **Description:** Deadline types + two-source rule.
- **Priority:** P1
- **Dependencies:** AG-PROG-QUAL, EXT-02.
- **Done:** deadline F1 ≥0.85; solo-source within 30 days surfaces approval.

### AG-PORTAL-MAPPER — PortalMapperAgent

- **Description:** Fingerprint portals; persist `portal_binding`.
- **Priority:** P1
- **Dependencies:** AG-PROG-QUAL, BA-01.
- **Done:** 10 known portal URLs fingerprinted ≥0.9 confidence.

### AG-CONTACT-DISCOVERY — ContactDiscoveryAgent

- **Description:** Directory + lab page contact resolution per [agent-prompts.md §5](agent-prompts.md).
- **Priority:** P2 (Phase 5)
- **Dependencies:** AG-PROG-QUAL, EXT-01.
- **Done:** 30 contacts resolved with quoted evidence.

### AG-PROFILE-ENRICHMENT — ProfileEnrichmentAgent

- **Description:** Approved provider (Proxycurl / PDL) + Scholar multi-signal match per [agents.md §4.10](agents.md).
- **Priority:** P2 (Phase 5)
- **Dependencies:** AG-CONTACT-DISCOVERY, CN-01.
- **Done:** ≥0.85 confidence bindings for 10 test contacts; no direct LinkedIn scrape.

### AG-USR-PROFILE — UserProfileIngestionAgent

- **Description:** Parse transcript + resume; fill profile child tables per [agents.md §4.11](agents.md).
- **Priority:** P1
- **Dependencies:** DB-01, EXT-03.
- **Done:** 3 representative transcripts + resumes parsed correctly.

### AG-STORY-BANK — StoryBankBuilderAgent

- **Description:** Conversational interviewer + resume cross-reference; emits ~30 candidate stories; user verification gate.
- **Priority:** P1
- **Dependencies:** AG-USR-PROFILE.
- **Done:** story draft workflow runs end-to-end; only `verified_by_user = true` flow downstream.

### AG-WRITING — WritingAgent

- **Description:** Draft/critique/rewrite/fact-check/style-check per [agents.md §4.13](agents.md) / [agent-prompts.md §6](agent-prompts.md).
- **Priority:** P1 (Phase 3)
- **Dependencies:** AG-STORY-BANK, DB-01, WR-01.
- **Done:** ≤30% user line-edits on reviewed drafts.

### AG-APPLICATION-EXECUTION — ApplicationExecutionAgent

- **Description:** Drive portals per [agents.md §4.14](agents.md) / [agent-prompts.md §7](agent-prompts.md).
- **Priority:** P1 (Phase 4)
- **Dependencies:** BA-*.
- **Done:** 5 apps prepared across 4+1 portals.

### AG-RECO-COORD — RecommendationCoordinator

- **Description:** Per-recommender approval; status machine.
- **Priority:** P1
- **Dependencies:** AG-APPLICATION-EXECUTION, AP-01.
- **Done:** 3 test recommenders invited only after explicit approvals.

### AG-OUTREACH — OutreachStrategyAgent (drafts only)

- **Description:** Draft outreach per policy filter.
- **Priority:** P2 (Phase 5)
- **Dependencies:** AG-CONTACT-DISCOVERY, AG-PROFILE-ENRICHMENT.
- **Done:** 10 outreach drafts visible with rationale; send button physically absent.

### AG-APPROVAL-CHECKPOINT — ApprovalCheckpointAgent

- **Description:** Build approval items + pause/resume per [agent-prompts.md §8](agent-prompts.md).
- **Priority:** P0
- **Dependencies:** AP-01.
- **Done:** any workflow can create + await an approval with correct payload.

### AG-DEADLINE-MONITOR — DeadlineMonitorAgent

- **Description:** Urgency flags + refresh jobs per [agents.md §4.18](agents.md).
- **Priority:** P1
- **Dependencies:** WF-10.
- **Done:** 14/7/3/1-day escalations fire correctly.

### AG-FOLLOW-UP — FollowUpAgent

- **Description:** Post-submission drafts per [agents.md §4.19](agents.md).
- **Priority:** P2
- **Dependencies:** AG-APPLICATION-EXECUTION.
- **Done:** follow-up draft created for one test submission; send gated.

---

## 5. Extractors & Crawlers (EXT) + Classifiers (CL)

### EXT-01 — Crawl infrastructure

- **Description:** Firecrawl + Tavily + SerpAPI adapters; per-domain rate limit; content-hash cache to Blob; per-run budgets.
- **Priority:** P0
- **Dependencies:** INF-06, INF-09.
- **Done:** cache hit on identical content skips network; budget overrun raises typed error.

### EXT-02 — Specialized extractors (deadline, fee, tuition, stipend, required_documents)

- **Description:** Zod schema + specialized prompt + regex post-validator per field. Include three golden fixtures per field.
- **Priority:** P0
- **Dependencies:** EXT-01, DB-06.
- **Done:** per-field F1 ≥0.85; deterministic re-run on same hash.

### EXT-03 — PDF ingestion

- **Description:** Text-based PDF parsing; OCR fallback for image-only.
- **Priority:** P0
- **Dependencies:** EXT-01.
- **Done:** 3 real admissions PDFs parsed; OCR fallback tagged low-confidence.

### CL-01 — Relevance classifier

- **Description:** Deterministic keyword density + faculty alignment wrapper.
- **Priority:** P1
- **Dependencies:** EXT-01.
- **Done:** agreement ≥0.85 on golden subset.

### CL-02 — Funding taxonomy

- **Description:** Phrase allowlist / deny list per R5; JSON data file + matcher.
- **Priority:** P0
- **Dependencies:** DB-02.
- **Done:** deny-list phrases never produce full-tuition classification in regression.

### CL-03 — Role taxonomy

- **Description:** Role-tag mapping for contacts.
- **Priority:** P2
- **Dependencies:** EXT-01.
- **Done:** 10 test directory entries classified correctly.

### CL-04 — Portal fingerprints

- **Description:** DOM + URL signals per vendor.
- **Priority:** P1
- **Dependencies:** EXT-01.
- **Done:** 10 known URLs detected ≥0.9.

### EXT-04 — Golden-set regression harness

- **Description:** `scripts/run-golden.ts` + CI job; per-field F1 report; regression blocks merges.
- **Priority:** P0
- **Dependencies:** EXT-02, CL-01..04.
- **Done:** intentional prompt degradation on a feature branch fails CI.

---

## 6. Frontend / Dashboard (FE)

### FE-01 — Design-system primitives

- **Description:** shadcn/ui + Tailwind; app shell; theme.
- **Priority:** P0
- **Dependencies:** INF-01.
- **Done:** consistent navigation + primary components (button, card, table) in `packages/ui`.

### FE-02 — Onboarding flow UI

- **Description:** Sessions 1–3 + attestation page per [workflows.md §3](workflows.md) and [mvp.md §2.1](mvp.md).
- **Priority:** P1
- **Dependencies:** FE-01, AG-USR-PROFILE, AG-STORY-BANK.
- **Done:** full flow completable in ≤3 sessions by a test user.

### FE-03 — Dashboard overview

- **Description:** Current cycle state; counts (programs, applications, approvals, deadlines).
- **Priority:** P1
- **Dependencies:** FE-01, DB-02, WF-03.
- **Done:** real-user walkthrough of [mvp.md §9](mvp.md) step 7 succeeds.

### FE-04 — Ranked program list

- **Description:** Scored list with filters, pin/blacklist, evidence + confidence badges.
- **Priority:** P1
- **Dependencies:** FE-03, DB-02, WF-03.
- **Done:** 20 programs visible with per-row evidence drill-down.

### FE-05 — Evidence inspector

- **Description:** Per-fact snippet browser; last-verified timestamp; freshness badges.
- **Priority:** P1 (Phase 1 exit)
- **Dependencies:** DB-03, DB-07.
- **Done:** every fact reachable from its row with its quoted evidence.

### FE-06 — Essay review UI

- **Description:** Draft viewer; inline critic notes; diff view; cliché + voice-anchor badges; approve button.
- **Priority:** P1 (Phase 3)
- **Dependencies:** AG-WRITING, DB-04.
- **Done:** user can review + approve a draft end-to-end.

### FE-07 — Approval queue

- **Description:** Unified approval list; per-item detail; decide UI; batch approval UI.
- **Priority:** P0
- **Dependencies:** AP-01, AG-APPROVAL-CHECKPOINT.
- **Done:** approve / edit / skip all round-trip to workflows.

### FE-08 — Application & submission preview

- **Description:** Section-by-section state; Playwright trace link; fee status; submission preview + proxy-click confirm.
- **Priority:** P1 (Phase 4)
- **Dependencies:** WF-07.
- **Done:** one real submission proxy-confirmed end-to-end.

### FE-09 — Contact explorer (read-only)

- **Description:** Contact list with role, confidence, evidence, last-verified.
- **Priority:** P2 (Phase 5)
- **Dependencies:** AG-CONTACT-DISCOVERY, AG-PROFILE-ENRICHMENT.
- **Done:** 30 contacts visible with filters.

### FE-10 — Settings page

- **Description:** Preferences, quiet hours, vault references, emergency stop.
- **Priority:** P1
- **Dependencies:** DB-01.
- **Done:** all settings persist and reload.

### FE-11 — Outreach drafts (read-only; v1 has no send button)

- **Description:** View outreach drafts + rationale; approve-drafts-only marker.
- **Priority:** P2 (Phase 5)
- **Dependencies:** AG-OUTREACH.
- **Done:** send button physically absent from bundle.

### FE-12 — Status + confidence component library

- **Description:** `packages/ui/confidence-badge.tsx`, `freshness-badge.tsx`, `status-pill.tsx`, `critic-note.tsx`, `diff-viewer.tsx`, `evidence-snippet.tsx`, `approval-card.tsx`.
- **Priority:** P1
- **Dependencies:** FE-01.
- **Done:** Storybook-style demo page renders each component with sample states.

---

## 7. Writing Engine (WR)

### WR-01 — Prompt library

- **Description:** Per-artifact prompts under `packages/writing/prompts/` matching [agent-prompts.md §6](agent-prompts.md).
- **Priority:** P1
- **Dependencies:** INF-06.
- **Done:** prompts loaded and validated; cached prefix hits AI Gateway cache.

### WR-02 — Drafter + critic + rewriter

- **Description:** Implement the three-step loop with distinct models and prompts.
- **Priority:** P1
- **Dependencies:** WR-01.
- **Done:** loop produces a revised draft with documented critic notes.

### WR-03 — Fact-check (deterministic)

- **Description:** Claim extraction + mapping to story bank / profile; unmapped claims rejected.
- **Priority:** P0 (Phase 3 blocking)
- **Dependencies:** AG-STORY-BANK, DB-01.
- **Done:** unmapped-claim test: 100% rejection rate with no false passes on fixtures.

### WR-04 — Style-check

- **Description:** Voice-anchor cosine similarity; cliché scanner; originality heuristic.
- **Priority:** P1
- **Dependencies:** voice anchor embedded (DB-01).
- **Done:** thresholds tunable; regression on 5 sample drafts.

### WR-05 — Cliché list + phrases-to-avoid integration

- **Description:** Curated list; user-specific additions in preferences.
- **Priority:** P2
- **Dependencies:** WR-04.
- **Done:** list versioned; test draft flagged for each cliché.

---

## 8. Browser Automation (BA)

### BA-01 — Adapter interface + generic fallback

- **Description:** `PortalAdapter` interface without `submit()`; generic adapter; field-mapper with LLM-assisted + user-confirmed mapping.
- **Priority:** P0 (Phase 4 blocking)
- **Dependencies:** INF-08.
- **Done:** interface-level CI lint rule forbids any `submit` method beyond approval-resolver.

### BA-02 — Slate adapter

- **Description:** Slate-specific selectors, account creation, login, sections, fee detection, submission preview.
- **Priority:** P1
- **Dependencies:** BA-01.
- **Done:** golden Slate URL prepared to submit gate.

### BA-03 — CollegeNET adapter

- **Description:** As BA-02 for CollegeNET.
- **Priority:** P1
- **Dependencies:** BA-01.
- **Done:** golden CollegeNET URL prepared.

### BA-04 — Liaison GradCAS adapter

- **Description:** As BA-02 for Liaison GradCAS.
- **Priority:** P1
- **Dependencies:** BA-01.
- **Done:** golden Liaison URL prepared.

### BA-05 — ApplyWeb adapter

- **Description:** As BA-02 for ApplyWeb.
- **Priority:** P1
- **Dependencies:** BA-01.
- **Done:** golden ApplyWeb URL prepared.

### BA-06 — Fee-page detector (multi-signal)

- **Description:** Currency + confirm-UI detection; vendor-specific fingerprints; halt on ambiguity (R24).
- **Priority:** P0
- **Dependencies:** BA-01.
- **Done:** all golden checkout pages detected; ambiguous fixture halts.

### BA-07 — Drift detector

- **Description:** DOM hash diff vs last good run; create `confirm_field_mapping` approval on drift (R12).
- **Priority:** P1
- **Dependencies:** BA-01.
- **Done:** intentional DOM change triggers approval; resume works.

### BA-08 — Submission-preview + proxy-click release

- **Description:** Preview generator + approval-resolver path; the ONLY place a final submit is released.
- **Priority:** P0
- **Dependencies:** BA-01, AP-01, WF-08.
- **Done:** audit test: no other code path reaches final submit.

### BA-09 — Trace + snapshot capture

- **Description:** Playwright trace per run; DOM snapshot per section to Blob.
- **Priority:** P1
- **Dependencies:** INF-08, INF-09.
- **Done:** every run has a fetchable trace URL.

### BA-10 — Session persistence + 2FA ping

- **Description:** Persistent context per portal; periodic Blob snapshot; 5-min 2FA user ping and resume (R13).
- **Priority:** P1
- **Dependencies:** INF-08.
- **Done:** 2FA test: session resumes within 5-min window.

### BA-11 — Weekly golden-set portal regression

- **Description:** 5 synthetic applications run on schedule; alerts on failure.
- **Priority:** P1 (Phase 6)
- **Dependencies:** BA-02..05, INF-10.
- **Done:** weekly run + artifact report.

---

## 9. Observability (OBS)

### OBS-01 — Agent spans + LLM spans

- **Description:** Every agent invocation + AI Gateway call emits OTel span with `agent`, `model`, `tokens_in`, `tokens_out`, `outcome`.
- **Priority:** P1
- **Dependencies:** INF-06, INF-07.
- **Done:** traces visible in OTel backend for a full research sweep.

### OBS-02 — Action log writer

- **Description:** Typed helper that every mutation server action calls.
- **Priority:** P0
- **Dependencies:** DB-03.
- **Done:** every mutation test includes an `action_log` row.

### OBS-03 — Extraction attempt rows

- **Description:** `extraction_attempt` row per extractor call, success or failure.
- **Priority:** P1
- **Dependencies:** DB-03, EXT-02.
- **Done:** success + failure test coverage.

### OBS-04 — Evidence / action audit dashboards

- **Description:** Internal dashboards (Axiom) for per-agent reject rate, per-field F1, freshness violations, approvals-expired.
- **Priority:** P1 (Phase 6)
- **Dependencies:** OBS-01..03.
- **Done:** each metric populated on staging over 24h.

### OBS-05 — SLO dashboard

- **Description:** Track targets from [architecture.md §9](architecture.md).
- **Priority:** P1 (Phase 6)
- **Dependencies:** OBS-04.
- **Done:** all SLOs green on staging for 7 consecutive days.

### OBS-06 — Sentry noise tuning

- **Description:** Fingerprint noisy errors; route critical to pager channel.
- **Priority:** P2
- **Dependencies:** INF-07.
- **Done:** on-call signal-to-noise acceptable for Phase 6 exit.

---

## 10. Approvals & Safety (AP)

### AP-01 — Approval queue core

- **Description:** `packages/approvals/queue.ts` + `builders/*` per approval action type.
- **Priority:** P0
- **Dependencies:** DB-04.
- **Done:** can create / list / decide / expire.

### AP-02 — Approval waits in workflows

- **Description:** Inngest `waitForEvent('approval.decided')` helper; `resume.ts` in owning workflows.
- **Priority:** P0
- **Dependencies:** WF-01, AP-01.
- **Done:** integration test: workflow pauses and resumes on decision.

### AP-03 — Batch approvals

- **Description:** UI + backend for approve-N pattern with aggregated diff.
- **Priority:** P1
- **Dependencies:** AP-01, FE-07.
- **Done:** approve 10 free apps via one click; 10 `action_log` rows.

### AP-04 — Emergency stop

- **Description:** Backend + UI; cancels all workflows; logs out portals.
- **Priority:** P0
- **Dependencies:** INF-05, INF-08, AP-01.
- **Done:** stop + resume test passes; no silent portal-action resumption.

### AP-05 — Approval notifier

- **Description:** Email + in-app + (opt-in) SMS channels; quiet-hours compliance.
- **Priority:** P1
- **Dependencies:** Resend integration (CN-02), AP-01.
- **Done:** notifications fire in all configured channels; quiet-hours suppress non-critical.

### AP-06 — Idempotency ledger helpers

- **Description:** `reserve`, `complete`, `fail`; key formula shared across side-effects.
- **Priority:** P0
- **Dependencies:** DB-03.
- **Done:** re-running a side-effect short-circuits with prior result.

### AP-07 — Send-path exclusion (R22)

- **Description:** Physically exclude `mail.send` + LinkedIn send from v1 build via compile-time flag.
- **Priority:** P0
- **Dependencies:** INF-01.
- **Done:** build artifact inspection shows no `mail.send` reference; attempted runtime invocation throws hard error.

---

## 11. Contacts & Outreach Infra (CN)

### CN-01 — Approved provider integration (Proxycurl or PDL)

- **Description:** Provider client with rate-limit handling + ToS compliance; configurable.
- **Priority:** P2 (Phase 5)
- **Dependencies:** INF-06.
- **Done:** test enrichment succeeds; ToS documented in [risks.md](risks.md).

### CN-02 — Resend email integration (draft-send disabled)

- **Description:** Send adapter exists in interface but is compile-time disabled in v1 (R22).
- **Priority:** P2
- **Dependencies:** INF-02.
- **Done:** attempts to send throw hard error in v1 build.

### CN-03 — Google Scholar via SerpAPI

- **Description:** Scholar client used by ContactDiscovery + ProfileEnrichment.
- **Priority:** P2
- **Dependencies:** INF-06.
- **Done:** can fetch a researcher's profile with citation count.

### CN-04 — Person-merge bookkeeping

- **Description:** `person.merged_into` + merge script + UI reveal.
- **Priority:** P3
- **Dependencies:** DB-02.
- **Done:** merge test passes; audit trail preserved.

### CN-05 — Outreach policy filter

- **Description:** Season calendar + role rules + do-not-contact list.
- **Priority:** P2
- **Dependencies:** AG-OUTREACH.
- **Done:** policy rejects drafts during admissions-committee review seasons.

---

## 12. Testing (TEST)

### TEST-01 — Unit test infrastructure

- **Description:** Vitest config at root + per-package; coverage thresholds.
- **Priority:** P0
- **Dependencies:** INF-01.
- **Done:** CI runs unit tests on every PR.

### TEST-02 — Integration test harness

- **Description:** Ephemeral Neon branch per CI run; Inngest test mode; mTLS-disabled worker test mode.
- **Priority:** P1
- **Dependencies:** INF-04, INF-05, INF-08.
- **Done:** harness spins up + tears down cleanly.

### TEST-03 — Golden-set regression

- **Description:** `scripts/run-golden.ts` + CI integration; merge-blocking on F1 regressions.
- **Priority:** P0
- **Dependencies:** EXT-04.
- **Done:** intentional regression blocks merge.

### TEST-04 — Evidence-validator property tests

- **Description:** Generators attempt to insert without evidence into every interpreted table; all must fail.
- **Priority:** P0
- **Dependencies:** DB-06.
- **Done:** property tests green.

### TEST-05 — R-series regression suite

- **Description:** One test per top risk in [risks.md](risks.md) (R1–R25).
- **Priority:** P1
- **Dependencies:** relevant feature tasks.
- **Done:** all 25 regression tests in CI.

### TEST-06 — Portal smoke (staging, daily)

- **Description:** One synthetic application per portal per day; failures page on-call.
- **Priority:** P1 (Phase 6)
- **Dependencies:** BA-02..05, INF-10.
- **Done:** daily run reports health; alert on failure.

### TEST-07 — Load test Playwright worker

- **Description:** Max MVP concurrency; memory + CPU monitoring; session leak check.
- **Priority:** P1 (Phase 6)
- **Dependencies:** INF-08, BA-*.
- **Done:** worker stable under expected concurrency.

### TEST-08 — DR / backup restore

- **Description:** Neon branch restore test from prod-like data.
- **Priority:** P1 (Phase 6)
- **Dependencies:** DB-04.
- **Done:** restore completes within documented window; data verified.

### TEST-09 — Auto-submit regression

- **Description:** Test that asserts no code path reaches final submit without an approval resolution (R19).
- **Priority:** P0
- **Dependencies:** BA-01, BA-08, AP-02.
- **Done:** test green; any PR that adds a bypass fails CI.

### TEST-10 — Evidence-coverage audit

- **Description:** CI job that scans a staging DB snapshot and asserts 100% interpreted rows have resolvable evidence.
- **Priority:** P1
- **Dependencies:** DB-06, OBS-02.
- **Done:** audit returns zero violations on staging.

---

## 13. Cross-cutting MVP Gate Tasks

### GATE-PH0 — Phase 0 exit

- **Description:** Confirm all Phase 0 exit criteria in [roadmap.md](roadmap.md).
- **Priority:** P0
- **Dependencies:** INF-01..10, DB-01..06, WF-01, EXT-04, TEST-04.
- **Done:** exit checklist signed off in PR.

### GATE-PH1 — Phase 1 exit

- **Description:** Confirm all Phase 1 exit criteria.
- **Priority:** P0
- **Dependencies:** AG-UNIV-DISC, AG-PROG-QUAL, AG-REQ, AG-FEE, AG-FUNDING-DISCOVERY, AG-FUNDING-CLASSIFICATION, AG-DEADLINE, AG-PORTAL-MAPPER, EXT-02..04, TEST-03, FE-05.
- **Done:** 20-institution end-to-end run green with ≥0.85 F1 across specialized fields.

### GATE-PH2 — Phase 2 exit (Ranking & Dashboard)

- **Description:** Scoring SQL + status machine + onboarding + dashboard pins/blacklist.
- **Priority:** P1
- **Dependencies:** GATE-PH1, WF-02, FE-02..04, FE-10.
- **Done:** user-intuition agreement ≥80% on 20 rows.

### GATE-PH3 — Phase 3 exit (Writing)

- **Priority:** P1
- **Dependencies:** AG-WRITING, WR-01..05, FE-06, TEST-05 R10.
- **Done:** essays meet [mvp.md §7](mvp.md) thresholds.

### GATE-PH4 — Phase 4 exit (Portals)

- **Priority:** P1
- **Dependencies:** AG-APPLICATION-EXECUTION, BA-01..10, FE-08, AP-01..06, TEST-09.
- **Done:** 5 real applications to submit gate across 4+1 portals; 0 auto-submits.

### GATE-PH5 — Phase 5 exit (Contacts — drafts only)

- **Priority:** P2
- **Dependencies:** AG-CONTACT-DISCOVERY, AG-PROFILE-ENRICHMENT, AG-OUTREACH, FE-09, FE-11, CN-01..05.
- **Done:** 30 contacts + 10 draft outreach reviewed; send button absent.

### GATE-PH6 — Phase 6 exit (Reliability)

- **Priority:** P1
- **Dependencies:** OBS-04..05, TEST-06..08, WF-11, BA-11.
- **Done:** 1-week continuous operation no patching; SLOs green.

---

## 14. Missing Inputs

- Exact task owners per area — **Safe default:** project author assigns on Phase 0 kickoff.
- Golden-set annotator beyond the first 30 institutions — **Safe default:** author + one reviewer until Phase 6 quality bar is met.
- Final CI provider (GitHub Actions vs Vercel pipelines) — **Safe default:** GitHub Actions for code CI; Vercel handles deploys.

## Open Questions

- Should BA-02..05 adapters be developed in parallel by separate engineers or sequentially by one? **Safe default:** sequential to stabilize BA-01 interface first, then parallelize after Slate ships.
- Should TEST-09 (no-auto-submit) run as a build-time constraint (e.g., banned AST patterns) in addition to a runtime test? **Safe default:** yes; `eslint-plugin-no-submit` custom rule plus runtime assertion.

---

*Last updated: initial creation.*
