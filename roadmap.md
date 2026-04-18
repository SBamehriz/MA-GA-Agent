# roadmap.md — Phased Roadmap

> Phase-by-phase deliverables, dependencies, exit criteria.
> Source: [BLUEPRINT.md §15](BLUEPRINT.md). Implementation ordering: [plan.md](plan.md). Scope: [mvp.md](mvp.md).

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## Phasing Philosophy

- **Spine first, features second.** Evidence ledger, entity model, workflow engine before any agent.
- **Vertical slices.** Each phase ends with something demonstrable end-to-end on a small N.
- **Golden-set regression continuously.** Extraction quality is tracked from Phase 1 onward.
- **No external side-effects until Phase 7.** MVP = Phases 0–6.
- **Exit criteria are hard gates.** No phase is "done" until criteria are green.

---

## Phase 0 — Validation & Foundations

**Duration target:** ~2 weeks.

### Objectives
- Lock architecture + data model.
- Establish golden set.
- Stand up empty-but-wired infrastructure.

### Deliverables
- Architecture signed off ([architecture.md](architecture.md)).
- Data model signed off ([data-model.md](data-model.md)).
- Agent catalog signed off ([agents.md](agents.md)).
- Repo scaffolded per [plan.md](plan.md) §2.
- Neon Postgres project, Inngest project, Vercel AI Gateway, Playwright worker VM, Clerk auth, Sentry, Axiom, OTel all provisioned and connected.
- Golden set: 30 hand-annotated admissions pages across ≥4 portal vendors.
- Seed institution list finalized.

### Dependencies
- User availability for preference interviews and story-interview prototype.
- Approved data provider access (Proxycurl / PDL) contract in place.

### Major technical tasks
- Repo scaffolding.
- Env config via `vercel.ts`.
- Drizzle schema first pass (matches [data-model.md](data-model.md)).
- Evidence-ledger write-time validator.
- Inngest skeleton + coordinator shell.
- Golden-set fixture format + first 10 annotated pages.

### Major product tasks
- Lock MVP scope (done — see [mvp.md](mvp.md)).
- Finalize onboarding script.
- Agree on approval taxonomy (done — see [agents.md](agents.md) §4.17).

### Risks
- Over-scoping (mitigate: enforce [mvp.md](mvp.md) §3).
- Under-scoping golden set (mitigate: 30 is the floor, not ceiling).
- Stack churn (mitigate: architecture doc is the contract).

### Exit criteria
- A test that writes a program record without evidence fails loudly in CI.
- Coordinator workflow runs to completion with no-op steps in all environments.
- Golden set is queryable and CI-integrated.
- All dependencies provisioned with documented access patterns.

---

## Phase 1 — Data Collection Engine

**Duration target:** ~4 weeks.

### Objectives
- End-to-end research → extraction → classification → evidence on 20 institutions.

### Deliverables
- Working agents: UniversityDiscovery, ProgramQualification, RequirementsExtraction, FeeAndWaiver, FundingDiscovery, FundingClassification, Deadline, PortalMapper.
- PDF ingestion pipeline.
- Evidence inspector UI (read-only).
- Golden-set regression in CI with per-field F1.

### Dependencies
- Phase 0 complete.
- Golden set ≥ 20 institutions fully annotated.

### Major technical tasks
- Specialized extractors for the 5 high-stakes fields (deadline, fee, tuition_coverage, stipend, required_documents) with Zod + regex post-validators.
- Funding taxonomy table + phrase matcher.
- Deterministic-first / LLM-fallback pattern codified.
- Per-university research budget enforcement.
- Cached crawl store with content-hash keys.

### Major product tasks
- Evidence inspector wireframe → implementation.
- Confidence-badge vocabulary user-tested (Low/Medium/High + tooltip).

### Risks
- LLM extraction cost overrun (mitigate: specialized prompts + content-hash caching + Haiku for bulk extract).
- Over-reliance on LLM for fields with deterministic solutions (mitigate: code review enforces rules-first).
- Fragile selectors for portal detection (mitigate: multiple fingerprint signals).

### Exit criteria
- 20 institutions processed end-to-end.
- Per-field F1 ≥ 0.85 on deadline, fee, tuition_coverage, stipend, LoR count.
- 100% evidence coverage on interpreted fields.
- Zero write-time validator failures in the happy path.
- Re-running the pipeline on the same inputs is deterministic (content-hash cache hits).

---

## Phase 2 — Ranking & Prioritization

**Duration target:** ~2 weeks.

### Objectives
- User sees a scored, evidence-backed list and can steer it.

