# workflows.md — MVP Workflow State Machines

> Explicit stepwise flows for the MVP. Trigger, steps, outputs, transitions, retries, failure handling, approval gates, cancellation.
>
> Source: [CLAUDE.md](CLAUDE.md), [BLUEPRINT.md §16](BLUEPRINT.md), [architecture.md §4.3](architecture.md), [agents.md](agents.md), [risks.md](risks.md).
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Workflow Conventions

- **Engine:** Inngest. Every workflow is a versioned function. Steps are idempotent; non-determinism is encapsulated in tool calls only.
- **Event bus:** workflows dispatch via typed events in `packages/workflows/events.ts`; no direct agent calls.
- **Approval gates** resolve via `waitForEvent('approval.decided', { id })`.
- **Emergency stop** cancels all in-flight workflow runs for the user (Inngest cancellation API) and logs out active portal sessions.
- **Retries:** per-step exponential backoff + jitter, max 5 attempts; permanent errors emit `work.failed` to the Coordinator.
- **Quiet hours** are respected for non-critical user notifications (per [architecture.md §4.12](architecture.md)).
- **Freshness enforced at query time.** If a workflow reads a stale critical record, it pauses and schedules a refresh before continuing.

---

## 2. Workflow Inventory

| Workflow | Primary trigger |
|---|---|
| `onboarding` | User completes sign-in; runs `session-1` → `session-2` → `session-3` → `attestation` |
| `research-sweep` | Cron daily during active cycle + manual kick |
| `funding-verification` | `funding.discovered` event from research sweep |
| `contact-discovery` | `program.qualified` event (parallel fan-out) |
| `writing` | User requests drafts OR `application.queued` event |
| `application-prep` | Approval `create_account` resolved + drafts ready |
| `approval-resolution` | `approval.decided` event (user decision) |
| `deadline-monitor` | Cron hourly |
| `refresh` | Cron nightly + freshness-violation event |

Each is detailed below as a state machine.

---

## 3. Onboarding Workflow

### 3.1 Trigger

- `onboarding.started` event from `app/(auth)` after user sign-in if `user.active_revision_id IS NULL`.

### 3.2 States

```
idle → session_1_in_progress → session_1_parsed
    → session_2_in_progress → story_bank_drafted
    → session_3_in_progress → preferences_saved
    → attestation_pending → attested → complete
```

### 3.3 Steps

1. **`start_session_1`** — load onboarding UI; user uploads transcript + resume; user fills identity + academics + targets.
2. **`parse_documents`** — call `UserProfileIngestionAgent` (PDF/resume parse). Writes `user_profile_revision` (not yet attested) and child profile tables.
3. **`start_session_2`** — story interview. Conversational UI with ~20 prompts. `StoryBankBuilderAgent` drafts candidate stories from interview + profile.
4. **`verify_stories`** — user confirms each story as `verified_by_user = true` or edits/rejects.
5. **`start_session_3`** — user completes preferences, recommender contacts, credential vault reference, voice-anchor sample.
6. **`capture_voice_anchor`** — embed sample text, store in `voice_anchor`.
7. **`attestation_gate`** — `ApprovalCheckpointAgent` creates an `approval_request` with `action_type = 'finalize_essay'`-analog (attestation). Wait for `approval.decided`.
8. **`lock_revision`** — set `user_profile_revision.attested_at`; set `user.active_revision_id`.
9. **`emit`** `onboarding.complete` → triggers first `research-sweep`.

### 3.4 Outputs

- One attested `user_profile_revision` with all child tables populated.
- ≥1 verified `story` rows (soft target ~30).
- One `voice_anchor` row.
- Recommender contacts stored in `profile_recommender` (no recommender contacted yet).
- `vault_reference` rows for the portals the user plans to use.

### 3.5 Retries

- Document parse failure → user re-uploads; parser re-runs. No background retry.
- Story draft failure → fall back to manual text entry.

### 3.6 Failure handling

- If user abandons a session, workflow pauses with `onboarding.paused` event; resumes on next sign-in.
- If profile has any critical field blank at attestation, `ApprovalCheckpointAgent` rejects attestation with the list of blanks.

### 3.7 Approval gates

- **Attestation gate** before locking the revision (user must confirm).
- **No recommender is contacted** during onboarding; recommender rows are saved only.

### 3.8 Cancellation

- User can restart any session; a new revision is created only when attestation happens. Partial work is discarded or re-used at the user's option.

