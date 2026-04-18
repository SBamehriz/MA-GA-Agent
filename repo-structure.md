# repo-structure.md — MVP Repository Layout

> The exact folder/file layout for the MA-GA-Agent monorepo. Concrete enough to scaffold from directly.
>
> Source: [CLAUDE.md](CLAUDE.md), [plan.md §2](plan.md), [architecture.md](architecture.md). Owner alignment: [agents.md](agents.md).
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Monorepo Principles

- **Single pnpm workspace.** One `package.json` at the root; per-package `package.json` in each `/packages/*` and in `/worker-browser`.
- **App is thin.** `/app` contains UI and Route Handlers only; all business logic lives in `/packages/*`.
- **No cross-package cycles.** Enforced by `madge` or `eslint-plugin-boundaries`.
- **Boundary = contract.** Each package exports a `index.ts` barrel; cross-package imports go only through the barrel.
- **Browser worker is a separate deployable**, not a package, because its runtime (Node + Chromium) differs from the Next.js runtime.
- **Docs live in `/` (not `/docs`).** The docs are the source of truth and are edited more often than code during the planning phase.

---

## 2. Top-Level Layout

```
ma-ga-agent/
├── app/                         # Next.js 16 App Router
├── packages/
│   ├── db/
│   ├── shared/
│   ├── evidence/
│   ├── crawlers/
│   ├── extractors/
│   ├── classifiers/
│   ├── agents/
│   ├── workflows/
│   ├── writing/
│   ├── contacts/
│   ├── portal-adapters/
│   ├── approvals/
│   └── ui/
├── worker-browser/              # Fly.io / Hetzner VM deployable
├── scripts/
├── fixtures/
│   ├── golden/
│   └── seeds/
├── .github/workflows/
├── BLUEPRINT.md
├── CLAUDE.md
├── plan.md
├── architecture.md
├── agents.md
├── data-model.md
├── mvp.md
├── roadmap.md
├── risks.md
├── implementation-sequence.md
├── repo-structure.md
├── schemas.md
├── workflows.md
├── api-spec.md
├── agent-prompts.md
├── task-breakdown.md
├── vercel.ts
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── .editorconfig
└── README.md
```

---

## 3. `/app` — Next.js 16 App Router

Thin UI + Route Handlers only. No business logic.

```
app/
├── layout.tsx                        # Clerk provider, theme, globals
├── page.tsx                          # Redirect to /dashboard or /sign-in
├── middleware.ts                     # Clerk auth gate
├── instrumentation.ts                # OTel init
│
├── (auth)/
│   ├── sign-in/page.tsx
│   └── sign-up/page.tsx              # disabled in MVP (single-tenant)
│
├── (onboarding)/
│   ├── layout.tsx
│   ├── session-1/page.tsx            # identity + academics + targets
│   ├── session-2/page.tsx            # story interview
│   ├── session-3/page.tsx            # preferences + recommenders + vault
│   └── attest/page.tsx               # attestation gate
│
├── (dashboard)/
│   ├── layout.tsx
│   ├── page.tsx                      # overview
│   ├── programs/
│   │   ├── page.tsx                  # ranked list
│   │   └── [programId]/
│   │       ├── page.tsx              # program detail
│   │       ├── evidence/page.tsx
│   │       └── funding/page.tsx
│   ├── essays/
│   │   ├── page.tsx                  # essays index
│   │   └── [artifactId]/page.tsx     # review UI with inline critic notes
│   ├── applications/
│   │   ├── page.tsx
│   │   └── [applicationId]/page.tsx  # section-by-section state + submission preview
│   ├── approvals/
│   │   ├── page.tsx                  # unified approval queue
│   │   └── [approvalId]/page.tsx     # detail + decide
│   ├── contacts/
│   │   └── page.tsx                  # contact explorer (internal use)
│   ├── evidence/
│   │   ├── page.tsx
│   │   └── [subject]/page.tsx        # evidence inspector
│   └── settings/
│       └── page.tsx                  # preferences, quiet hours, vault
│
└── api/
    ├── inngest/route.ts              # Inngest webhook
    ├── approvals/
    │   ├── route.ts                  # list
    │   └── [id]/route.ts             # decide
    ├── worker/
    │   └── callback/route.ts         # Playwright worker callbacks (mTLS)
    └── webhooks/
        ├── resend/route.ts           # email reply receiver
        └── clerk/route.ts            # user events
```

