# task-breakdown.md - Engineering Task Breakdown

> Actionable task list for the corrected local-first implementation order.
> Source: [CLAUDE.md](CLAUDE.md), [plan.md](plan.md), [roadmap.md](roadmap.md), [implementation-sequence.md](implementation-sequence.md).

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 0. Priority Legend

- `P0` - current blocking work
- `P1` - next in sequence
- `P2` - important later work
- `P3` - parked until clearly needed

---

## 1. Current Execution Order

1. onboarding and deep user profile memory
2. program / funding / contact discovery
3. writing and resume tailoring
4. application preparation and checklist generation
5. approval-based automation support
6. browser automation later

This file keeps the earlier scaffold intact, but task priority now follows this order.

---

## 2. Current P0 Tasks

### MEM-01 - Local user and profile revision model

- Description: support one local user, draft profile revisions, revision attestation, and active revision selection.
- Depends on: existing scaffold only.
- Done when: one revision can move from draft to attested locally.

### MEM-02 - Source-document tracking

- Description: track resume, transcript, writing sample, and related onboarding materials with revision links and provenance.
- Depends on: `MEM-01`.
- Done when: source materials are queryable from the active revision.

### MEM-03 - Onboarding-answer ingestion

- Description: ingest structured onboarding answers into the draft revision without silent guessing.
- Depends on: `MEM-01`, `MEM-02`.
- Done when: required fields can be marked draft / needs_review / attested.

### MEM-04 - Story drafting and verification

- Description: build story candidates with source references and explicit `verified_by_user` state.
- Depends on: `MEM-02`, `MEM-03`.
- Done when: at least one verified story can exist for a revision.

### MEM-05 - Voice-anchor record

- Description: capture and store a usable voice anchor for later writing.
- Depends on: `MEM-03`.
- Done when: writing readiness can check for a ready voice anchor.

### MEM-06 - Onboarding workflow gating

- Description: typed onboarding events and local workflow state machine with completion blockers.
- Depends on: `MEM-01` through `MEM-05`.
- Done when: `onboarding.complete` is impossible before verification and attestation.

---

## 3. P1 Tasks

### DISC-01 - University seeding and qualification

- Description: seed the initial target list and qualify AI-relevant programs.
- Depends on: Phase 0 onboarding-memory exit.

### DISC-02 - Funding and contact discovery

- Description: discover funding opportunities, classify them, and resolve relevant people/roles.
- Depends on: `DISC-01`.

### WRITE-01 - Grounded writing loop

- Description: implement draft / critique / rewrite with fact-check against verified stories and profile fields.
- Depends on: onboarding-memory exit and initial discovery outputs.

### WRITE-02 - Resume tailoring

- Description: generate program-aware resume/CV variants from the same verified memory layer.
- Depends on: `WRITE-01`.

### PREP-01 - Packet and checklist generation

- Description: assemble per-program application packets and explicit blocker checklists.
- Depends on: discovery and writing outputs.

### APPROVAL-01 - Approval records and pause/resume helpers

- Description: formalize approval objects and resumable risky-action boundaries.
- Depends on: preparation outputs and workflow boundaries.

---

## 4. P2 Tasks

### DISC-03 - Golden-set regression and freshness helpers

- Description: harden extraction and freshness once discovery is active.

### APPROVAL-02 - Batch approvals and emergency stop

- Description: expand approval ergonomics and stop/resume support.

### AUTO-01 - Portal adapter interface

- Description: preserve and then activate browser automation boundaries after preparation is already useful.

### AUTO-02 - First real portal integration

- Description: implement one vendor adapter end-to-end to the submit gate.

---

## 5. P3 Tasks

These stay in the repo but are not current drivers:

- hosted auth expansion
- dashboard breadth and polish
- notification delivery
- worker deployment hardening
- multi-environment deployment work
- browser-automation scale work

---

## 6. Rule for Using This File

Do not pull a P2 or P3 task forward unless a documented blocker proves the current slice cannot progress without it.
