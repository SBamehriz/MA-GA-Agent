# implementation-notes.md

## Step 0.1 Notes

### 1. Documentation path ambiguity
- Blocker: `implementation-sequence.md` and `plan.md` mention scaffolding `/docs`, while `repo-structure.md` and `CLAUDE.md` treat the root-level docs as authoritative.
- Why it matters: creating `/docs` would diverge from the documented file map and break later path assumptions.
- Safe default used: no `/docs` directory was created; docs remain at the repository root.
- Follow-up needed: align `implementation-sequence.md` and `plan.md` with `repo-structure.md`.

### 2. Root TypeScript config ambiguity
- Blocker: Step 0.1 names `tsconfig.json`, while `repo-structure.md` names `tsconfig.base.json` as the root shared config.
- Why it matters: later packages need a single inheritance pattern for workspace typecheck.
- Safe default used: both files were created, with `tsconfig.json` extending `tsconfig.base.json`.
- Follow-up needed: document the dual-file pattern explicitly.

### 3. Workspace package ambiguity for the Next app
- Blocker: `repo-structure.md` says `pnpm-workspace.yaml` should include `app`, but the repo layout and Step 0.1 define the Next app through the root package with an `app/` directory, not an `app/package.json` workspace.
- Why it matters: adding `app` to the workspace would require a second package boundary that the current docs do not consistently define.
- Safe default used: the root package owns the Next app; `pnpm-workspace.yaml` includes `packages/*` and `worker-browser` only.
- Follow-up needed: clarify whether the app is a root package or a separate workspace package.

### 4. Dashboard route-group ambiguity
- Blocker: `repo-structure.md` places dashboard pages under `app/(dashboard)`, but a page at `app/(dashboard)/page.tsx` would collide with `app/page.tsx` in Next route-group semantics.
- Why it matters: the documented shell cannot be scaffolded literally without a routing conflict.
- Safe default used: user-facing dashboard routes were scaffolded under `app/dashboard/*`.
- Follow-up needed: decide whether the dashboard should be a route group with only nested segments or a concrete `/dashboard` segment.

## Pivot Notes

### 5. Hosted-first sequencing drift
- Blocker: several planning docs originally treated hosted auth, durable workflow infra, deployment wiring, and portal setup as prerequisites ahead of onboarding memory.
- Why it matters: that sequence would delay the first useful local operator slice behind product-surface work.
- Safe default used: reordered the docs so onboarding-memory is the first executable block and hosted/public-product work is later or optional.
- Follow-up needed: keep later task additions aligned to the new execution order instead of reintroducing hosted blockers.

### 6. Onboarding state ownership ambiguity
- Blocker: onboarding semantics were split between draft ingestion, story verification, attestation, and completion across multiple docs.
- Why it matters: without one consistent state model, `attested_at`, `verified_by_user`, and `onboarding.complete` could drift.
- Safe default used: ingestion writes draft revision data only, story generation writes unverified candidates, attestation is explicit, and `onboarding.complete` emits only after verification plus attestation.
- Follow-up needed: keep future approval and writing work aligned to this state model.

### 7. Local trigger surface gap
- Blocker: the repo had workflow and agent placeholders but no clear local-first trigger path for the onboarding-memory slice.
- Why it matters: without a thin local execution surface, implementation pressure would drift back to UI or auth work.
- Safe default used: treat `packages/workflows/client.ts` and `/scripts` as the intended next local execution surfaces instead of expanding frontend work now.
- Follow-up needed: ~~add a thin runnable local harness for the onboarding-memory flow.~~ Resolved by `scripts/run-onboarding.ts` + `fixtures/seeds/onboarding-sample.json`. Invoke with `pnpm run:onboarding`.

### 8. TypeScript runner choice for local scripts
- Blocker: the repo has strict TS with extensionless intra-package imports; Node 24's built-in type stripping does not resolve those without bundler-style module resolution, so a runner is needed for `/scripts` to be usable locally.
- Why it matters: without a runner, the onboarding harness cannot execute and the local-first surface required by `implementation-sequence.md` §0.7 stays aspirational.
- Safe default used: added `tsx` as a single dev dependency and wired `pnpm run:onboarding`; no build step, no bundler, no parallel runtime. Kept the harness as a plain TS script that imports `packages/workflows/client.ts` directly.
- Follow-up needed: if a second local runner is ever adopted (e.g., `node --experimental-strip-types` with explicit `.ts` extensions), consolidate on one and update this note.

