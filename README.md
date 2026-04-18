# MA-GA-Agent

Local-first personal admissions and funding agent for one user.

Current direction:
- onboarding-memory is the first active implementation slice
- discovery, writing, and application preparation come next
- approval support comes before browser automation
- hosted auth, dashboard breadth, and deployment plumbing are preserved but not current blockers

Implemented now:
- local onboarding-memory schema/query scaffolding
- typed onboarding workflow events and completion gating
- story verification and voice-anchor readiness support
- a local workflow client that ties ingestion, story memory, and onboarding completion together

Start with the root planning docs, especially `CLAUDE.md`, `plan.md`, `implementation-sequence.md`, and `workflows.md`.