---

## 4. Research Sweep Workflow

### 4.1 Trigger

- `research.cycle_started` from `onboarding.complete` or from daily cron during active cycle.

### 4.2 States

```
queued → seeding → discovering → qualifying
       → (parallel per program)
            extracting → mapping_portal
            → funding_discovering → funding_classifying
            → contact_discovering
       → persisting → scoring → complete
```

### 4.3 Steps

1. **`seed_institutions`** — deterministic; reads `fixtures/seeds/universities.csv` and upserts `university` rows with seed attestation evidence.
2. **`university_discover`** — `UniversityDiscoveryAgent` for any expansion signals. Emits `university.qualified` per institution.
3. **`program_qualify` (fan-out per university)** — `ProgramQualificationAgent`. Emits `program.qualified` per matching program with `relevance_class`.
4. **Parallel per program:**
   - **`requirements_extract`** → `RequirementsExtractionAgent`.
   - **`fee_extract`** → `FeeAndWaiverAgent`.
   - **`funding_discover`** → `FundingDiscoveryAgent`; per opportunity fans out into `FundingClassificationAgent` (→ `funding-verification` sub-workflow).
   - **`deadline_extract`** → `DeadlineAgent`.
   - **`portal_map`** → `PortalMapperAgent`.
   - **`contact_discover`** → triggers `contact-discovery` sub-workflow.
5. **`persist_evidence`** — wrapping step that validates every write has evidence (via `packages/evidence/validator.ts`).
6. **`compute_scores`** — SQL materialized-view refresh per [BLUEPRINT.md §8](BLUEPRINT.md).
7. **`emit`** `research.cycle_complete` → dashboard notification + deadline-monitor kick.

### 4.4 Outputs

- Upserted `graduate_program` rows with `relevance_class`.
- Versioned `fee_policy`, `application_deadline`, `requirement_set`, `essay_prompt`, `funding_opportunity`, `portal_binding`.
- `evidence` rows for every interpreted fact.
- Refreshed scored materialized view.

### 4.5 Retries

- Per-step exponential backoff + jitter, max 5.
- Crawler 429/503 → back off per `packages/crawlers/rate-limits.ts`.
- Extraction schema violation → one retry with stricter prompt; second failure → emit `work.failed` with the unparsable payload (R1).

### 4.6 Failure handling

- **Single program failure** does not block the run; the program is marked `active = false` pending next cycle.
- **Systemic failure** (e.g., AI Gateway outage) pauses the sweep and alerts.
- **Evidence-less write attempt** is rejected at the DB layer; agent must retry with evidence or escalate.

### 4.7 Approval gates

- None within the sweep (purely internal).
- Downstream actions (submission, fee, outreach) are gated by their own workflows.

### 4.8 Cancellation

- Emergency stop cancels the sweep; already-persisted data stays (append-only invariants preserve it).

---

## 5. Funding Verification Workflow

### 5.1 Trigger

- `funding.discovered` from `FundingDiscoveryAgent`.

### 5.2 States

```
discovered → classifying → (classified | unclear)
           → ready_for_scoring
```

### 5.3 Steps

1. **`taxonomy_match`** — deterministic phrase match per `packages/classifiers/funding-taxonomy.ts`.
2. **`llm_fallback`** — only if no deterministic match; LLM classification via Haiku/Sonnet with `quoted_source` required.
3. **`phrase_gate`** — if `funding_class ∈ {full_tuition_plus_stipend, full_tuition_only}`, require approved phrase (see R5). Otherwise downgrade to `partial_tuition` or `unclear`.
4. **`persist`** — write `funding_opportunity` row with `evidence_id[]` and `funding_class`.
5. **`conflict_check`** — if two classifications disagree within threshold, create `field_candidate` rows and emit `approval.confirm_conflict` on critical fields.

### 5.4 Outputs

- One `funding_opportunity` row (new version) per opportunity.
- Conflict approval rows where applicable.

### 5.5 Retries

- LLM fallback max 1 retry with stricter prompt before marking `unclear`.

### 5.6 Failure handling

- Any uncertainty about full-tuition → mandatory downgrade to `partial_tuition` or `unclear` (R5).
- Opportunity with no evidence → rejected at write.

### 5.7 Approval gates

- **Conflict approval** (`confirm_conflict`) when two strong candidates disagree on `funding_class`.

### 5.8 Cancellation

- Individual opportunity failure does not cancel siblings.

