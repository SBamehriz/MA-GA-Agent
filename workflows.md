# workflows.md - Local-First Workflow State Machines

> Explicit stepwise flows for the current implementation direction. The architecture stays workflow-driven and event-based, but the first shipped block is local-first onboarding memory, not hosted orchestration, not dashboard expansion, and not browser automation.
>
> Source: [CLAUDE.md](CLAUDE.md), [BLUEPRINT.md](BLUEPRINT.md), [architecture.md](architecture.md), [agents.md](agents.md), [implementation-sequence.md](implementation-sequence.md).
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Workflow Conventions

- The workflow boundary remains the same: versioned workflows consume typed events from `packages/workflows/events.ts`; agents still do not call each other directly.
- The first implementation block runs locally. A script, test harness, or thin local operator surface may emit workflow events. No hosted workflow engine is required to make progress.
- `onboarding.complete` is a guarded event. It is invalid until onboarding answers are ingested, required source documents are registered, stories are drafted and user-verified, a voice anchor exists, and the profile revision is attested.
- Approval architecture stays in the design, but the first block uses direct local verification/attestation instead of a notification queue, dashboard, or remote approval transport.
- No auth expansion, dashboard expansion, notification fan-out, portal automation, or hosted deployment dependency is part of this block.
- Research, writing, approvals, and portal-driving workflows remain in the system design, but they are deferred until the onboarding-memory slice is stable.

---

## 2. Workflow Inventory

| Workflow | Current status | Primary trigger |
|---|---|---|
| `onboarding` | Implement now | Local runner emits `onboarding.started` for a new profile revision |
| `research-sweep` | Deferred after onboarding slice | Manual/local trigger after `onboarding.complete` |
| `funding-verification` | Deferred | `funding.discovered` |
| `contact-discovery` | Deferred | `program.qualified` |
| `writing` | Deferred | User requests drafting after verified onboarding memory exists |
| `application-prep` | Deferred | Prepared materials plus checklist readiness |
| `approval-resolution` | Deferred | Explicit approval queue eventing, later |
| `deadline-monitor` | Deferred | Later scheduled refresh layer |
| `refresh` | Deferred | Later freshness refresh layer |

Only `onboarding` is active in the first implementation block. The rest are preserved as workflow boundaries so the repo does not lose its architecture.

---

## 3. Onboarding Workflow

### 3.1 Trigger

- `onboarding.started` from a local script, test harness, or thin local operator surface when there is no attested active profile revision for the user.

### 3.2 State Machine

```text
idle
  -> collecting_profile_material
  -> profile_draft_saved
  -> stories_verification_pending
  -> stories_verified
  -> voice_anchor_recorded
  -> attestation_pending
  -> attested
  -> complete
```

Notes:
- `stories_verified` requires `verified_story_count >= 1`.
- `attestation_pending` only exists after required source documents, onboarding answers, a saved profile draft, verified stories, and a voice anchor all exist.
- `complete` can only be emitted after `attested`.

### 3.3 Required Events

| Event | Purpose |
|---|---|
| `onboarding.started` | Open a new local onboarding revision |
| `onboarding.documents.registered` | Register resume, transcript, and optional supplemental materials |
| `onboarding.answers.ingested` | Record that structured onboarding answers were parsed into the draft revision |
| `onboarding.profile.draft-saved` | Confirm the local draft revision exists |
| `onboarding.stories.drafted` | Record candidate story generation |
| `onboarding.stories.verified` | Record user verification of story rows |
| `onboarding.voice-anchor.recorded` | Attach the voice-anchor record needed by later writing |
| `onboarding.attested` | Final user attestation on the revision |
| `onboarding.complete` | Final boundary event emitted only after all prior gates are satisfied |

### 3.4 Steps

1. `register_source_documents`
   - Track resume, transcript, and optional supplemental materials as source documents tied to the active revision.
   - This is a local persistence step, not an auth or upload-product project.
2. `ingest_onboarding_answers`
   - Parse structured onboarding answers into a draft profile revision.
   - Persist draft fields as draft or attested-later data; do not mark the revision active yet.
3. `save_profile_draft`
   - Persist one local `user_profile_revision`.
   - The revision stays incomplete until user verification finishes.
4. `draft_stories`
   - Generate story candidates with source references back to onboarding answers and uploaded materials.
   - These stories are not usable downstream until user-verified.
5. `verify_stories`
   - User confirms, edits, or rejects stories.
   - At least one story must be marked `verified_by_user = true` before completion is possible.
6. `record_voice_anchor`
   - Save the voice-anchor record required by later writing and resume tailoring.
7. `attest_revision`
   - Local user attestation confirms the revision is ready for downstream use.
   - This is the current block's human gate; it does not require notifications or an approval queue yet.
8. `emit_onboarding_complete`
   - Emit `onboarding.complete` only if all blockers are cleared.
   - This event becomes the handoff boundary for later research kickoff.

### 3.5 Outputs

- One local `user_profile_revision` draft promoted to attested status.
- Registered source-document records for resume, transcript, and optional related materials.
- Story rows with source references and explicit `verified_by_user` status.
- One `voice_anchor` record.
- A valid `onboarding.complete` event only after verification plus attestation.

### 3.6 Failure Handling

- Missing required source documents blocks attestation.
- Missing or zero verified stories blocks attestation.
- Missing voice anchor blocks attestation.
- If the workflow is interrupted, the draft revision remains resumable locally; no auth/session machinery is required for the first block.
- If a later event arrives for the wrong revision, the workflow rejects it loudly rather than silently re-binding state.

### 3.7 Approval and Verification Boundary

- There is no notification workflow in this block.
- There is no dashboard approval queue in this block.
- The only required human gate is direct local verification of stories plus final attestation of the revision.
- Approval-based automation support remains part of the architecture, but it starts after onboarding memory is reliable.

---

## 4. Research Sweep Workflow Boundary

Status: deferred until the onboarding-memory slice exits cleanly.

The design still stands:
- `onboarding.complete` is the upstream boundary event.
- `research.cycle.started` remains the entry point for program, funding, and contact discovery.
- The first trigger should be manual/local, not cron-driven and not deployment-dependent.

What is explicitly not in the current block:
- daily cron scheduling
- dashboard notifications
- hosted event transport requirements
- portal mapping or application execution

---

## 5. Later Workflows Preserved but Deferred

These workflows remain part of the structure and should not be deleted, but they are not implementation targets for the current block:

- `funding-verification`
  - runs after funding discovery exists
- `contact-discovery`
  - runs after program qualification exists
- `writing`
  - consumes only attested profile fields, verified stories, and voice anchor data
- `application-prep`
  - prepares packets and checklists before any portal automation
- `approval-resolution`
  - formal queueing and approval replay, later
- `deadline-monitor`
  - refresh and urgency later
- `refresh`
  - freshness enforcement later

---

## 6. Current Non-Goals

The first workflow slice does not include:

- sign-in or auth expansion
- dashboard or frontend-heavy onboarding work
- notification channels
- remote approval delivery
- portal automation
- hosted orchestration requirements

If any implementation step for onboarding depends on one of those, that is a blocker in the plan, not a reason to expand scope.

---

## Propagation Checklist

- Checked [implementation-sequence.md](implementation-sequence.md) to keep the step order aligned with this workflow boundary.
- Checked `packages/workflows/events.ts` and `packages/workflows/onboarding.ts` so the docs match the typed onboarding event contract.
- Left later workflow boundaries intact so downstream docs and packages do not lose their architectural shape.
