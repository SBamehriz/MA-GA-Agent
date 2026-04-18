# api-spec.md — Internal API & Service Boundaries

> The contracts between `/app` (Next.js), `/packages/*`, `/worker-browser`, Inngest workflows, approvals, and external providers.
>
> Source: [CLAUDE.md](CLAUDE.md), [architecture.md](architecture.md), [agents.md](agents.md), [workflows.md](workflows.md), [repo-structure.md](repo-structure.md).
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Contract Conventions

- **Inputs and outputs are Zod-schema typed** in every package barrel.
- **No untyped any at boundaries.** `any` is forbidden in exported signatures.
- **Sync vs async:** Server Actions and Route Handlers for user requests; Inngest steps for anything long-running (> 1 s) or side-effecting.
- **Local script surfaces are first-class.** The current onboarding-memory slice may call the same package contracts from `/scripts` without requiring auth, web routes, or deployment plumbing.
- **Approval-triggered operations** are never exposed as direct endpoints; they are always resolved through the approval queue.
- **Worker operations** (Playwright) are called only from within Inngest steps, never from a Route Handler.
- **Idempotency keys** are required on every external side-effect and are computed in `packages/shared/idempotency.ts`.

---

## 2. Service/Module Boundaries

```
User → /app (Next.js) → Server Actions / Route Handlers
                      → packages/* (business logic)
                      → packages/workflows (Inngest trigger)
                                      → packages/agents/*
                                      → packages/shared/worker-client → worker-browser (mTLS)
                                      → external providers (via shared/ai, shared/crawlers, shared/contacts providers)
```

- `/app` never imports `drizzle-orm`, Anthropic SDK, Inngest `Inngest` class, or Playwright.
- `/app` imports typed query helpers from `packages/db`, typed gateway helpers from `packages/shared/ai`, typed event emitters from `packages/workflows/events`.
- `packages/agents/*` never call each other; they emit events through the Coordinator.
- `worker-browser` never reaches into Postgres; it receives a job payload and returns a typed result.

---

## 3. Route Handlers (`/app/api`)

### 3.1 `POST /api/inngest`

- **Purpose:** Inngest webhook receiver.
- **Auth:** Inngest signing key (HMAC).
- **Contract:** passthrough to the Inngest `serve` handler.

### 3.2 `GET /api/approvals`

- **Purpose:** list pending approvals for the current user.
- **Auth:** Clerk session.
- **Input:** query `status?=pending|approved|expired|skipped|edited`.
- **Output:** `{ items: ApprovalSummary[] }`.

### 3.3 `GET /api/approvals/:id`

- **Purpose:** approval detail.
- **Output:** `{ approval: ApprovalRequest, evidence: EvidenceSnippet[], confidence: number, defaultAction, actionType }`.

### 3.4 `POST /api/approvals/:id/decide`

- **Purpose:** user decides an approval (approve / edit / skip).
- **Auth:** Clerk session, MFA required for `action_type ∈ { submit_application, pay_fee, create_account, send_email, send_linkedin_msg, request_recommender }`.
- **Input:** `{ decision: 'approve' | 'edit' | 'skip', editPayload?: unknown }`.
- **Output:** `{ status: 'resolved' }`.
- **Side-effects:**
  1. Write `action_log` with `actor = user`, idempotency key.
  2. Update `approval_request.status`.
  3. Emit `approval.decided` to Inngest.
- **Idempotency:** repeated requests for the same `:id` with the same decision short-circuit.

### 3.5 `POST /api/worker/callback`

- **Purpose:** Playwright worker posts progress / results.
- **Auth:** mTLS.
- **Input:** `{ jobId: string, state: WorkerJobState, artifacts?: { traceUrl?, domSnapshotRef? }, validationErrors?: ValidationError[] }`.
- **Output:** `{ ok: true }`.
- **Side-effects:** update `application_section_state`; emit worker-progress events.

### 3.6 `POST /api/webhooks/resend`

- **Purpose:** email reply ingestion (post-MVP readiness; no send in v1).
- **Auth:** Resend signing secret.
- **Input:** Resend webhook payload.
- **Output:** `{ ok: true }`.
- **MVP behavior:** records the event only; no action taken.

### 3.7 `POST /api/webhooks/clerk`

- **Purpose:** user events (optional in single-tenant MVP).

### 3.8 Emergency stop

- `POST /api/emergency-stop` → triggers the emergency-stop workflow in [workflows.md §13](workflows.md).

---

## 4. Server Actions

Server Actions live inside pages under `/app`. They call typed queries in `packages/db` or emit events to `packages/workflows`.

### 4.1 Onboarding actions