---

## 6. Contact Discovery Workflow

### 6.1 Trigger

- `program.qualified` (one per program).

### 6.2 States

```
discovering → enriching → scoring → (bound | candidate | rejected)
```

### 6.3 Steps

1. **`directory_crawl`** — department + grad-school + lab pages via Firecrawl.
2. **`role_classify`** — deterministic role taxonomy (`professor`, `pi`, `dgs`, `coordinator`, `hr`, `lab_manager`, `staff`).
3. **`email_extract`** — on-page email with deobfuscation.
4. **`enrich`** — per candidate, call approved provider (Proxycurl/PDL) and Google Scholar via SerpAPI.
5. **`score`** — multi-signal match scoring (institution, title, research-area overlap).
6. **`persist`**:
   - Confidence ≥ 0.85 → bound `linkedin_profile` + `person_role`.
   - Confidence 0.65–0.85 → internal use only; `linkedin_profile.confidence` stored; outreach disabled.
   - <0.65 → candidate pool only, not bound.
7. **`emit`** `contact.resolved` with confidence band.

### 6.4 Outputs

- `person`, `person_role`, `linkedin_profile`, `professional_profile` rows with confidences.
- `field_candidate` rows for ambiguous persons.

### 6.5 Retries

- Provider rate-limit → backoff.
- Provider outage → degrade to directory + scholar only; confidence capped at 0.70.

### 6.6 Failure handling

- **Name collision** above threshold → candidates kept distinct; no silent bind.
- **ToS concern** (e.g., unapproved provider) → halt that provider, flag in risks log.

### 6.7 Approval gates

- None for internal use. Outreach binding threshold enforced downstream in `outreach` workflow.

### 6.8 Cancellation

- Per-program cancellation supported; `person_role` rows persist (external-world).

---

## 7. Writing Workflow

### 7.1 Trigger

- `application.queued` or user clicks "draft essays for program X."

### 7.2 States

```
queued → drafting → critiquing → rewriting → fact_checking → style_checking
       → (needs_rewrite | ready_for_review)
       → user_review → (edited | approved)
       → approved
```

### 7.3 Steps

1. **`load_context`** — program evidence, opportunity evidence, essay prompt, user profile slice, voice anchor, verified story bank (only `verified_by_user = true`).
2. **`draft`** — Opus; per-artifact prompt from `packages/writing/prompts/`.
3. **`critique`** — Sonnet, different prompt; produces inline notes.
4. **`rewrite`** — Opus addresses critic notes.
5. **`fact_check`** — deterministic; claims extracted; each verifiable claim must map to a `story` or a `profile_*` field. Unmapped = reject.
6. **`style_check`** — voice-anchor similarity ≥ threshold; cliché scan; originality score.
7. **Loop decision**:
   - Fact-check fail → rewrite once with tagged claims removed. Second fail → emit `approval.finalize_essay` with user prompt to supply missing info.
   - Style-check below threshold → one rewrite; if still below, surface to user.
8. **`persist_artifact`** — write `application_artifact` with new `draft_version`.
9. **`emit`** `draft.ready` → UI notification.

### 7.4 Outputs

- `application_artifact` rows with content refs in Blob.
- Critic-notes JSON stored alongside artifact (for review UI).
- Fact-check and style-check reports.

### 7.5 Retries

- Draft model failure → retry once.
- Fact-check failure counts toward the rewrite budget (max 2).

### 7.6 Failure handling

- **Unmapped claim** after 2 rewrites → escalate to user (`finalize_essay` approval).
- **Hallucinated publication or award** (R10) → logged; instance audited; drafter prompt strengthened.

### 7.7 Approval gates

- **User review + approval** before the artifact can be attached to an application section.
- **Finalize-essay approval** if fact-check cannot resolve.

### 7.8 Cancellation

- Cancelling mid-workflow discards the in-flight draft; previous `draft_version` remains.

---

## 8. Application Preparation Workflow

### 8.1 Trigger

- `application.ready_to_prepare` (approved drafts + portal binding + vault reference + account approved).

### 8.2 States

```
queued → account_ready → logging_in → section_filling
       → validation
       → (save_draft | resolve_error)
       → awaiting_review → submission_preview
       → awaiting_submission_approval → submitted
```

### 8.3 Steps

