# implementation-sequence.md — Phase 0 & Phase 1 Step-by-Step

> The exact sequential order Phase 0 and Phase 1 must be built. Each step lists its goal, dependencies, files touched, acceptance criteria, blockers, and the tests that must pass before the next step begins.
>
> Source of truth: [CLAUDE.md](CLAUDE.md) (rules), [plan.md](plan.md) §3 Task Groups A–B, [roadmap.md](roadmap.md) Phases 0–1, [architecture.md](architecture.md), [data-model.md](data-model.md), [agents.md](agents.md), [risks.md](risks.md).
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 0. How to Use This File

- Execute steps **in order**. Skipping forward is not allowed.
- Each step has a **Done Gate** — all tests in that gate must pass before the next step starts.
- If a step blocks, **do not invent a workaround**. Stop, flag, update [risks.md](risks.md) or [plan.md](plan.md), then resume.
- Every PR that advances a step must include the Propagation Checklist per [CLAUDE.md §7](CLAUDE.md).

---

## Phase 0 — Foundations (target ~2 weeks)

Exit criteria (from [roadmap.md](roadmap.md) Phase 0):
- A test that writes a `graduate_program` without evidence fails loudly in CI.
- Coordinator workflow runs to completion with no-op steps in all environments.
- Golden set queryable and CI-integrated.
- All external dependencies provisioned with documented access.

---

### Step 0.1 — Repo scaffolding

- **Goal:** Create the directory layout defined in [repo-structure.md](repo-structure.md); no code inside yet.
- **Dependencies:** none.
- **Touched files/modules:**
  - `/app/` (Next.js 16 App Router skeleton)
  - `/packages/*` (empty package.json per package)
  - `/worker-browser/` (empty Dockerfile placeholder)
  - `/scripts/`, `/fixtures/golden/`, `/fixtures/seeds/`, `/docs/`
  - Root: `pnpm-workspace.yaml`, `package.json`, `tsconfig.json`, `.gitignore`, `.editorconfig`.
- **Acceptance criteria:**
  - `pnpm install` completes cleanly from a fresh clone.
  - `pnpm typecheck` passes across all workspace packages (empty or not).
  - `.env*` files are gitignored; `.env.example` committed.
- **Blockers:** none.
- **Required tests before moving on:**
  - CI job `repo-boot` that runs `pnpm install && pnpm typecheck` on every PR.

---

### Step 0.2 — Typed env + config

- **Goal:** `vercel.ts` with typed env schema; local pull via `vercel env pull`.
- **Dependencies:** 0.1.
- **Touched files/modules:**
  - `vercel.ts` (root)
  - `packages/shared/env.ts` (Zod-parsed, typed env access for all packages)
  - `.env.example`
- **Acceptance criteria:**
  - Every env var is declared in Zod schema; missing or malformed env aborts boot with a readable error.
  - No plain `process.env.X` reads outside `packages/shared/env.ts`.
- **Blockers:** Vercel project created; user has CLI access.
- **Required tests:**
  - Unit test: `env.ts` rejects a missing required var.
  - CI: `pnpm build` fails if `.env.example` drifts from the Zod schema.

---

### Step 0.3 — Clerk auth wired

- **Goal:** Single-user authentication gate on every route.
- **Dependencies:** 0.2.
- **Touched files/modules:**
  - `app/layout.tsx` (Clerk provider)
  - `middleware.ts` (route protection)
  - `app/(auth)/sign-in/page.tsx`
  - `packages/shared/auth.ts`
- **Acceptance criteria:**
  - Unauthenticated users cannot reach `/(dashboard)` or `/(onboarding)`.
  - MFA required for the primary user (Clerk config).
  - `getCurrentUserId()` helper returns `user.id` or throws.
- **Blockers:** Clerk instance provisioned via Vercel Marketplace.
- **Required tests:**
  - Integration: anonymous request to `/dashboard` returns 302 → sign-in.
  - Integration: authenticated request passes through.

---

### Step 0.4 — Neon Postgres + Drizzle schema v1

- **Goal:** Initial schema covering `user`, `user_profile_revision`, `university`, `department`, `graduate_program`, `evidence`, `action_log`, `idempotency_ledger`, `approval_request`.
- **Dependencies:** 0.2.
- **Touched files/modules:**
  - `packages/db/schema.ts` (Drizzle tables per [data-model.md](data-model.md) and [schemas.md](schemas.md))
  - `packages/db/migrations/0001_init.sql` (generated)
  - `packages/db/client.ts` (connection, pooled)
  - `packages/db/queries/` (typed query helpers, initially minimal)
