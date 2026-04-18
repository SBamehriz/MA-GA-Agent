# mvp.md — MVP Scope

> What v1 ships, what it doesn't, how success is measured, and how the first demo flows.
> Source: [BLUEPRINT.md §14, §18](BLUEPRINT.md). Plan: [plan.md](plan.md). Phases: [roadmap.md](roadmap.md).

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. MVP Goal

Prove that a single user can, with ≤20 hours of their own effort and zero external side-effects without their explicit approval, reach the submit gate for 10+ AI Master's applications across at least 4 distinct admissions portals, with funding status classified and evidence-backed for each.

This is the north-star MVP metric. Anything that isn't on the path to it is out of scope.

---

## 2. In Scope (v1 ships)

### 2.1 Onboarding

- Three-session flow (identity + academics + targets; story interview; preferences).
- Transcript + resume auto-parse with user review.
- Voice-anchor capture (writing sample).
- Recommender contact collection (never contact them without per-recommender approval).
- Profile attestation gate.

### 2.2 Research Engine

- 75–150 curated institutions (CSRankings top-50 + 20 mid-tier publics + user-specified).
- Program qualification: `core`, `adjacent`, `tangential`, `rejected`.
- Requirements extraction (GPA, GRE/English policies, LoR count, SOP + short-answer prompts, CV/portfolio flags, prereqs).
- Fee + waiver extraction.
- Funding discovery at grad-school, department, and lab levels.
- Funding classification with taxonomy-first approach.
- Deadline extraction with two-source rule near action time.
- Portal detection.
- Contact discovery (internal use).
- Profile enrichment via approved provider.
- Evidence ledger for every stored fact.

### 2.3 Strategy & Ranking

- Weighted scoring per [BLUEPRINT.md §8].
- Free-first prioritization (Phase A: free + waived; Phase B: paid with approval).
- Status machine (`auto_progress_free`, `apply_now`, `needs_user_review`, `pay_only_with_approval`, `low_confidence_hold`, `skip`, `conflict`).
- User overrides: pin, blacklist, weight adjustments.

### 2.4 Writing

- SOP, PS, short answers, cover letters (GA/TA/RA response).
- Resume + CV tailoring.
- Outreach drafts (not sent in v1).
- Draft/critique/rewrite loop with fact-check + style-check + voice-anchor.
- Story-bank-grounded only.
- Inline critic notes in review UI.

### 2.5 Browser Automation

- Adapters: Slate, CollegeNET, Liaison GradCAS, ApplyWeb, generic fallback.
- Account creation (approval-gated).
- Login (vault-referenced credentials or user session).
- Section-by-section form fill.
- Draft saving after each section.
- File uploads (profile documents).
- Fee-page detection → approval.
- Submission-gate proxy-click UX (user presses confirm; no auto-submit).
- Playwright trace + DOM snapshots per run.
- Drift detection with one-time user-confirmed field mapping refresh.

### 2.6 Approvals & Safety

- Unified approval queue (in-app + email + opt-in SMS).
- Batch approvals (approve N free apps with single batch diff).
- Per-action gates for every external side-effect.
- Emergency stop.
- Quiet hours.

### 2.7 Monitoring

- Freshness SLAs enforced at query time (stale = blocked).
- Scheduled refreshes with decay-curve urgency.
- Deadline escalations at 14/7/3/1 day.
- Golden-set regression weekly.

### 2.8 Observability & Audit

- Sentry errors, Axiom logs, OTel traces.
- Per-agent spans, per-extraction attempts, per-portal Playwright traces.
- Append-only evidence and action logs.
- User-facing evidence inspector.

---

## 3. Out of Scope (v1 does NOT ship)

### 3.1 Hard excludes (not in v1, possibly never)

- **Auto-submitting applications.** Never.
- **Auto-paying fees.** Never.
- **Auto-sending external communication** (email, LinkedIn, SMS). Never in v1.
- **PhD workflows.** Different workflow; separate product.
- **Multi-tenant support.** Single user per deployment.
- **Offer comparison or funding negotiation** (post-admission problem).
- **Letter-of-recommendation storage** (recommenders upload directly to portals).
- **Writing-sample / code-portfolio generation** (curate user-provided only).
- **Direct LinkedIn scraping.** ToS + provider alternative.
- **Raw credential storage.** Vault-only.
- **Integrated payment processing.** User pays on portals.

### 3.2 Deferred (v2+)

- **Outreach sending.** Drafts only in v1; sending enabled only after trust metrics in [roadmap.md](roadmap.md) Phase 7 are met.
- **Adjacent fields beyond user's stated preferences** (aggressive expansion).
- **Extra portal adapters** beyond the 4 + generic.
- **Mobile app or wrapper.**
- **Richer interview scheduling / prep.**
- **Alumni-network intelligence.**

---

## 4. What Stays Manual in v1

- Document uploads (transcripts, CV, writing samples) — user uploads once.
- Recommender requests — user explicitly approves each.
- Credential vault configuration — user links 1Password/Bitwarden.
- Final submit click — always human via proxy-click.
- Fee payment — user pays on portal after approval.
- Any interview or external meeting.
- Responding to admissions office follow-ups.