**Ownership:** UI engineers own `/app/**/*.tsx` and page-specific client components. Server Actions defined inside page files import only from `/packages/*`.

**Boundary rule:** no direct DB access from a page. Always via `packages/db/queries/*` or a server action that delegates to a package.

---

## 4. `/packages/db` — Database

```
packages/db/
├── package.json
├── index.ts
├── client.ts                    # Drizzle client (pooled)
├── schema.ts                    # all tables (see schemas.md)
├── enums.ts                     # shared enums
├── migrations/
│   ├── 0001_init.sql
│   └── meta/
├── queries/
│   ├── user.ts
│   ├── university.ts
│   ├── program.ts
│   ├── fee.ts
│   ├── funding.ts
│   ├── deadline.ts
│   ├── requirement.ts
│   ├── portal.ts
│   ├── contact.ts
│   ├── application.ts
│   ├── approval.ts
│   ├── evidence.ts
│   ├── action-log.ts
│   └── idempotency.ts
├── with-evidence.ts             # evidence-mandatory insert wrapper
└── freshness.ts                 # SLA checks at query time
```

**Ownership:** Data engineer. Schema changes require Propagation Checklist updates per [CLAUDE.md §7](CLAUDE.md).

**Boundary rule:** The only package allowed to `import "drizzle-orm"` is `packages/db`. Everything else imports typed queries from the barrel.

---

## 5. `/packages/shared` — Cross-cutting utilities

```
packages/shared/
├── package.json
├── index.ts
├── env.ts                       # Zod-validated env
├── auth.ts                      # Clerk helpers
├── ai.ts                        # AI Gateway client + per-task router
├── ai-budgets.ts                # per-run token / cost caps
├── telemetry.ts                 # OTel + Sentry + Axiom
├── errors.ts                    # typed error classes
├── idempotency.ts               # key formula + ledger helpers
├── rate-limit.ts                # per-domain + per-user limiters (Upstash Redis)
├── logger.ts                    # Axiom-backed structured logger
├── worker-client.ts             # typed Playwright worker caller (mTLS)
└── redact.ts                    # PII redaction for logs
```

**Ownership:** Platform engineer. No business logic. No DB imports.

---

## 6. `/packages/evidence` — Evidence ledger

```
packages/evidence/
├── package.json
├── index.ts
├── validator.ts                 # write-time enforcement
├── source-quality.ts            # per-domain scoring
├── freshness.ts                 # SLA enforcement
├── hash.ts                      # content-hash helpers
└── supersede.ts                 # version transitions
```

**Ownership:** Platform engineer. Consumed by every extractor and agent.

---

## 7. `/packages/crawlers` — Web + PDF ingestion

```
packages/crawlers/
├── package.json
├── index.ts
├── firecrawl.ts                 # HTML → Markdown
├── tavily.ts                    # search
├── serpapi.ts                   # Google Scholar
├── pdf.ts                       # text-based PDFs
├── ocr.ts                       # image-only fallback
├── cache.ts                     # content-hash → Vercel Blob
├── budgets.ts                   # per-university caps
└── rate-limits.ts               # per-domain config
```

**Ownership:** Research/extraction engineer.

---

## 8. `/packages/extractors` — Specialized field extractors

```
packages/extractors/
├── package.json
├── index.ts
├── deadline.ts
├── fee.ts
├── tuition.ts
├── stipend.ts
├── required-documents.ts
├── essay-prompt.ts
├── schemas/
│   ├── deadline.schema.ts       # Zod + regex validators
│   ├── fee.schema.ts
│   └── …
└── post-validators/
    ├── date.ts                  # regex sanity
    ├── currency.ts
    └── enum.ts
```