- **Acceptance criteria:**
  - Neon project created; dev, preview, prod branches documented.
  - Migration applies cleanly on an empty branch.
  - All tables listed above exist with the fields defined in [schemas.md](schemas.md).
- **Blockers:** Neon account + project provisioned.
- **Required tests:**
  - Migration test: `pnpm db:migrate` on a fresh DB leaves no diff vs schema.
  - Rollback test: `pnpm db:migrate:down` removes all created tables.

---

### Step 0.5 — Evidence write-time validator

- **Goal:** Any insert into an interpreted-fact table without a non-empty `evidence_id[]` fails. Every `evidence` row requires non-empty `quoted_text` and a resolvable `source_url`.
- **Dependencies:** 0.4.
- **Touched files/modules:**
  - `packages/evidence/validator.ts`
  - `packages/db/queries/with-evidence.ts` (wrapped insert helper)
  - DB-level: CHECK constraints and a trigger on interpreted tables (`graduate_program`, `fee_policy`, `application_deadline`, `requirement_set`, `funding_opportunity`, `essay_prompt`, `portal_binding`).
- **Acceptance criteria:**
  - Attempting a raw insert that bypasses the wrapper and lacks `evidence_id` fails at the DB level.
  - The wrapper is the only sanctioned write path in application code.
- **Blockers:** 0.4 merged.
- **Required tests (non-negotiable exit gate for Phase 0):**
  - Unit: `insertProgram({...}, evidence: [])` throws.
  - Integration: direct SQL insert bypassing wrapper but missing `evidence_id` is rejected by the CHECK.
  - Property test: every interpreted table rejects unsourced writes.

---

### Step 0.6 — Inngest skeleton + coordinator shell

- **Goal:** Workflow engine provisioned; `coordinator` workflow registered with no-op steps representing each research phase; event types typed in shared package.
- **Dependencies:** 0.2.
- **Touched files/modules:**
  - `packages/workflows/coordinator.ts` (no-op steps + events)
  - `packages/workflows/events.ts` (typed event names + payload schemas)
  - `app/api/inngest/route.ts` (webhook receiver)
- **Acceptance criteria:**
  - Coordinator can be triggered from a server action; each no-op step logs and resolves.
  - Replay of a completed run is deterministic (identical outputs).
- **Blockers:** Inngest project + signing key configured.
- **Required tests:**
  - Integration: emit `cycle.started` → coordinator runs to `cycle.complete` with all steps `ok`.

---

### Step 0.7 — AI Gateway routing

- **Goal:** Every model call goes through Vercel AI Gateway; per-task model routing configured (Opus drafts, Sonnet extract/critique, Haiku classify).
- **Dependencies:** 0.2.
- **Touched files/modules:**
  - `packages/shared/ai.ts` (typed gateway client, per-task router)
  - `packages/shared/ai-budgets.ts` (per-run token caps)
- **Acceptance criteria:**
  - No direct Anthropic SDK import anywhere in `packages/*` or `app/*` except `packages/shared/ai.ts`.
  - CI lint rule forbids direct provider SDK imports outside the shared module.
- **Blockers:** Vercel AI Gateway token provisioned.
- **Required tests:**
  - Lint rule test: an offending import triggers CI failure.
  - Smoke: a tiny prompt routes through the gateway and returns with a recorded span.

---

### Step 0.8 — Observability stack

- **Goal:** Sentry, Axiom, OpenTelemetry wired across Next.js and the future worker.
- **Dependencies:** 0.2.
- **Touched files/modules:**
  - `packages/shared/telemetry.ts` (OTel tracer, Axiom exporter, Sentry init)
  - `instrumentation.ts` (Next.js OTel entrypoint)
  - `worker-browser/telemetry.ts` (placeholder)
- **Acceptance criteria:**
  - A dummy span from the coordinator appears in Axiom and OTel backend within 60s.
  - An intentionally thrown error appears in Sentry with breadcrumbs.
- **Blockers:** Sentry DSN + Axiom API key configured.
- **Required tests:**
  - Smoke: run `scripts/smoke-telemetry.ts`; verify all three backends received events.

---

### Step 0.9 — Playwright worker VM provisioned (shell only)

- **Goal:** A reachable worker endpoint that answers `GET /health` and accepts mTLS. No portal code yet.
- **Dependencies:** 0.2, 0.8.
- **Touched files/modules:**
  - `worker-browser/Dockerfile`
  - `worker-browser/server.ts` (Fastify + mTLS)
  - `worker-browser/health.ts`
  - `packages/shared/worker-client.ts` (typed caller)