1. **`account_gate`** — if no account for this portal, create `approval_request` type `create_account`. Wait.
2. **`login`** — via vault reference or user session; 2FA ping window (5 min) per R13.
3. **Section-by-section fill** (driven by `ApplicationExecutionAgent` on the Playwright worker):
   - Identity, education, tests, demographics: auto-fill.
   - Essays, short answers, portfolio: attach approved artifact references.
   - Recommenders: portal invites recommender after per-recommender approval.
4. **`save_draft`** after each section; capture DOM snapshot to Blob; update `application_section_state`.
5. **`validation`** — parse validation errors; retry or escalate.
6. **`fee_page_detect`** — if the portal's fee/checkout page is reached, halt and create `pay_fee` approval. Fee page fingerprint must match (R24); any ambiguity halts.
7. **`submission_preview`** — capture submission preview; create `approval_request` type `submit_application` with evidence summary + fee status + confidence.
8. **`proxy_click`** — on approval, user-initiated click resolves the approval, which releases the adapter's `prepareSubmit → finalSubmit` path (only inside the approval resolution handler).
9. **`post_submit`** — update `application.status = 'submitted'`; write `action_log` with idempotency key.

### 8.4 Outputs

- Updated `application` and `application_section_state`.
- Playwright trace URL per run.
- `action_log` on each external-side-effect.

### 8.5 Retries

- Transient portal errors → backoff retry on the same section.
- Drift detected (DOM hash diff) → pause; create `confirm_field_mapping` approval; resume after user confirms mapping (R12).
- Login failure → re-auth path; if 2FA not completed within 5 min, pause and ping user; queue resume.

### 8.6 Failure handling

- **Validation error unresolvable** → pause with screenshot; user takes over or cancels.
- **Anti-bot / captcha** → pause; ping user; offer manual handoff (R13).
- **Fee page ambiguity** → halt by design; user confirms.
- **Unexpected "submit" button reached without an approval** → hard error; revert and alert (R19).

### 8.7 Approval gates

- **`create_account`** once per portal.
- **`pay_fee`** per application if paid.
- **`submit_application`** per application.
- **`request_recommender`** per recommender per application.
- **`confirm_field_mapping`** on drift.
- **`resume_session_2fa`** on 2FA.

### 8.8 Cancellation

- User can cancel at any state up to `submitted`. Drafts saved on the portal persist; our side-effect count does not grow.
- Emergency stop forces logout across portals and flushes pending approvals.

---

## 9. Approval Resolution Workflow

### 9.1 Trigger

- `approval.decided` event from UI when user decides.

### 9.2 States

```
pending → (approved | edited | skipped | expired)
```

### 9.3 Steps

1. **`validate`** — verify `approval_request.status = 'pending'`; reject if terminal.
2. **`resolve`** — perform the approved action through the owning workflow (which is `waitForEvent`-paused).
3. **`log`** — append `action_log` row with `actor = user`, decision, idempotency key.
4. **`emit`** `approval.resolved` to the waiting workflow.

### 9.4 Outputs

- Mutated `approval_request.status`.
- Resumed waiting workflow.

### 9.5 Retries

- None; user decisions are authoritative.

### 9.6 Failure handling

- Expired approvals (past SLA) are marked `expired` and the owning workflow decides whether to re-request or skip.

### 9.7 Approval gates

- This is the resolution of gates; it is not itself gated.

### 9.8 Cancellation

- Emergency stop expires all pending approvals with `outcome = 'emergency_cancel'`.

---

## 10. Batch Approval Workflow

### 10.1 Trigger

- User selects N items in the approval queue with the same `action_type` (typically free applications) and chooses "approve all".

### 10.2 States

```
batch_selected → batch_diff → batch_awaiting_confirm
              → batch_approved → individual_resolutions
```

### 10.3 Steps

1. **`build_batch_diff`** — render a single diff view summarizing each item's payload, evidence snippet, and confidence.
2. **`confirm`** — user confirms the batch; produces one `approve_batch` `approval_request` plus individual items with `parent_approval_id`.
3. **`fan_out`** — emit `approval.decided` per member item in sequence (not parallel to preserve external-rate-limit sanity).

### 10.4 Outputs

- One batch `action_log` row + one per individual resolved action.

### 10.5 Approval gates

- Single user click releases N actions; no further gating per item.

### 10.6 Cancellation

- Batch mid-flight can be cancelled; already-resolved members stand; remaining members revert to `pending`.

---

## 11. Deadline Monitor Workflow

### 11.1 Trigger