**Rule (from [CLAUDE.md §10](CLAUDE.md)):** the top-5 high-stakes fields use specialized prompts; everything else uses the generic extractor. Schemas mandate `quoted_source` per [agents.md §8](agents.md).

---

## 9. `/packages/classifiers` — Deterministic classifiers

```
packages/classifiers/
├── package.json
├── index.ts
├── relevance.ts                 # core / adjacent / tangential / rejected
├── funding-taxonomy.ts          # phrase matcher, deny list
├── role-taxonomy.ts             # professor / pi / dgs / coordinator / …
├── portal-fingerprints.ts       # vendor detection
└── tables/
    ├── funding-phrases.json
    ├── role-terms.json
    └── portal-signals.json
```

**Ownership:** Extraction engineer. Rules-first; LLM is a fallback invoked from the agent, not from the classifier.

---

## 10. `/packages/agents` — Agent modules

One directory per agent. Each directory has a `contract.ts` matching [agents.md](agents.md).

```
packages/agents/
├── package.json
├── index.ts
├── university-discovery/
│   ├── contract.ts
│   ├── prompt.ts                # system prompt (see agent-prompts.md)
│   └── index.ts
├── program-qualification/
├── requirements/
├── fee-waiver/
├── funding-discovery/
├── funding-classification/
├── deadline/
├── portal-mapper/
├── contact-discovery/
├── profile-enrichment/
├── user-profile-ingestion/
├── story-bank-builder/
├── writing/
├── application-execution/
├── recommendation-coordinator/
├── outreach-strategy/
├── approval-checkpoint/
├── deadline-monitor/
└── follow-up/
```

**Boundary rule (from [agents.md §3](agents.md)):**
- Agents never call each other directly. They emit events via the Coordinator.
- Agents import tools only from the declared whitelist.
- Every agent exports a `run()` function with Zod-typed input/output.

---

## 11. `/packages/workflows` — Inngest workflows

```
packages/workflows/
├── package.json
├── index.ts
├── client.ts                    # Inngest client + signing
├── events.ts                    # typed event registry
├── coordinator.ts               # top-level cycle workflow
├── onboarding.ts
├── research-sweep.ts
├── funding-verification.ts
├── contact-discovery.ts
├── writing.ts
├── application-prep.ts
├── approval.ts                  # approval wait + resumption
├── deadline-monitor.ts
└── refresh.ts                   # scheduled freshness refreshes
```

**Rule (from [architecture.md §4.3](architecture.md)):** no agent code runs outside a step. Non-determinism is isolated to tool-call steps.

---

## 12. `/packages/writing` — Draft/critique/rewrite loop

```
packages/writing/
├── package.json
├── index.ts
├── drafter.ts                   # Opus draft
├── critic.ts                    # Sonnet critic (different prompt)
├── rewriter.ts                  # Opus rewrite
├── fact-check.ts                # deterministic claim → story/profile mapper
├── style-check.ts               # voice-anchor similarity + cliché + originality
├── prompts/
│   ├── sop.md
│   ├── ps.md
│   ├── short-answer.md
│   ├── cover-letter.md
│   └── outreach.md
├── cliche-list.ts
└── voice-anchor.ts              # embedding + similarity
```

**Rule:** factually verifiable claims without a story/profile mapping are rejected before the user sees the draft.

---

## 13. `/packages/contacts` — Contact intelligence

```
packages/contacts/
├── package.json
├── index.ts
├── discovery/
│   ├── department-directory.ts
│   ├── grad-school-directory.ts
│   ├── lab-page.ts
│   └── faculty-page.ts
├── enrichment/
│   ├── proxycurl.ts
│   ├── pdl.ts
│   └── scholar.ts
├── match-scoring.ts             # multi-signal verification
├── merge.ts                     # person-merge bookkeeping
└── outreach-policy.ts           # season/role/do-not-contact filter
```

**Rule:** direct LinkedIn scraping is forbidden ([CLAUDE.md §8.10](CLAUDE.md)). Use approved providers only.

