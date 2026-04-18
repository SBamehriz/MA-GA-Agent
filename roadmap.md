# roadmap.md - Phased Roadmap

> Phase-by-phase deliverables, dependencies, and exit criteria for the corrected local-first direction.
> Source: [BLUEPRINT.md](BLUEPRINT.md), [plan.md](plan.md), [mvp.md](mvp.md).

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## Phasing Philosophy

- **Local usefulness first.** The system should do real work for one user before hosted/product polish becomes a priority.
- **Memory before breadth.** Onboarding-memory comes before discovery breadth, writing breadth, and automation.
- **Preparation before portal-driving.** Application packets and checklists should be valuable before browser automation exists.
- **Architecture stays intact.** Deferred phases remain in the roadmap so the repo does not lose its long-term structure.

---

## Phase 0 - Onboarding Memory

**Goal:** create the trusted user-memory layer that every later phase depends on.

### Deliverables

- one local user record
- one draft-to-attested `user_profile_revision`
- source-document tracking
- onboarding-answer ingestion
- story drafting with source references
- story verification flow
- voice-anchor record
- `onboarding.complete` only after verification plus attestation

### Exit Criteria

- local onboarding runs without hosted blockers
- verified stories exist
- voice anchor exists
- revision attestation is explicit
- downstream writing can read only verified stories and ready voice anchor

---

## Phase 1 - Program / Funding / Contact Discovery

**Goal:** turn trusted onboarding memory into a ranked, evidence-backed opportunity set.

### Deliverables

- curated university seed list
- program qualification
- requirements / fee / funding / deadline extraction
- funding classification
- contact discovery and enrichment
- internal scoring/ranking support

### Exit Criteria

- meaningful shortlist for the real user
- evidence coverage on interpreted fields
- golden-set extraction quality at acceptable thresholds
- contacts usable for internal decision-making

---

## Phase 2 - Writing and Resume Tailoring

**Goal:** produce grounded, reusable admissions materials from verified user memory plus program evidence.

### Deliverables

- writing draft loop
- deterministic fact-check
- style/voice-anchor checks
- SOP/PS/short-answer generation
- resume/CV tailoring

### Exit Criteria

- drafts require only light user edits on average
- no unmapped factual claims survive
- resume variants are generated from the same verified profile/story layer

---

## Phase 3 - Application Preparation and Checklist Generation

**Goal:** make top programs operationally ready before any portal-driving begins.

### Deliverables

- packet assembly
- checklist generation
- readiness and blocker states
- missing-material detection
- reviewable per-program preparation output

### Exit Criteria

- top targets can be marked ready-for-review
- missing inputs are explicit
- user can see what is ready, blocked, or incomplete without needing portal automation

---

## Phase 4 - Approval-Based Automation Support

**Goal:** formalize risky-action control without yet automating browser execution.

### Deliverables

- approval records
- pause/resume helpers
- emergency stop
- auditable approval decisions

### Exit Criteria

- risky actions cannot proceed without explicit approval
- approval decisions are replayable and inspectable

---

## Phase 5 - Browser Automation

**Goal:** add portal-driving only after the earlier phases are already useful on their own.

### Deliverables

- portal adapter interface
- initial vendor adapters
- draft-save and checkpoint support
- fee-page detection
- proxy-submit support
- traces and automation audit artifacts

### Exit Criteria

- applications can be prepared to the submit gate safely
- approval rules still hold
- portal drift does not silently break execution

---

## Phase 6 - Reliability and Hosted Hardening

**Goal:** harden the operator only after the core local-first workflow has proven itself.

### Deliverables

- freshness scheduling
- regression CI
- runbooks
- observability hardening
- optional hosted deployment polish

### Exit Criteria

- stable repeated runs
- clear operational runbooks
- hosted rollout, if needed, no longer changes the product direction

---

## Current Rule

Do not pull work from a later phase into the current one unless a documented blocker proves it is necessary.