- Hourly cron per user during active cycle.

### 11.2 Steps

1. **`scan_upcoming`** — query `application_deadline` rows valid now, ordered by `deadline_date`.
2. **`classify_urgency`** — 14/7/3/1-day horizons.
3. **`freshness_check`** — any deadline within 14 days must have evidence within its SLA; otherwise emit `refresh.deadline` event.
4. **`notify`** — create or update per-program urgency banner; email/SMS per quiet-hours rules.
5. **`escalate`** — at 3-day and 1-day horizons, elevate to email + SMS (opt-in).

### 11.3 Outputs

- Urgency banners, notifications.
- Triggered refreshes.

### 11.4 Retries/Failures

- Notification-channel failure retried once; fallback to in-app only.

### 11.5 Approval gates

- None for scanning; refresh-triggered workflows follow their own gates.

### 11.6 Cancellation

- Emergency stop halts notifications but not the scan (read-only).

---

## 12. Refresh Workflow

### 12.1 Trigger

- Nightly cron + `refresh.<record_class>` events from freshness violations.

### 12.2 Steps

1. **`select_stale`** — records past their SLA, prioritized by action proximity.
2. **`refresh_per_class`** — re-run the relevant extractor / agent against a fresh crawl.
3. **`version_record`** — write a new versioned row; set `valid_to` on the prior row.
4. **`diff_notify`** — if a critical field changed (fee amount, deadline date, funding class), create an approval or notification per severity.

### 12.3 Retries

- Crawler retries as in research sweep.

### 12.4 Failures

- Persistent refresh failure on a critical record → block user action on that record and surface in UI until refresh succeeds.

### 12.5 Approval gates

- Critical diff (e.g., deadline moved) → user confirmation before any downstream action resumes.

### 12.6 Cancellation

- Skippable. Emergency stop cancels.

---

## 13. Emergency Stop Workflow

### 13.1 Trigger

- User clicks "emergency stop" in UI.

### 13.2 Steps

1. **`cancel_all`** — Inngest cancellation API for every workflow run for this user.
2. **`logout_portals`** — signal to Playwright worker to end every active session.
3. **`expire_approvals`** — mark all `pending` approvals `expired` with `outcome_detail = { reason: 'emergency_stop' }`.
4. **`record`** — `action_log` entry with `action_type = 'emergency_stop'`.
5. **`notify`** — confirm stop in UI + email.

### 13.3 Outputs

- All user-scoped workflows cancelled.
- Logged-out portal sessions.

### 13.4 Resume

- Explicit user re-enable; workflows do not auto-resume; research sweep must be re-kicked.

---

## 14. Workflow-to-Approval Map

| Workflow | Approval types emitted |
|---|---|
| Onboarding | `finalize_essay` (attestation-analog) |
| Research sweep | (none directly) |
| Funding verification | `confirm_conflict` |
| Contact discovery | (none in MVP) |
| Writing | `finalize_essay` |
| Application prep | `create_account`, `pay_fee`, `submit_application`, `request_recommender`, `confirm_field_mapping`, `resume_session_2fa` |
| Approval resolution | (resolves, doesn't emit) |
| Batch approvals | `approve_batch` |
| Deadline monitor | (none; emits notifications) |
| Refresh | `confirm_conflict` when critical diff |
| Outreach (post-MVP) | `approve_outreach` (draft-only in MVP; send disabled) |

---

## 15. Cancellation Semantics

- **Per-workflow cancel** via Inngest API; affected steps stop at next step boundary.
- **Emergency stop** cancels all user workflows simultaneously and performs portal logout.
- **Portal-session cancellation** ends the Playwright context; on resume, a new context is created; no silent resume of interrupted portal actions (R21).

---

## 16. Missing Inputs

- Exact schedule for daily research-sweep cron (user time-zone dependent). **Safe default:** 03:00 user local.
- Quiet-hours default values beyond onboarding pick. **Safe default:** 22:00–08:00 user local.
- SMS opt-in channel (Twilio configured yet?). **Safe default:** in-app + email in MVP; SMS behind a flag.

## Open Questions

- Should a user-initiated "pause everything" be separate from emergency stop? **Safe default:** one button (`emergency_stop`); add softer pause in Phase 6 only if needed.
- Should fan-out per program respect a per-user concurrency cap lower than Inngest's default? **Safe default:** cap at 5 parallel programs, configurable per user.

---

*Last updated: initial creation.*