- **Acceptance criteria:**
  - Fly.io (or Hetzner) VM deployed; endpoint reachable only via mTLS.
  - `workerClient.health()` from a server action returns `{ ok: true }`.
- **Blockers:** Fly.io / Hetzner account; certificate material generated.
- **Required tests:**
  - Integration: mTLS handshake succeeds from Vercel preview; plain HTTPS request is rejected.

---

### Step 0.10 — Golden set v1 (30 institutions)

- **Goal:** Hand-annotated admissions pages: program title, deadlines, fees, funding policy, top-3 faculty. Format matches the extractor schemas to be built in Phase 1.
- **Dependencies:** 0.4 (schema to map annotations against).
- **Touched files/modules:**
  - `fixtures/golden/institutions/*.json` (30 files)
  - `fixtures/golden/schema.ts` (Zod for annotation format)
  - `fixtures/seeds/universities.csv`
- **Acceptance criteria:**
  - 30 institutions spanning ≥4 portal vendors (Slate, CollegeNET, Liaison GradCAS, ApplyWeb).
  - Each annotation includes `source_url`, `quoted_text`, and value.
  - Loader script `scripts/load-golden.ts` materializes them as in-memory fixtures for tests.
- **Blockers:** Annotator time; user to supply initial seed list if no CSRankings import yet.
- **Open questions:**
  - *Who annotates?* Safe default for MVP: project author + one reviewer; both sign off per file.
- **Required tests:**
  - Loader: all 30 files parse with the golden Zod schema.
  - CI: annotation-schema validation runs on every PR.

---

### Phase 0 Exit Gate

All of the following must pass before Phase 1 begins:

1. Step 0.5 tests green in CI (evidence validator).
2. Step 0.6 coordinator runs to completion with no-op steps.
3. Step 0.10 golden set loaded and validated in CI.
4. Every external dependency documented in [architecture.md](architecture.md) §3 with access owner and rotation note.

---

## Phase 1 — Data Collection Engine (target ~4 weeks)

Exit criteria (from [roadmap.md](roadmap.md) Phase 1):
- 20 institutions processed end-to-end.
- Per-field F1 ≥ 0.85 on deadline, fee, tuition_coverage, stipend, LoR count.
- 100% evidence coverage on interpreted fields.
- Zero write-time validator failures in the happy path.
- Re-run on same inputs is deterministic (content-hash cache hits).

---

### Step 1.1 — Seed `university` table

- **Goal:** Load CSRankings AI top-50 + 20 mid-tier publics + user-supplied entries into `university`.
- **Dependencies:** 0.4, 0.5.
- **Touched files/modules:**
  - `fixtures/seeds/universities.csv`
  - `scripts/seed-universities.ts`
  - `packages/db/queries/university.ts`
- **Acceptance criteria:**
  - 75–150 universities loaded per [mvp.md §6](mvp.md).
  - Each row has `canonical_name`, `country`, `state`, `primary_domain`, `tier_tag`.
  - Evidence for each: the seed CSV row itself (`source_type=user_attested`) until upgraded by Discovery.
- **Blockers:** User confirms seed list; no university gets automatic evidence beyond seed attestation until a real crawl runs.
- **Required tests:**
  - Integration: seed script is idempotent (re-running does not duplicate rows).

---

### Step 1.2 — Crawl infrastructure

- **Goal:** Firecrawl + Tavily search adapters; per-domain rate limiter; content-hash cache.
- **Dependencies:** 0.2, 0.7.
- **Touched files/modules:**
  - `packages/crawlers/firecrawl.ts`
  - `packages/crawlers/tavily.ts`
  - `packages/crawlers/cache.ts` (content-hash → Vercel Blob)
  - `packages/crawlers/budgets.ts` (per-university budget enforcement)
- **Acceptance criteria:**
  - A crawl call returns markdown + `content_hash`; identical input returns cached result.
  - Per-domain rate limit + per-run budget (20 pages, 5 PDFs, 2 min wall-clock per university per [architecture.md §4.5](architecture.md)).
- **Blockers:** Firecrawl + Tavily keys provisioned.
- **Required tests:**
  - Unit: cache hit on identical content returns without network call.
  - Unit: budget exceeded raises a typed error that the Coordinator can handle.

---

### Step 1.3 — PDF ingestion

