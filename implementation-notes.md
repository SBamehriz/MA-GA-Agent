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
- Follow-up needed: add a thin runnable local harness for the onboarding-memory flow.