---

## 14. `/packages/portal-adapters` — Portal drivers

```
packages/portal-adapters/
├── package.json
├── index.ts
├── interface.ts                 # PortalAdapter interface (no `submit`)
├── fingerprints.ts              # vendor detection
├── field-mapper.ts              # LLM-assisted field mapping with user confirmation
├── drift-detector.ts            # DOM hash diff
├── fee-page-detector.ts         # multi-signal
├── slate/
│   ├── adapter.ts
│   ├── selectors.ts
│   └── fingerprint.ts
├── collegenet/
├── liaison-gradcas/
├── applyweb/
└── generic/
```

**Rule:** no adapter exposes a `submit()` method. Only `prepareSubmit()` that returns a preview; actual submission is the user's proxy click resolving an approval.

---

## 15. `/packages/approvals` — Approval surface

```
packages/approvals/
├── package.json
├── index.ts
├── queue.ts                     # create/list/decide
├── builders/
│   ├── submission.ts
│   ├── fee.ts
│   ├── outreach.ts
│   ├── recommender.ts
│   ├── account-creation.ts
│   ├── field-mapping.ts
│   └── conflict.ts
├── batching.ts                  # approve-N flow
├── emergency-stop.ts
└── notifier.ts                  # email + in-app + SMS
```

**Rule:** every external side-effect emits an approval via this package and waits for a decision via Inngest `waitForEvent`.

---

## 16. `/packages/ui` — Shared React components

```
packages/ui/
├── package.json
├── index.ts
├── confidence-badge.tsx
├── evidence-snippet.tsx
├── diff-viewer.tsx
├── critic-note.tsx
├── approval-card.tsx
├── status-pill.tsx
├── freshness-badge.tsx
└── primitives/                  # shadcn/ui generated components
```

**Ownership:** UI engineer. Only pure components; no data-fetching; no server imports.

---

## 17. `/worker-browser` — Playwright worker

Separate deployable. Different Dockerfile, different runtime, different health probe.

```
worker-browser/
├── package.json
├── Dockerfile
├── fly.toml                     # or hetzner-equivalent
├── tsconfig.json
├── server.ts                    # Fastify + mTLS
├── health.ts
├── session/
│   ├── manager.ts               # persistent browser contexts
│   ├── snapshot.ts              # periodic Blob snapshots
│   └── recovery.ts              # re-auth + 2FA ping flow
├── jobs/
│   ├── prepare-submit.ts
│   ├── section-fill.ts
│   ├── account-create.ts
│   └── drift-check.ts
├── trace.ts                     # Playwright trace capture
├── adapters/                    # mirrors packages/portal-adapters for execution
│   ├── slate.ts
│   └── …
└── telemetry.ts
```

**Boundary:** the worker is **called from Inngest steps**, never from the Next.js app directly. mTLS-authenticated.

---

## 18. `/scripts` — Ops scripts

```
scripts/
├── seed-universities.ts
├── load-golden.ts
├── run-golden.ts                # regression harness
├── smoke-telemetry.ts
├── rotate-keys.ts               # vault + gateway key rotation
├── audit-action-log.ts
└── backup-restore-test.ts
```

---

## 19. `/fixtures`

```
fixtures/
├── golden/
│   ├── schema.ts                # Zod for annotation format
│   └── institutions/
│       ├── uga.json
│       ├── gatech.json
│       └── …                    # 30+ annotated institutions
└── seeds/
    ├── universities.csv         # CSRankings top-50 + mid-tier + user
    └── portal-vendors.json
```

---

## 20. `/.github/workflows` — CI

```
.github/workflows/
├── ci.yml                       # typecheck, lint, unit
├── db-migrate.yml               # migration test on ephemeral Neon branch
├── golden.yml                   # golden-set regression
├── boundaries.yml               # import-boundary enforcement
├── portal-smoke.yml             # daily synthetic portal run (staging only)
└── deploy.yml                   # Vercel + worker deploy
```

---

## 21. Root Files