### Deliverables
- Scoring SQL + materialized views per [BLUEPRINT.md §8].
- Status machine implemented.
- Onboarding flow (three sessions).
- Profile attestation gate.
- Dashboard v1: ranked list, filters, pins, blacklist.

### Dependencies
- Phase 1 complete (scored list needs data).

### Major technical tasks
- Scoring function + weight configurability.
- Status transitions wired to downstream workflows (not yet acting, but visible).
- Onboarding Server Actions + form UI.
- Transcript + resume parser.

### Major product tasks
- Onboarding interview script finalized.
- Why-this-rank explanation panel.

### Risks
- User distrust of scores (mitigate: transparent "why" panel, weight overrides).
- Scores dominated by one component (mitigate: weight audit on real data).

### Exit criteria
- User confirms ranked list matches intuition on ≥80% of 20 reviewed rows.
- Onboarding completes in ≤3 sessions of ≤40 min each for a real user.
- Evidence inspector reachable from every scored row.

---

## Phase 3 — Document Generation

**Duration target:** ~4 weeks.

### Objectives
- User can review generated SOPs, PSs, short answers, and cover letters grounded in their story bank.

### Deliverables
- Story-bank builder (conversational + resume cross-reference).
- Voice-anchor capture + embedding.
- WritingAgent with draft/critique/rewrite loop.
- Fact-check deterministic mapper.
- Style-check (voice similarity, cliché scan, originality score).
- Essay review UI with inline critic notes and diff.

### Dependencies
- Phase 2 complete (ranked list drives which essays to generate first).

### Major technical tasks
- Prompt library per artifact type.
- Critic prompt distinct from drafter.
- Fact-check claim extraction → story/profile mapping.
- Cliché list + embedding similarity thresholds.
- User edit tracking to improve future prompts (no training loop yet — just logging).

### Major product tasks
- "Reject unmapped claim" UX that feels explanatory, not punitive.
- User-facing fact-check failure rendering.

### Risks
- Generic writing (mitigate: voice anchor + cliché list + per-program personalization budget).
- Hallucinated facts (mitigate: fact-check is blocking).
- Tone drift across drafts (mitigate: style-check + critic model).

### Exit criteria
- 3 SOPs + 5 short answers reviewed by user with ≤30% line-level edits.
- 0 drafts with unmapped verifiable claims reach the user.
- Style similarity to voice anchor ≥ 0.7 on approved drafts.

---

## Phase 4 — Portal Automation & Execution

**Duration target:** ~5 weeks.

### Objectives
- Drive 4 portal vendors + generic fallback through to the submit gate.

### Deliverables
- Portal adapters: Slate, CollegeNET, Liaison GradCAS, ApplyWeb, generic.
- Draft-saving per section.
- Fee-page detection → approval gate.
- Submission-gate proxy-click UX.
- Playwright trace capture + DOM snapshots.
- Drift detection with one-time user-confirmed field mapping.
- Golden-set weekly regression of 5 canonical applications.

### Dependencies
- Phase 3 complete (drafts must exist to attach).

### Major technical tasks
- Playwright worker hardening (session persistence, re-auth flow, 2FA user ping).
- Portal adapter DSL to reduce per-adapter code.
- Upload-spec validation (file types, sizes).
- Validation-error parser per portal.
- mTLS between Vercel and the worker.

### Major product tasks
- Submission-preview UI with evidence + diff.
- Batch-approval UX ("approve next 5 free apps").
- Drift-confirmation UX.

### Risks
- Anti-bot blocks (mitigate: low concurrency, sticky residential IPs via Browserbase, obey ToS).
- Adapter brittleness (mitigate: golden-set regression + drift detection).
- 2FA timeouts (mitigate: 5-minute user-ping window + queue resume).

### Exit criteria
- 5 real applications prepared to submit gate across all 4 named portals + 1 generic.
- 0 auto-submissions.
- Playwright traces available for every run.
- Weekly regression passes on the 5 canonical applications.

---

## Phase 5 — Contact Intelligence (Drafts Only)

**Duration target:** ~3 weeks.

### Objectives
- Resolve real humans for programs/opportunities. Draft (but do not send) outreach.

### Deliverables
- ContactDiscoveryAgent + role taxonomy.
- ProfileEnrichmentAgent with approved provider.
- Multi-signal match scoring.
- Contact explorer UI.
- OutreachStrategyAgent (drafts only).
- Outreach approval queue (send button disabled in v1).

### Dependencies
- Phase 4 complete (contact intelligence feeds scoring + essay personalization).

### Major technical tasks
- Provider integration + rate-limit handling.
- Google Scholar via SerpAPI.
- Person-merge bookkeeping (handle moves / name changes).
- Outreach policy filter (season, role, do-not-contact list).