## WritingAgent Slice Notes

### 9. Drafter is deterministic; LLM critic/drafter deliberately deferred
- Blocker: `agents.md §4.13` describes a draft→critic→fact-check→style-check loop using Opus (drafter) + Sonnet (critic). The first cut of the writing slice ships without any LLM calls.
- Why it matters: an LLM drafter cannot satisfy CLAUDE.md §8 invariant 11 ("every verifiable claim maps to story bank / profile field") without a deterministic grounding layer underneath it.
- Safe default used: drafter is template-based and emits `Claim` objects with explicit `refs[]`; critic + grounding + style checks are deterministic and examine the claim graph rather than the prose. Every verifiable claim must resolve to a real DB row (attested profile field, verified story, source document) or an evidence-backed external entity (program/funding/person_role/professional_profile/university).
- Follow-up needed: a later block can layer an LLM personalization pass on top of the deterministic skeleton without weakening grounding — the LLM can only rewrite `text` on existing `Claim`s whose `refs[]` already resolve.

### 10. Resume tailoring deliberately fails the prose style check
- Blocker: the deterministic style check (`packages/writing/style.ts`) compares draft mean sentence length to the voice anchor's (~18 words/sentence). Resume tailoring output is structured bullets (mean ~9 words/sentence) so it legitimately trips `sentence_length_delta` and `first_person_ratio` thresholds.
- Why it matters: the current `readiness` enum reports `style_failed` for a tailored-resume scaffold that is actually correct, which could be confusing later.
- Safe default used: kept the style check uniform across document types for this block; the harness prints `readiness=style_failed` for resume tailoring and saves the artifact anyway. The claim graph + grounding are still correct and verified.
- Follow-up needed: when the resume-tailoring block becomes its own slice, either (a) skip the prose style check for `resume_tailoring`, (b) introduce a bulleted-style voice sub-anchor, or (c) move resume rendering into a separate artifact type outside the prose WritingReadiness.

### 11. Word-limit enforcement on templated short answers
- Blocker: the short-answer template emits a fixed structure (voice line + focus + program hook + story summary + story proof + motivation + closing). On a 150-word limit prompt it currently overshoots (~167 words).
- Why it matters: `critic.ts` flags word-limit overflow as a `block`-severity note, which correctly halts readiness, but there is no template-level shortening path yet — the user has to rewrite.
- Safe default used: critic hard-blocks `ready` when word_limit is exceeded; harness reports `needs_user_input` with the exact count. No silent truncation (CLAUDE.md §8 invariant 6).
- Follow-up needed: add a template-local "tighten" pass that drops optional claim slots (e.g., `body_motivation`, `opening_focus`) in declared priority order until the word count fits, then re-runs the loop. Keep it deterministic.

### 12. Writing slice does not send, submit, or persist to external systems
- Blocker: `agents.md §4.13` and `§4.16` allow the writing + outreach agents to prepare messages, never to send them.
- Why it matters: any ambiguity here risks violating CLAUDE.md §8 invariants 1–3 (no auto-submit / auto-pay / auto-send).
- Safe default used: `runLocalWritingCycle` emits only local events and returns in-memory `WritingArtifact[]`; the harness writes artifacts to `out/writing/*.md` + `.json` only. No email, no portal, no network fetch.
- Follow-up needed: when an approval-queue slice lands, `writing.artifact.ready` is the event that should enqueue a user approval — not any external side effect.

### 13. Application prep uses a deterministic checklist, not the canonical `requirement_set`
- Blocker: `data-model.md §5.8` defines `requirement_set` as a versioned, evidence-backed table populated by the (deferred) `RequirementsExtractionAgent`. That table is not yet built.
- Why it matters: packet readiness ultimately must be judged against real per-program requirements (GRE policy, LoR count, SOP required, essay prompts, portfolio). Running without that table risks false "ready_for_review".
- Safe default used: `packages/application/checklist.ts` derives a conservative default requirement set (SOP, tailored resume, transcript, ~3 LoR, test-score placeholder, fee/waiver, optional personal statement; plus a funding-driven cover letter). Items that can only come from a real `requirement_set` (GPA floor, GRE policy, explicit essay prompts, portfolio) are intentionally not evaluated here; they will land when `RequirementsExtractionAgent` does. The checklist is transparent about origin (`program_default`/`funding_default`/`user_default`) so the user can see what came from an extracted requirement vs. a conservative default.
- Follow-up needed: when `requirement_set` rows exist, swap `baseRequirementSpecs` for a loader that combines program-default scaffolding with evidence-backed extracted requirements and attaches an `origin: "program_evidence"` to each.

