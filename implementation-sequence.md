# implementation-sequence.md - Current Build Order

> The exact sequential order for the current implementation block. The project keeps its existing workflow architecture, but execution is now pivoted to a local-first onboarding-memory slice before discovery, writing, approvals, or browser automation.
>
> Source of truth: [CLAUDE.md](CLAUDE.md), [plan.md](plan.md), [architecture.md](architecture.md), [workflows.md](workflows.md), [agents.md](agents.md), [data-model.md](data-model.md).
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 0. How to Use This File

- Execute steps in order.
- Do not pull auth, dashboard, notifications, portal automation, or hosted deployment work into this block unless a documented blocker proves it is unavoidable.
- Every step should preserve the current scaffold instead of replacing it.
- If a step uncovers a contradiction, record it explicitly and choose the safest local-first default.

---

## 1. Current Delivery Target

Build the onboarding-memory slice first.

This block must deliver:
- one local `user_profile_revision`
- onboarding answer ingestion
- source-document tracking for resume, transcript, and related materials
- story generation with source references
- `verified_by_user` flow
- voice-anchor record
- `onboarding.complete` only after verification and attestation

This block explicitly excludes:
- auth expansion
- dashboard expansion
- notifications
- portal automation
- hosted deployment dependencies

---

## 2. Phase 0 - Local-First Onboarding Foundations

Exit criteria:
- Typed onboarding workflow events exist and are usable locally.
- Onboarding completion is blocked until verification plus attestation are complete.
- The onboarding slice can run without requiring hosted orchestration or a remote approval system.

### Step 0.1 - Preserve scaffold, narrow the active surface

- Goal: keep the current repo and package layout, but treat `packages/workflows`, `packages/db`, and the onboarding-memory packages as the active surface.
- Dependencies: none.
- Touched areas:
  - current workspace scaffold
  - workflow package
  - data/model packages used by onboarding
- Acceptance criteria:
  - No useful package or workflow boundary is deleted.
  - Auth, dashboard, notification, and portal packages may remain present but inactive.

### Step 0.2 - Typed onboarding event contract

- Goal: define the typed event surface for local onboarding progression.
- Dependencies: 0.1.
- Touched files/modules:
  - `packages/workflows/events.ts`
  - `packages/workflows/onboarding.ts`
  - `workflows.md`
- Acceptance criteria:
  - The onboarding workflow has explicit typed events for source documents, answers ingestion, story drafting, story verification, voice-anchor recording, attestation, and completion.
  - `onboarding.complete` cannot be emitted before verification plus attestation.
  - Event handling is deterministic and revision-scoped.

### Step 0.3 - Local onboarding-memory persistence

- Goal: persist one draft profile revision and the source materials needed to support later writing.
- Dependencies: 0.2.
- Touched files/modules:
  - `packages/db/schema.ts`
  - `packages/db/client.ts`
  - `packages/db/queries/user.ts`
  - `packages/db/queries/evidence.ts`
  - related onboarding-memory model files
- Acceptance criteria:
  - One local `user_profile_revision` can be created without any hosted dependency.
  - Resume, transcript, and supplemental materials can be tracked as source documents for the revision.
  - Draft profile fields can exist before attestation, and attested state is explicit.

### Step 0.4 - Onboarding answers ingestion

- Goal: ingest structured onboarding answers into the draft revision.
- Dependencies: 0.3.
- Touched files/modules:
  - onboarding ingestion agent/model code
  - local runner or scripts used to feed onboarding answers
- Acceptance criteria:
  - Structured onboarding answers persist into the draft revision.
  - Missing critical fields remain explicit rather than silently guessed.
  - The workflow records that answer ingestion occurred before completion is considered.

### Step 0.5 - Story and voice memory scaffolding

- Goal: generate story candidates with source references and record a reusable voice anchor.
- Dependencies: 0.4.
- Touched files/modules:
  - story-bank builder package
  - voice-anchor storage/model code
  - onboarding workflow state handling
- Acceptance criteria:
  - Story rows can be created with source references.
  - Stories are unusable downstream until `verified_by_user = true`.
  - A voice-anchor record can be saved against the revision.

### Step 0.6 - Verification and attestation gate

- Goal: enforce that onboarding only completes after stories are verified and the revision is attested.
- Dependencies: 0.5.
- Touched files/modules:
  - `packages/workflows/onboarding.ts`
  - any onboarding verification helpers
- Acceptance criteria:
  - Attestation is blocked while required source documents, verified stories, or voice anchor are missing.
  - `onboarding.complete` is emitted only after attestation succeeds.
  - No notification queue or dashboard approval flow is required for this gate.

### Step 0.7 - Thin local execution surface

- Goal: make the slice runnable without building product UI.
- Dependencies: 0.6.
- Touched files/modules:
  - local script or test harness
  - optional minimal onboarding trigger surface if one already exists
- Acceptance criteria:
  - A developer can run the onboarding-memory flow locally end-to-end.
  - The flow does not require auth wiring, remote job infrastructure, or portal adapters.

---

## 3. Phase 0 Exit Gate

All of the following must be true before moving on:

1. A local onboarding revision can be created and progressed with typed events.
2. Resume and transcript registration are enforced before attestation.
3. At least one story must be user-verified before completion.
4. A voice-anchor record exists before completion.
5. `onboarding.complete` is impossible without final attestation.
6. The slice runs locally without auth expansion, dashboard expansion, notifications, portal automation, or hosted deployment requirements.

---

## 4. Next Phases After This Exit Gate

Do not start these until Phase 0 is stable:

1. Program, funding, and contact discovery.
2. Writing and resume tailoring.
3. Application preparation and checklist generation.
4. Approval-based automation support.
5. Browser automation.

Each later phase must consume the onboarding-memory outputs created here rather than re-introducing onboarding assumptions ad hoc.

---

## Open Questions

- Should the first local execution surface be a script, tests, or a very thin onboarding page?
  - Safe default: a local script or test harness first.
- Should `research.cycle.started` fire automatically at the end of onboarding in the first block?
  - Safe default: keep `onboarding.complete` as the boundary event and start research manually until discovery is implemented.

---

## Propagation Checklist

- Checked [workflows.md](workflows.md) so the documented workflow state machine matches this step order.
- Checked `packages/workflows/events.ts` and `packages/workflows/onboarding.ts` so the implementation contract matches the build sequence.
- Deferred auth, dashboard, notifications, portal automation, and hosted deployment work explicitly instead of deleting those structures.