---

## 5. What Is Automated in v1

- Research sweeps (universities → programs → requirements → fees → funding → contacts).
- Extraction, classification, scoring.
- Story-bank-grounded writing draft loop.
- Form pre-fill for identity, education, tests, and demographic fields.
- Draft saving inside portals.
- Deadline monitoring and refresh scheduling.
- Evidence tracking and freshness enforcement.
- Approval queue population and batching.

---

## 6. Target Institutions Count

**75–150 institutions for the first real run.**

- CSRankings AI top-50 US + 20 mid-tier publics with strong AI groups + user-specified.
- Rationale: deep enough to produce a meaningful ranked list; shallow enough to keep research budget + LLM cost bounded and golden-set regression tractable.
- Broader discovery expansion is deferred to a post-MVP phase once quality is validated.

---

## 7. Success Metrics for MVP

| Metric | Target |
|---|---|
| Time to first scored program list after onboarding completes | ≤ 6 hours |
| User time from onboarding start → 10 submitted apps | ≤ 20 hours total |
| % of submissions that were free or fee-waived | ≥ 70% |
| Extraction field F1 vs golden set | ≥ 0.85 |
| Deadline accuracy in `apply_now` queue | ≥ 95% |
| Funding classification agreement with manual audit (n=30) | ≥ 90% |
| Essay drafts needing only light edits (≤30% line changes) | ≥ 80% |
| External actions taken without user approval | 0 (hard) |
| Freshness-SLA violations reaching user action | 0 (hard) |
| Playwright golden-set weekly run pass rate | ≥ 95% |

---

## 8. Quality Gates (can't ship without these)

1. Evidence validator blocks unsourced writes in every environment.
2. Fact-check rejects any unmapped verifiable claim before a draft reaches the user.
3. Approval gates exist on `submit_application`, `pay_fee`, `send_email`, `send_linkedin_msg`, `request_recommender`, `create_account`.
4. Emergency stop cancels running workflows and logs out portals.
5. Idempotency keys on all external side-effects.
6. Drift detection triggers adapter-mapping approval, not silent resume.
7. Golden-set regression in CI.
8. No raw credentials stored anywhere.
9. ToS-compliant data provider integrations only.
10. Propagation Checklist enforced per PR.

---

## 9. Demo Flow (day-one walkthrough)

This is the flow a first user should experience end-to-end:

1. **Sign in** (Clerk, MFA required).
2. **Onboarding Session 1 (≤40 min):** upload transcript + resume; edit auto-extracted fields; set target states and budget.
3. **Onboarding Session 2 (≤40 min):** voice/text story interview (~20 prompts); story bank draft appears; user verifies each story.
4. **Onboarding Session 3 (≤20 min):** preferences, recommenders, credential vault link, writing-voice sample.
5. **Attestation click:** profile revision locked.
6. **Research sweep starts** in background. Within ~6 hours, dashboard populates with scored program list, evidence badges, funding-class badges, fee-status badges.
7. **User reviews ranked list**, pins a few programs, blacklists one with a typo in the discovery.
8. **Free-queue starts processing:** drafts are generated for the top 10 free programs. User reviews SOPs (inline critic notes), lightly edits, approves.
9. **Portal automation starts:** account creation for each program prompts the user to approve (once per portal). Forms fill. Drafts save inside portals.
10. **Fee-page interruptions:** applications with fees pause for approval. User ignores Phase B for now.
11. **Submission approvals:** for each application prepared to the submit gate, user reviews the diff, clicks proxy-confirm. Submissions happen.
12. **Recommender invites:** for each approved application, user approves per recommender; portal emails them directly.
13. **Outreach drafts appear** (v1: sendable switch off). User reviews a few; they are kept for v2.
14. **Deadline escalations** surface over the following weeks.
15. **Post-submission follow-ups** drafted; user approves the polite ones.

---

## 10. What Would Kill MVP Trust

- A silent bug that auto-submits anything.
- A hallucinated publication in a draft essay.
- A wrong-professor email draft presented confidently.
- A mis-classified funding opportunity ("full tuition") that is actually partial.
- Fee marked as $0 when the portal shows $90 at checkout.
- Stale deadline acted on.

Every one of these has a specific mitigation in [risks.md](risks.md). They are the operational bar for "ship."

---

## 11. When MVP Is Done

MVP ships when all of the following are true:

- §8 Quality Gates all pass on a real user's first cycle (internal dogfood).
- §7 Success Metrics all meet or exceed targets on the dogfood cycle.
- At least 10 real applications submitted across at least 4 portals.
- Zero external actions without user approval in the action log.
- Post-cycle retrospective documented with top-5 follow-ups surfaced to [roadmap.md](roadmap.md) Phase 7+.

---

## 12. First Real User Considerations

The MVP will be used by the product author first (single tenant). This means:

- Loud uncertainty UX is more important than polish.
- Every surprising action needs a "why" panel.
- Backing out a decision must always be possible before an external action.
- The first cycle will produce the dataset that drives Phase 7 decisions about outreach enablement.

---

*Last updated: initial creation.*