- Current implementation note: these actions may exist first as local script or package calls; a web surface is optional.
- `saveIdentity(input)` → `UserProfileIngestionAgent.run({ section: 'identity', input })`.
- `uploadTranscript(fileRef)` → worker-less PDF parse → profile child tables.
- `uploadResume(fileRef)` → resume parse → profile child tables.
- `runStoryInterviewTurn(answer)` → `StoryBankBuilderAgent.run({ turn, answer })` — returns next prompt + running story drafts.
- `verifyStory(storyId, verified)` → updates `story.verified_by_user`.
- `savePreferences(input)` → updates `user.preferences_json` (validated against preferences Zod schema).
- `saveVoiceAnchor(sampleText)` → embeds + stores.
- `saveVaultReference(input)` → stores opaque handle only.
- `attestRevision()` → creates `approval_request` (attestation); on resolution, sets `user_profile_revision.attested_at`.

### 4.2 Dashboard actions

- `pinProgram(programId)`, `unpinProgram(programId)`, `blacklistProgram(programId)`.
- `requestDrafts(programId, kinds: artifactKind[])` → emits `writing.requested`.
- `queueApplication(programId)` → inserts `application` with `status = 'queued'`; emits `application.queued`.
- `cancelApplication(applicationId)` → marks declined.
- `updateWeights(weights)` → updates user-scoped scoring weights.

### 4.3 Approval actions

- `decideApproval(id, decision)` → same semantics as `POST /api/approvals/:id/decide`.
- `approveBatch(ids[])` → emits `approval.batch_confirmed`.

### 4.4 Essay actions

- `saveDraftEdit(artifactId, editedContent)` → writes a user-edited draft revision.
- `approveArtifact(artifactId)` → sets `approved_by_user_at`.

### 4.5 Emergency

- `emergencyStop()` → triggers workflow.

Every Server Action:

- Extracts `userId` via Clerk when invoked from the web app; local scripts may inject the single local user id directly.
- Validates input via Zod.
- Writes an `action_log` row for anything that mutates externally.
- Never bypasses the evidence validator.

---

## 5. Internal Package Contracts

### 5.1 `packages/shared/ai`

```ts
aiGateway.run<TaskName extends keyof TaskRouter>(
  task: TaskName,
  input: TaskRouter[TaskName]['input']
): Promise<TaskRouter[TaskName]['output']>;
```

- Per-task routing: `extract_generic`, `extract_deadline`, `extract_fee`, `extract_tuition`, `extract_stipend`, `classify_funding`, `classify_relevance`, `draft_sop`, `critique_sop`, `draft_outreach`, etc.
- Enforces prompt-caching and per-run token budget.
- Emits OTel span per call.

### 5.2 `packages/db` query helpers

Every table gets typed functions:

```ts
// illustrative
programs.listByRelevance({ userId, classes: RelevanceClass[] }): Promise<ProgramRow[]>
fees.active({ programId }): Promise<FeePolicyRow | null>
deadlines.upcoming({ userId, horizonDays }): Promise<DeadlineRow[]>
evidence.forSubject({ subjectType, subjectId }): Promise<EvidenceRow[]>
idempotency.reserve(key, meta): Promise<{ firstReserve: boolean }>
idempotency.complete(key, resultRef): Promise<void>
actionLog.append(row): Promise<void>
```

All interpreted-fact writes go through `withEvidence({...}, evidence)` wrapper.

### 5.3 `packages/evidence`

```ts
validator.assertHasEvidence(row: AnyInterpretedRow): void // throws
freshness.isStale(row, recordClass): boolean
supersede.writeNewVersion(tableName, oldRowId, newRow, evidence): Promise<Row>
hash.normalizeAndHash(content: string): string
```

### 5.4 `packages/agents/<agent>`

Every agent exports:

```ts
export const contract: AgentContract;
export async function run(input: InputSchemaType, ctx: AgentContext): Promise<OutputSchemaType>;
```

`AgentContext` provides:
- `userId`
- `emit(event, payload)` (typed, routed to Inngest)
- `tools` whitelist instance
- `logger`, `tracer`
- `storage` (evidence, db)

### 5.5 `packages/workflows/events`

Typed event registry; every event declared with a Zod schema. Examples:

- `research.cycle_started { userId, cycleId }`
- `university.qualified { universityId, evidenceIds[] }`
- `program.qualified { programId, relevanceClass, evidenceIds[] }`
- `funding.discovered { opportunityId, programId, evidenceIds[] }`
- `funding.classified { opportunityId, fundingClass, evidenceIds[] }`
- `contact.resolved { personId, role, confidence }`
- `draft.ready { artifactId, applicationId }`
- `application.queued { applicationId }`
- `application.section_complete { applicationId, sectionKey }`
- `submission.ready { applicationId, previewRef }`
- `approval.created { approvalId, actionType }`
- `approval.decided { approvalId, decision }`
- `emergency.stop { userId }`