| File | Purpose |
|---|---|
| `vercel.ts` | Typed Vercel project config. |
| `pnpm-workspace.yaml` | Workspace globs: `app`, `packages/*`, `worker-browser`. |
| `package.json` | Root scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `db:migrate`, `golden`). |
| `tsconfig.base.json` | Strict TS config; per-package `tsconfig.json` extends. |
| `.env.example` | Mirrors the Zod env schema; committed with no secrets. |
| `.gitignore` | Ignores `.env*`, `.next`, `node_modules`, `dist`, `.vercel`, `playwright-traces/`. |

---

## 22. Boundary Enforcement Rules

The following are enforced via ESLint rules (`eslint-plugin-boundaries`) and `madge` cycle detection:

| From | May import |
|---|---|
| `app/**` | `packages/*` (barrel only), `packages/ui` |
| `packages/db` | none (except shared types from `packages/shared`) |
| `packages/shared` | none (leaf) |
| `packages/evidence` | `packages/shared`, `packages/db` |
| `packages/extractors` | `packages/shared`, `packages/evidence`, `packages/crawlers` |
| `packages/classifiers` | `packages/shared`, `packages/evidence` |
| `packages/agents/*` | `packages/shared`, `packages/db`, `packages/evidence`, `packages/extractors`, `packages/classifiers`, `packages/crawlers`, `packages/contacts`, `packages/writing`, `packages/portal-adapters` |
| `packages/workflows` | `packages/agents/*`, `packages/shared`, `packages/db`, `packages/approvals` |
| `packages/approvals` | `packages/shared`, `packages/db` |
| `packages/portal-adapters` | `packages/shared`, `packages/evidence` |
| `packages/writing` | `packages/shared`, `packages/db`, `packages/evidence` |
| `packages/contacts` | `packages/shared`, `packages/db`, `packages/evidence`, `packages/crawlers` |
| `worker-browser` | no `packages/*` imports (mirrored code duplicated at adapter boundary) |

**Forbidden:**
- `app/**` → `drizzle-orm` directly.
- `packages/*` → `process.env.X` directly (must go through `packages/shared/env.ts`).
- Any agent → another agent's module (must go via the Coordinator event bus).
- Any module → Anthropic SDK directly (must go via `packages/shared/ai.ts`).

---

## 23. Ownership Map

| Area | Primary owner | Reviewer |
|---|---|---|
| `/app` UI | UI engineer | Product |
| `/packages/db`, `/packages/evidence` | Data engineer | Platform |
| `/packages/shared` | Platform engineer | Data |
| `/packages/crawlers`, `/packages/extractors`, `/packages/classifiers` | Extraction engineer | Research |
| `/packages/agents/*` | Agent engineer (one lead per group) | Extraction + Product |
| `/packages/workflows` | Workflow engineer | Platform |
| `/packages/writing` | Writing engineer | Product + Research |
| `/packages/portal-adapters`, `/worker-browser` | Browser automation engineer | Platform |
| `/packages/approvals` | Product engineer | UI |
| `/packages/contacts` | Research engineer | Legal/ToS reviewer |
| Docs | Project author | All contributors |

---

## 24. Missing Inputs

- Exact VM host (Fly.io vs Hetzner) — Safe default for MVP: Fly.io for region flexibility and easier CI integration.
- Vault provider (1Password vs Bitwarden) — Safe default: 1Password (Connect) with Bitwarden adapter stub behind an interface for later swap.
- Whether `packages/ui` should be a separate deployable Storybook — Safe default: local-only for MVP; Storybook deferred to post-MVP.

## Open Questions

- Do we want a `packages/typed-events` package split out from `packages/workflows` for event types used by the Next.js app? Current default: keep inside `packages/workflows/events.ts` and re-export via `packages/shared`.
- Should `app/api/worker/callback/route.ts` live in the worker repo instead? Current default: keep in Next.js app for consistent Clerk / Inngest integration; worker only *initiates* outbound callbacks to that route over mTLS.

---

*Last updated: initial creation.*