### 14. Fee / waiver / test-score state has no DB home yet
- Blocker: required checklist items like `application_fee_or_waiver` and `test_score_report` need a profile-level place to live (user attests "I will pay", or "I have a waiver", or attaches a score report).
- Why it matters: without that, every packet ends up `blocked` on these items even when the user has resolved them manually, which is noisy.
- Safe default used: the checklist marks both as `needs_user_input` until they surface on the revision as either source documents (`test_report`) or attested profile fields. `application_fee_or_waiver` has no source-document kind; the item stays `needs_user_input` and generates a `missing_input` approval. No silent "assume paid" behavior.
- Follow-up needed: a small `profile_field` schema addition (`application_fee_plan`: `{waiver | paid | pending}`) or a dedicated `fee_policy_status` row per (program, user) is the natural next move. Test-score attachment belongs as a new `source_document.kind` (`test_report` already exists in the enum — just need onboarding to accept it).

### 15. Application prep does NOT persist `application`, `application_artifact`, or `approval_request` rows yet
- Blocker: `data-model.md §6.1–6.4` model these as canonical tables. `packages/db/schema.ts` does not yet include them.
- Why it matters: the approval queue is ultimately a persisted, user-navigable surface (agents.md §4.17). Holding queue state only in-memory would be wrong once hosted auth and the dashboard land.
- Safe default used: for this preparation block, packets and approval items are returned as in-memory values by `runLocalApplicationPrep` and written as JSON/MD artifacts under `out/application-prep/`. This matches how `runLocalWritingCycle` returns its artifacts. Everything the queue needs to persist later is captured in typed structures (`ApplicationPacket`, `ApprovalItem`) that map 1:1 onto the data-model.md columns.
- Follow-up needed: when the approval-resolution workflow (roadmap Phase 5) lands, add `application`, `applicationArtifact`, and `approvalRequest` to `packages/db/schema.ts` and write packets + queue items through `dbClient.insert` from `runLocalApplicationPrep`.

### 16. Application prep approval queue intentionally excludes side-effect action types
- Blocker: `data-model.md §6.4` enumerates side-effect action types (`submit_application`, `pay_fee`, `send_email`, `send_linkedin_msg`, `request_recommender`, `approve_outreach`) — these belong behind the approval queue, but only once the component that would perform the side effect exists.
- Why it matters: emitting a `submit_application` approval now would be dishonest UX — there is nothing downstream that would actually submit even if the user clicked approve.
- Safe default used: this slice emits only non-side-effect action types: `approve_draft`, `edit_required`, `missing_input`, `ready_for_submission`. The `ready_for_submission` item is explicitly named to make it clear nothing is being submitted: it represents "user confirms packet is assembled", not "system should now submit".
- Follow-up needed: browser automation (`ApplicationExecutionAgent`) and outreach sending (`OutreachStrategyAgent`) blocks each land their own approval action types (`submit_application`, `approve_outreach`, etc.) with idempotency keys per data-model.md §6.6 when those slices exist.

## Approval Resolution + Persistence Notes

### 17. Persistence lives on the in-memory Map client, not a real DB engine
- Blocker: `architecture.md` targets Postgres via Drizzle; `packages/db/client.ts` is still a typed `Map<string, Record>` store (the onboarding/research/writing blocks all wrote against it). This block adds three new canonical tables (`application`, `applicationArtifact`, `approvalRequest`) per `data-model.md §6.1–6.4`, but they live on the same Map client, not on Postgres.
- Why it matters: "persistence" here means `TableRecordMap` + typed queries — it survives the test harness inside one process and is round-trippable via `dbClient.snapshot()`, but it does *not* survive process restart by itself. That is still a correct scaffolding step (the queries, ids, timestamps, and invariants are all real) but the claim "the system survives restart" is only true once a snapshot is rehydrated into a fresh client.
- Safe default used: all writes go through `applicationQueries`, `applicationArtifactQueries`, `approvalQueries`. Every record uses the same `TimestampedRecord` shape and id generator as the existing tables. The harness persists `dbClient.snapshot()` to `out/approval-cycle/snapshot__*.json` to demonstrate round-trip integrity without implying we have a Postgres engine underneath.
- Follow-up needed: when Drizzle + Postgres land, swap the Map client for a real engine; the query modules are already the indirection layer, so agents and workflows don't need to change. At that point, drop the snapshot-to-JSON demo in favor of actual persistence between runs.