### 5.6 `packages/approvals`

```ts
queue.create(input: ApprovalCreateInput): Promise<ApprovalId>
queue.get(id): Promise<ApprovalDetail>
queue.decide(id, decision, editPayload?, userId): Promise<void>
queue.expire(olderThan: Duration): Promise<void>
batching.buildBatchDiff(ids[]): Promise<BatchDiff>
emergencyStop.trigger(userId): Promise<void>
notifier.notify(userId, payload): Promise<void>
```

`ApprovalCreateInput` requires `evidenceSummary`, `confidence`, `defaultAction`, and the action-type-specific payload schema.

### 5.7 `packages/writing`

```ts
drafter.draft(kind: ArtifactKind, ctx: WritingCtx): Promise<DraftResult>
critic.critique(draft: DraftResult, ctx: WritingCtx): Promise<CritiqueResult>
rewriter.rewrite(draft: DraftResult, critique: CritiqueResult, ctx): Promise<DraftResult>
factCheck.run(draft, ctx): Promise<FactCheckReport> // reject = throws
styleCheck.run(draft, voiceAnchor): Promise<StyleReport>
```

`WritingCtx` includes only `verified_by_user = true` stories, the profile slice needed, the voice anchor, and the program/opportunity evidence snapshot.

### 5.8 `packages/portal-adapters`

```ts
interface PortalAdapter {
  readonly vendor: PortalVendor;
  fingerprint(domSample: string, url: string): Promise<FingerprintResult>;
  ensureAccount(ctx: AdapterCtx): Promise<AccountState>;
  login(ctx: AdapterCtx): Promise<LoginState>;
  fillSection(ctx: AdapterCtx, section: SectionKey, payload: SectionPayload): Promise<SectionResult>;
  detectFeePage(ctx): Promise<FeePageDetection>;
  prepareSubmit(ctx): Promise<SubmissionPreview>;
  // NOTE: no `submit()` method. Final submit is released only inside approval-resolution handler.
}
```

`AdapterCtx` is supplied by the worker and includes a Playwright page + persistent context + mTLS-authenticated callback URL.

### 5.9 `packages/contacts`

```ts
discovery.findContactsForProgram(programId): Promise<ContactCandidate[]>
enrichment.enrich(candidate): Promise<EnrichmentResult>
matchScoring.score(signals): number
merge.reconcile(candidates): Promise<ResolvedContact[]>
outreachPolicy.allowed(contact, contextCalendar): boolean
```

`enrichment.enrich` never calls LinkedIn directly. Approved provider only.

---

## 6. Worker-Browser API

The worker exposes mTLS endpoints called from Inngest steps via `packages/shared/worker-client`.

### 6.1 `POST /worker/jobs`

- **Purpose:** dispatch a browser job.
- **Input:**
  ```
  {
    jobId: string,
    kind: 'prepare_submit' | 'section_fill' | 'account_create' | 'drift_check' | 'detect_fee',
    applicationId: string,
    vendor: PortalVendor,
    payload: KindSpecificPayload,
    callbackUrl: string,     // /api/worker/callback
    signedCredRefs: VaultRef[],
    maxDurationMs: number,
    idempotencyKey: string
  }
  ```
- **Output:**
  ```
  { accepted: true, jobId }
  ```
- **Behavior:**
  - Worker acknowledges synchronously.
  - Progress and completion posted to `callbackUrl` asynchronously.
  - Captures Playwright trace; uploads to Vercel Blob; returns `traceUrl` in callbacks.

### 6.2 `GET /worker/health`

- mTLS; returns `{ ok: true, activeContexts, version }`.

### 6.3 `POST /worker/sessions/:portal/logout`

- Ends all contexts for the portal. Used by emergency stop.

### 6.4 Worker invariants

- No `submit` endpoint. `prepare_submit` returns a preview; actual final-submit is executed only when the approval resolution calls back into the worker with a release token generated server-side on approval.
- Every job run captures a trace and DOM snapshots per section.
- Worker refuses any job whose `kind` is unknown or whose idempotency key is already `completed`.

---

## 7. Sync vs Async Boundaries

| Operation | Sync (Server Action / Handler) | Async (Inngest) |
|---|---|---|
| Load dashboard | ✔ | |
| List approvals | ✔ | |
| Decide an approval | ✔ (updates DB), emits event | ✔ (resumes waiting workflow) |
| Upload transcript/resume | ✔ (parse) | |
| Start research sweep | ✔ (emit event) | ✔ (long-running) |
| Run extraction | | ✔ |
| Draft essay | ✔ (emit `writing.requested`) | ✔ |
| Prepare application (portal) | | ✔ (worker jobs) |
| Submit application | ✔ (approval decide) + ✔ (worker release via callback) | |
| Pay fee | The user pays on portal; we do not process payments. |
| Deadline monitor | | ✔ (cron) |
| Refresh | | ✔ (cron + event) |