- **Goal:** PDF → markdown pipeline with fallback OCR for image-only docs.
- **Dependencies:** 1.2.
- **Touched files/modules:**
  - `packages/crawlers/pdf.ts` (pdfplumber equivalent)
  - `packages/crawlers/ocr.ts` (fallback path; flagged as low-confidence)
- **Acceptance criteria:**
  - Text-based PDF → markdown with page boundaries preserved.
  - Image-only PDF triggers OCR with a lower `source_quality_score`.
- **Required tests:**
  - 3 representative admissions PDFs parse with expected section headers preserved.

---

### Step 1.4 — UniversityDiscoveryAgent

- **Goal:** Add universities outside the seed with strong AI signal.
- **Dependencies:** 1.1, 1.2.
- **Touched files/modules:**
  - `packages/agents/university-discovery/contract.ts`
  - `packages/agents/university-discovery/index.ts`
  - Event subscription in `packages/workflows/coordinator.ts`
- **Acceptance criteria:**
  - Deterministic-first: checks seed; only escalates to Tavily search when no match.
  - Emits `university.qualified` with `evidence_id[]`.
  - Confidence ≥0.95 required for persistence.
- **Contract:** see [agents.md §4.1](agents.md) and [agent-prompts.md](agent-prompts.md).
- **Required tests:**
  - Golden-set: 5 known universities rediscovered correctly.
  - Escalation: unseen strong-signal institution flagged to user, not persisted.

---

### Step 1.5 — ProgramQualificationAgent

- **Goal:** For each qualified university, produce AI-relevant `graduate_program[]` with `relevance_class`.
- **Dependencies:** 1.4.
- **Touched files/modules:**
  - `packages/agents/program-qualification/`
  - `packages/classifiers/relevance.ts` (keyword + faculty-alignment)
- **Acceptance criteria:**
  - Emits `program.qualified` with class in {`core`, `adjacent`, `tangential`, `rejected`}.
  - Evidence attached to the class decision (quoted curriculum text or faculty research area).
- **Required tests:**
  - Golden-set: classes match annotator labels ≥0.85 agreement on 20 institutions.

---

### Step 1.6 — Specialized extractors (deadline, fee, tuition_coverage, stipend, required_documents)

- **Goal:** Zod + regex-validated extractors for the 5 highest-stakes fields per [CLAUDE.md §10](CLAUDE.md).
- **Dependencies:** 1.2, 1.3, 0.5.
- **Touched files/modules:**
  - `packages/extractors/deadline.ts`
  - `packages/extractors/fee.ts`
  - `packages/extractors/tuition.ts`
  - `packages/extractors/stipend.ts`
  - `packages/extractors/required-documents.ts`
  - Each with its own Zod schema + post-validator + golden fixture set.
- **Acceptance criteria:**
  - Every extractor enforces `quoted_source` in its output schema.
  - Date / currency outputs re-validated by regex after LLM.
  - Two-source rule applied in `deadline.ts` for deadlines within 30 days.
- **Required tests:**
  - Per-field F1 ≥0.85 on 20-institution golden subset.
  - Deterministic re-run: identical `content_hash` → identical output.

---

### Step 1.7 — RequirementsExtractionAgent

- **Goal:** Produce `requirement_set` rows with all fields in [data-model.md §5.8](data-model.md).
- **Dependencies:** 1.5, 1.6.
- **Touched files/modules:**
  - `packages/agents/requirements/`
- **Acceptance criteria:**
  - Every field has evidence; "recommended" vs "required" disambiguated explicitly.
  - Essay prompts captured into `essay_prompt` with `tag`.
- **Required tests:**
  - Golden-set: `lor_count`, `gre_policy`, `sop_required` per-field F1 ≥0.85.

---

### Step 1.8 — FeeAndWaiverAgent

- **Goal:** `fee_policy` rows with waiver workflow.
- **Dependencies:** 1.5, 1.6.
- **Touched files/modules:**
  - `packages/agents/fee-waiver/`
- **Acceptance criteria:**
  - Fee amount regex-validated; currency explicit.
  - Waiver URL captured when present; rules stored as structured `jsonb`.
- **Required tests:**
  - Golden-set fee F1 ≥0.85.

---

### Step 1.9 — FundingDiscoveryAgent + FundingClassificationAgent

- **Goal:** Enumerate opportunities per program/department/lab and classify into `funding_class`.
- **Dependencies:** 1.5.
- **Touched files/modules:**
  - `packages/agents/funding-discovery/`
  - `packages/agents/funding-classification/`
  - `packages/classifiers/funding-taxonomy.ts` (phrase matcher — deny list for "may", "typical", "often" per [risks.md R5](risks.md))