### 18. `ready_for_submission` approvals are guarded by explicit blocking siblings
- Blocker: `data-model.md §6.4` allows a `ready_for_submission` `approvalRequest` to exist alongside per-artifact `approve_draft`/`edit_required`/`missing_input` requests. Without a guard, the user could resolve `ready_for_submission` first and produce a false "packet is ready" state while other artifact decisions are still pending.
- Why it matters: this is a direct CLAUDE.md §8 invariant-6 surface — any silent "ready" transition past unresolved approvals is exactly the kind of fake completion state the system must not produce.
- Safe default used: `runLocalApplicationPrep` assigns every other pending approval on the same application as a `blockingSiblings` list on the `ready_for_submission` row. `packages/approvals/resolver.ts::enforceBlockingSiblings` rejects any `resolveApproval` call on a `ready_for_submission` whose blocking siblings are still `pending`, with a structured `ApprovalResolutionError` (`code: "blocking_siblings_pending"`). The application-level `derivedApplicationStatus` similarly refuses to transition to `ready_for_user_submission` until the `ready_for_submission` approval itself is `approved` *and* every other non-skipped request is decided.
- Follow-up needed: when the submission-execution slice (`ApplicationExecutionAgent`) lands, this same blocking-siblings pattern should gate the new `submit_application` action type as well; it should never be resolvable while any `approve_draft`/`missing_input` is still pending.

### 19. `missing_input` resolution clears the approval but does not yet refresh the checklist snapshot
- Blocker: the `ChecklistItem[]` stored on `ApplicationRecord.checklistJson` is a point-in-time snapshot generated from the revision + source documents at packet-build time. Resolving a `missing_input` approval (e.g., "user attests they have a fee waiver") clears the approval but does not rewrite the checklist item's `status` from `needs_user_input` → `completed`, because the underlying profile/source-document state that the checklist reads from has not actually changed.
- Why it matters: the harness run correctly shows both packets staying in `awaiting_user` even after a `missing_input` is approved, because no `ready_for_submission` approval was ever generated (packets were `blocked` at build time). That is the honest behavior — nothing silently flips to "ready" just because an approval was clicked — but it means approval-only resolution cannot by itself drive a blocked packet to `ready_for_user_submission`.
- Safe default used: resolution updates only the `approvalRequest` and (where applicable) the target `applicationArtifact.status` — never the checklist row or the underlying profile/source-document state. The `ApprovalResolutionResult.notes` field records the user's attestation text so the trail is preserved.
- Follow-up needed: add a "checklist refresh" step that, after every `missing_input` resolution, re-evaluates the relevant `ChecklistItem` against the current revision + source documents (and new profile-field extensions like `application_fee_plan`, see Note 14). That refresh can be triggered off the `approval.decided` event. Packet rebuild should emit a new `ApplicationPacket` revision rather than mutating the stored checklist snapshot in place.

### 20. Workflow resume is in-process and event-driven; no external queue, no scheduler
- Blocker: `BLUEPRINT.md §10` and `architecture.md` describe Inngest as the eventual durable workflow engine. This block adds `approval.decided`, `application.status.changed`, and `application.resumed` events, but they are only emitted into the existing in-process `WorkflowEventMap` sink, not to a durable queue.
- Why it matters: "resume" currently means `snapshotApplication` reconstructs derived state purely from persisted records — that is the correct shape for a durable workflow later (it proves the state machine is a pure function of the stored tables), but nothing today will automatically wake a paused workflow when an approval is resolved.
- Safe default used: `packages/approvals/resume.ts` exposes `snapshotApplication` (pure state reconstruction) and `resumeApplication` (snapshot + `application.resumed` event). `resolveApproval` already emits `approval.decided` and `application.status.changed` on every transition. The harness demonstrates "the next run sees the same state" by re-reading the same `dbClient` and rebuilding snapshots from persisted rows. No component is doing background scheduling, polling, or re-dispatching.
- Follow-up needed: when Inngest lands, wire `approval.decided` as the wake-up trigger for a durable `coordinator` workflow. The resume logic itself should not change — `snapshotApplication` is already the source of truth for "where does this application continue from". Also add deadline-driven resumes (agents.md §4.18 `DeadlineMonitorAgent`) as a second wake-up source.