---

## 8. Approval-Triggered Operations

All of these are behind the approval queue. The owning workflow emits an approval, `waitForEvent('approval.decided')`, then resumes.

| Action | Approval type | Idempotency key scope |
|---|---|---|
| Create portal account | `create_account` | `(user, portal, cycle)` |
| Pay fee (user-initiated on portal) | `pay_fee` | `(user, program, cycle)` |
| Submit application (proxy click) | `submit_application` | `(user, program, cycle)` |
| Send email (post-MVP) | `send_email` | `(user, recipient, message_hash)` |
| Send LinkedIn message (post-MVP) | `send_linkedin_msg` | `(user, recipient, message_hash)` |
| Request recommender | `request_recommender` | `(user, recommender, application)` |
| Confirm field mapping on drift | `confirm_field_mapping` | `(user, portal, field_mapping_hash)` |
| Confirm conflict | `confirm_conflict` | `(user, subject, field_name)` |
| Resume session with 2FA | `resume_session_2fa` | `(user, portal, session_id)` |
| Finalize essay | `finalize_essay` | `(user, artifact_id, draft_version)` |
| Attest onboarding profile | `attest_profile` | `(user, profile_revision_id)` |

**MVP constraint:** `send_email` and `send_linkedin_msg` approvals can be created (for drafts), but the send endpoint is physically absent from the v1 build (R22).

---

## 9. Error Semantics

All package errors are typed instances of:

```ts
class AppError extends Error {
  class: 'EvidenceMissing' | 'FreshnessStale' | 'ApprovalRequired' | 'ToolDenied' |
         'WorkerMTLSFailure' | 'PortalDrift' | 'IdempotencyClaimed' |
         'ExtractionSchemaViolation' | 'FactCheckRejected' | 'StyleBelowThreshold' |
         'ProviderOutage' | 'ConflictRequiresUser' | 'UnknownPortal' | ...
  detail: unknown
}
```

Route Handlers map to HTTP:

| Error class | HTTP |
|---|---|
| `EvidenceMissing` | 500 (server bug) |
| `ApprovalRequired` | 409 with next-step hint |
| `FreshnessStale` | 409 |
| `IdempotencyClaimed` | 200 (return prior result) |
| `ToolDenied` | 403 |
| `ConflictRequiresUser` | 409 with approval id |

Workflows use `AppError.class` to decide retry vs escalate.

---

## 10. Rate Limits & Budgets

- Per-user workflow concurrency: 5 parallel program fan-outs; configurable.
- Per-domain crawl: from `packages/crawlers/rate-limits.ts` per-domain table.
- Per-run token budget: enforced in `packages/shared/ai-budgets.ts`; exceeding emits `budget.exceeded` and halts the run with `provider_outage`-analog handling.
- AI Gateway prompt cache TTL: default 1h (extraction) / 24h (system prompts).

---

## 11. Observability Contracts

Every boundary emits:
- **Span:** `service = 'ma-ga-agent'`, `agent = '<name>'` or `route = '<path>'`, `user_id` hash.
- **Log:** structured via `packages/shared/logger`, Axiom-ingested, redacted.
- **Error:** Sentry with user id hash + OTel trace id.
- **Metric (via span attribute):** `tokens_in`, `tokens_out`, `latency_ms`, `outcome`.

---

## 12. Security Boundary Rules

- No raw credential ever leaves `packages/*` or appears in worker job payloads. Worker receives vault references; actual credential materialization happens inside the worker talking directly to the vault provider.
- mTLS on every Vercel ↔ worker call. Plain HTTPS is rejected.
- HMAC verification on all inbound webhooks.
- Per-action MFA enforcement via Clerk step-up for high-risk approvals.
- Data-sharing allowlist consulted before any outbound provider call; violations throw `ToolDenied`.

---

## 13. Missing Inputs

- Resend dedicated signing secret and domain verification. **Safe default for MVP:** configure but do not activate outgoing send.
- Vault provider API specifics (1Password Connect vs Bitwarden CLI). **Safe default:** interface in `packages/shared` with a 1Password implementation and a Bitwarden stub.
- Whether Clerk step-up MFA is available on free tier. **Safe default:** if not, require password re-entry on high-risk approvals.

## Open Questions

- Should `/api/approvals/:id/decide` also support SMS callback links for approval via link? **Safe default:** not in MVP; opt-in SMS delivers a deep link into the app.
- Should Server Actions be the main entry point and Route Handlers exist only for worker + webhooks? **Safe default:** yes for MVP; add REST endpoints only when a non-web client lands.

---

*Last updated: initial creation.*