- **Acceptance criteria:**
  - Taxonomy-first classification; LLM fallback only at lower confidence.
  - `full_tuition_plus_stipend` / `full_tuition_only` require explicit phrase match.
  - Unclear defaults to `unclear`, never a guessed full class.
- **Required tests:**
  - Golden-set classification agreement ≥0.90 vs manual annotation on n=30 opportunities per [mvp.md §7](mvp.md).
  - R5 regression: 10 known soft-language pages → never classified as full.

---

### Step 1.10 — DeadlineAgent

- **Goal:** `application_deadline` rows per type.
- **Dependencies:** 1.5, 1.6.
- **Touched files/modules:**
  - `packages/agents/deadline/`
- **Acceptance criteria:**
  - Two-source rule enforced for deadlines within 30 days.
  - Priority vs final vs funding-consideration disambiguated.
  - Timezone explicit (default to institution local with flag).
- **Required tests:**
  - Golden-set: deadline type + date F1 ≥0.85.
  - Conflict path: two conflicting deadlines produce `field_candidate` rows, not a silent pick.

---

### Step 1.11 — PortalMapperAgent (fingerprint only)

- **Goal:** Detect portal vendor; persist `portal_binding`. No driving yet.
- **Dependencies:** 1.5.
- **Touched files/modules:**
  - `packages/agents/portal-mapper/`
  - `packages/portal-adapters/fingerprints.ts`
- **Acceptance criteria:**
  - Slate, CollegeNET, Liaison GradCAS, ApplyWeb detected at ≥0.9 confidence on golden set.
  - Unknown vendor → `generic` with low confidence (flagged).
- **Required tests:**
  - Fingerprint smoke on 10 known portal URLs.

---

### Step 1.12 — Evidence inspector UI (read-only)

- **Goal:** Dashboard surface listing interpreted facts with their evidence snippets and `last_verified_at`.
- **Dependencies:** 0.4, 0.5, 1.7–1.10.
- **Touched files/modules:**
  - `app/(dashboard)/evidence/page.tsx`
  - `app/(dashboard)/evidence/[subject]/page.tsx`
  - `packages/db/queries/evidence.ts`
- **Acceptance criteria:**
  - User can navigate from a program row to every fact + its evidence.
  - Stale rows (past SLA per [data-model.md §3](data-model.md)) marked visually.
- **Required tests:**
  - Integration: authenticated user sees their evidence; unauthenticated gets 401.

---

### Step 1.13 — Golden-set regression harness

- **Goal:** CI job that runs all extractors against fixtures and produces per-field F1.
- **Dependencies:** 1.6–1.11.
- **Touched files/modules:**
  - `scripts/run-golden.ts`
  - `.github/workflows/golden.yml`
- **Acceptance criteria:**
  - Report written to `artifacts/golden-<sha>.json` with per-field F1.
  - CI fails merge if any of the 5 specialized fields regresses below 0.85.
- **Required tests:**
  - Regression gate: a deliberate prompt degradation on a feature branch fails CI.

---

### Phase 1 Exit Gate

1. Step 1.13 green: all 5 specialized field F1 ≥0.85.
2. 20 institutions processed end-to-end with 100% evidence coverage.
3. Deterministic re-run: `content_hash` cache hit rate ≥95% on a second pass.
4. Evidence inspector shows the full pipeline output for at least 20 programs.

---

## Missing Inputs

- Annotator capacity for golden set beyond the first 30 (needed for Phase 1 regression confidence).
- Final CSRankings seed list freeze date.
- Proxycurl/PDL provider contract signed before Phase 5 begins (not blocking Phases 0–1).
- VM region choice for Playwright worker (affects latency to CSRankings institutions' portals).

## Open Questions

- **Cache TTL for crawl results** — Safe default for MVP: 14 days for `admissions_page`, 30 days for `lab_page`, 7 days for fee pages.
- **Concurrency cap per university research run** — Safe default for MVP: 3 pages in flight per domain; 5 universities in parallel across the coordinator.
- **Evidence retention for rejected programs** — Safe default for MVP: retain for the current cycle, prune at cycle close unless user pins.

## Safe Defaults for MVP

- Run only against the seed list in Phase 1; defer discovery expansion to post-MVP.
- Haiku for bulk classification; Sonnet for extraction; Opus not used in Phase 1 (reserved for writing in Phase 3).
- Weekly (not daily) golden-set regression until Phase 6.

---

*Last updated: initial creation.*