### Major product tasks
- Contact explorer that surfaces confidence, evidence, role, last-verified.
- Outreach draft UI with rationale + cited evidence (paper/project).

### Risks
- Name-collision false bindings (mitigate: multi-signal threshold ≥0.85 for outreach; 0.65 internal).
- ToS risk from direct scraping (mitigate: provider-only; never direct LinkedIn scrape).
- Outreach drafts leak into send path (mitigate: send button physically absent in v1 build).

### Exit criteria
- 30 contacts resolved with ≥0.85 confidence on a test set.
- 10 outreach drafts reviewed by user with ≥80% rated usable.
- 0 outreach actually sent.

---

## Phase 6 — Reliability & Scaling

**Duration target:** ~3 weeks.

### Objectives
- System runs unattended for a week without human patching.

### Deliverables
- Freshness SLAs enforced at query time (stale = blocked).
- Weekly refresh workflows.
- Golden-set regression enforced in CI for every merge.
- Runbooks for each top-10 risk in [risks.md](risks.md).
- Load tests of the Playwright worker at MVP concurrency.
- SLO dashboards (dashboard read p95, workflow success, portal run success, extraction F1).
- Backup + disaster recovery tested.

### Dependencies
- Phases 1–5 complete.

### Major technical tasks
- Circuit breakers on external providers.
- Per-user and per-domain rate limit enforcement.
- Backup schedule validated via restore test.
- Observability alert routing (Sentry → on-call channel).

### Major product tasks
- Stale-record UX ("this is out of date — refreshing now").
- Degraded-mode UX (provider outage notice).

### Risks
- SLA violations that silently pass (mitigate: block at query layer, not just warn).
- Alert fatigue (mitigate: prioritize alerts; runbook-linked).

### Exit criteria
- 1-week continuous operation with no human patching.
- SLOs green for 7 consecutive days.
- Restore test passes on prod-like data.
- Every top-10 risk has a live runbook.

---

## Phase 7 — Advanced Autonomy (Post-MVP)

**Duration target:** ongoing after MVP ships.

### Objectives
- Enable outreach sending with per-channel caps after trust metrics are met.
- Expand portal coverage.
- Add per-action autonomy controls.

### Deliverables
- Outreach send with per-channel rate limits.
- Reply tracking (user-consented inbox integration).
- Outreach-outcome feedback into scoring.
- Additional portal adapters (next 3–5 vendors by user demand).
- Multi-cycle memory (this year's data informs next cycle's scoring).

### Dependencies
- Phase 6 green for ≥ 4 weeks.
- Trust metrics (see below) met.

### Trust metrics to enable Phase 7 features

| Feature | Gate |
|---|---|
| Outreach send (email) | 30 drafts reviewed + ≥80% user-approved ratings + 0 wrong-person incidents |
| Outreach send (LinkedIn) | Email-send gate + 30 LinkedIn drafts reviewed + ToS review current |
| Additional adapter | Golden-set regression pass on prototype for 4 consecutive weeks |
| Multi-cycle memory | Full v1 cycle completed with user satisfaction ≥ 4/5 |

### Major technical tasks
- Send-path with idempotency + unsubscribe compliance.
- Reply parser and attachment to opportunity.
- Adapter DSL refinements based on Phase 4 experience.

### Major product tasks
- Outreach calendar UI (cadence controls).
- Per-action autonomy sliders.

### Risks
- Over-confident autonomy expansion (mitigate: per-feature gate; no blanket opt-in).
- Reply parsing misroute (mitigate: require user confirmation before auto-tagging reply).

### Exit criteria
- First outreach sent with user approval.
- Reply parsed and attached.
- Zero external actions without approval.
- Per-action autonomy settings observed end-to-end.

---

## Critical Path

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5 ──▶ Phase 6 ──▶ Phase 7
 Spine      Research     Scoring     Writing     Portals     Contacts    Reliability  Autonomy
 2w         4w           2w          4w          5w          3w          3w           ongoing
```

No phase can start before its predecessor's exit criteria are met.

---

## What Would Cause a Phase Reset

- A Phase 1 extraction F1 < 0.75 → pause, investigate prompts/validators; do not advance.
- A Phase 3 draft hallucination reaches a user → hard stop; rebuild fact-check.
- A Phase 4 auto-submit bug (even in dev) → hard stop; full audit.
- A Phase 5 wrong-person binding above threshold → hard stop; raise binding threshold + re-audit.
- A Phase 6 SLO fail lasting > 24h → back to Phase 6 hardening.

These are not soft warnings. They are reset triggers.

---

*Last updated: initial creation.*
