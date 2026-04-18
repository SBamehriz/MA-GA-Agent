# mvp.md - MVP Scope

> What the current MVP must prove, what it excludes, and how success is measured.
> Source: [BLUEPRINT.md](BLUEPRINT.md), [plan.md](plan.md), [roadmap.md](roadmap.md).

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. MVP Goal

Prove that a single user can use MA-GA-Agent locally to:

- build one trusted onboarding-memory layer
- discover relevant programs, funding, and contacts
- generate grounded writing and resume variants
- prepare application-ready packets and checklists
- keep all risky actions behind explicit approval gates

The MVP is successful **before** browser automation exists if the operator already does meaningful admissions and funding work for one user.

---

## 2. In Scope

### 2.1 Onboarding Memory

- one local `user_profile_revision`
- onboarding answer ingestion
- source-document tracking for resume, transcript, writing sample, and related materials
- story generation with source references
- `verified_by_user` story flow
- voice-anchor record
- explicit attestation gate before downstream use

### 2.2 Program / Funding / Contact Discovery

- curated institution seed list
- program qualification
- requirements, fee, deadline, and funding discovery
- funding classification
- contact discovery
- LinkedIn-equivalent/profile enrichment through approved methods
- evidence-backed storage for discovered facts

### 2.3 Writing and Resume Tailoring

- SOP, PS, short answers, cover letters, and outreach drafts
- resume/CV tailoring from the same verified memory layer
- draft/critique/rewrite flow
- fact-check against verified stories and profile fields
- voice-anchor-aware style checks

### 2.4 Application Preparation

- application packet assembly
- program-specific checklist generation
- readiness / blocker states
- missing-material detection
- reviewable preparation output before any portal-driving

### 2.5 Approval-Based Automation Support

- explicit approval objects for risky actions
- pause/resume boundaries
- emergency stop
- auditable decisions

### 2.6 Safety and Audit

- evidence validator
- append-only audit/evidence records where relevant
- no unsourced factual claims in writing
- no external side-effects without approval

---

## 3. Explicitly Deferred

- browser automation and portal adapters
- account creation flows
- fee-page handling
- proxy-submit UX
- notification channels
- hosted deployment hardening
- public-product auth or multi-user concerns

These are preserved in the architecture, but they are not the current MVP proof.

---

## 4. Out of Scope

- auto-submit
- auto-pay
- auto-send external communication
- PhD workflows
- multi-tenant support
- direct LinkedIn scraping
- raw credential storage
- payment processing

---

## 5. What Stays Manual

- initial source document collection
- story verification
- final profile attestation
- review of generated writing
- approval of risky external actions
- final submission and payment when later automation exists

---

## 6. What Is Automated

- onboarding ingestion and draft normalization
- story drafting from source-backed memory
- program / funding / contact research
- evidence-backed extraction and classification
- writing draft loops grounded in verified memory
- packet/checklist preparation

---

## 7. Success Metrics

| Metric | Target |
|---|---|
| One local onboarding revision can be completed end-to-end | yes |
| Verified stories available for downstream writing | >= 1 required, larger set preferred |
| Voice-anchor record available for downstream writing | yes |
| Time to first evidence-backed scored program list after onboarding | <= 6 hours |
| Extraction field F1 vs golden set | >= 0.85 |
| Funding classification agreement with manual audit | >= 90% |
| Drafts needing only light edits | >= 80% |
| Application-ready packets/checklists produced for top targets | yes |
| External actions taken without user approval | 0 |

---

## 8. Quality Gates

1. `onboarding.complete` only after verification and attestation.
2. Verified stories only for downstream writing.
3. Fact-check rejects unmapped verifiable claims.
4. Evidence validator blocks unsourced writes where evidence is required.
5. Approval gates remain mandatory for risky external actions.
6. No raw credentials stored anywhere.
7. No browser automation requirement for MVP usefulness.

---

## 9. Day-One Demo Flow

1. Ingest resume, transcript, and onboarding answers into one local revision.
2. Review and verify generated stories.
3. Record a voice anchor and attest the revision.
4. Run research to produce a ranked, evidence-backed shortlist with funding/contact information.
5. Generate grounded essays and resume variants for top targets.
6. Produce application-ready packets and checklists for review.
7. Hold any risky downstream action behind approval.

This demo does not require sign-in flows, dashboard breadth, or portal-driving.

---

## 10. What Would Kill Trust

- a draft using invented facts
- a story treated as verified without user confirmation
- missing provenance between onboarding materials and downstream writing
- a funding classification presented too confidently when it is unclear
- a workflow that silently bypasses approval on a risky action
