# architecture.md — System Architecture

> Stack, layers, deployment, and cross-cutting concerns for MA-GA-Agent.
> Source: [BLUEPRINT.md §3, §10](BLUEPRINT.md). Agents: [agents.md](agents.md). Data: [data-model.md](data-model.md). Risks: [risks.md](risks.md).

Read [CLAUDE.md](CLAUDE.md) before editing this file.

---

## 1. Architectural Style

**Single-tenant, event-driven modular monolith** with one separate deployable for browser automation.

Rationale:

- **Single-tenant for v1** — one user per deployment. Multi-tenant is out of scope.
- **Event-driven** — admissions workflows are long-running (days to weeks), survive restarts, pause for humans, and retry against external flakiness. Request-response is the wrong default.
- **Modular monolith** — agents are logical modules inside one Next.js codebase. Splitting into microservices adds deployment and observability cost without benefit at this scale.
- **Separate browser worker** — Playwright sessions are stateful, heavy, IP-sticky, and incompatible with serverless cold starts. Runs on a persistent VM.

---

## 2. Deployment Topology

```
┌──────────────────────────────────────────────────┐
│                  User (browser)                  │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│  Vercel (Next.js 16 App Router + Fluid Compute)  │
│  - UI (RSC + client components)                  │
│  - Route handlers + Server Actions               │
│  - Auth (Clerk)                                  │
└───┬───────────────┬──────────────┬───────────────┘
    │               │              │
    ▼               ▼              ▼
┌─────────┐   ┌───────────┐   ┌────────────────┐
│ Neon    │   │ Inngest   │   │ Vercel AI      │
│ Postgres│   │ Workflows │   │ Gateway        │
│ +pgvec  │   │ (durable) │   │ (Claude, etc.) │
└─────────┘   └─────┬─────┘   └────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Playwright Worker   │
         │  (Fly.io VM)         │
         │  - persistent browser│
         │  - portal sessions   │
         │  - via Browserbase   │
         └──────────┬───────────┘
                    │
                    ▼
            ┌───────────────┐
            │  Vercel Blob  │ (documents, traces)
            └───────────────┘

Observability:
 Sentry (errors) + Axiom (logs) + OTel (traces) + Inngest (workflow replays)
```

---

## 3. Tech Stack

### 3.1 MVP Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | Next.js 16 App Router | RSC, Server Actions, PPR; native Vercel. |
| UI kit | shadcn/ui + Tailwind | Speed + design control. |
| Auth | Clerk (Vercel Marketplace) | Managed, secure, Vercel-native. |
| Primary DB | Neon Postgres | Branching, serverless-friendly, mature. |
| Vector store | pgvector on Neon | Single data store for MVP. |
| Queue / cache | Upstash Redis | Vercel-native, low-ops. |
| Object storage | Vercel Blob | Private mode for user documents. |
| Workflow engine | Inngest | Durable steps, sleeps, human-in-the-loop, replays. |
| AI Gateway | Vercel AI Gateway | Provider-agnostic; observability; fallbacks. |
| AI SDK | AI SDK v6 | Typed, schema-first. |
| Models | Claude Opus 4.7 (drafts), Claude Sonnet 4.6 (critique/extract), Claude Haiku 4.5 (throughput) | Balance quality/cost. |
| Browser automation | Playwright on Fly.io VM + Browserbase session layer | Persistent sessions, captcha support. |
| Crawling | Firecrawl / Jina Reader + Tavily search | Quality markdown + structured search. |
| PDFs | pdfplumber / pdf-parse | Layout-aware text extraction. |
| Contacts | Approved provider (Proxycurl / PeopleDataLabs) + Google Scholar via SerpAPI | ToS-compliant enrichment. |
| Email delivery | Resend (via Vercel Marketplace) | Transactional + deliverability. |
| Payments | None in v1 | User pays fees directly on portals. |
| Observability | Sentry + Axiom + OTel | Errors, logs, traces. |
| Config | `vercel.ts` | Typed project config. |
| ORM | Drizzle | Typed, migration-first. |
| Validation | Zod | Schema parity between API and extraction. |
| Package manager | pnpm | Workspace-friendly. |
| Runtime | Node.js 24 LTS | Current Vercel default. |

### 3.2 Scale Stack (post-MVP, introduced only if needed)

- Browser pool scaled to Browserbase managed cluster with residential IPs.
- Inngest stays; consider Temporal only if multi-language workers arrive.
- Read replicas on Neon; separate analytics warehouse (Clickhouse or Snowflake) for long-term data.
- CDN for public documents (not applicable in v1).

---

## 4. Layer-by-Layer

### 4.1 Frontend

- **Stack:** Next.js 16 App Router, RSC-first, Tailwind, shadcn/ui.
- **Routes:** `(onboarding)`, `(dashboard)`, `(approvals)`, `(evidence)`, `(applications)`.
- **State:** server state via RSC; client state minimal (essay editor, approvals).
- **Rules:** no client-side PII fetches beyond current user's scope; no third-party analytics in onboarding.

### 4.2 Backend API

- **Stack:** Next.js Route Handlers + Server Actions.
- **Responsibilities:** auth boundary, CRUD for user data, approval fulfillment, workflow trigger events, webhook receivers (Inngest callbacks, portal OAuth, email replies).
- **Rules:**
  - Server Actions for form-heavy flows (onboarding, profile edits, approvals).
  - REST for anything a future non-web client might call (portal worker, cron targets).
  - Every mutation emits an `action_log` row.

### 4.3 Orchestration / Workflow Engine (Inngest)

- **Responsibilities:** run all long-lived workflows listed in [BLUEPRINT.md §16].
- **Patterns used:**
  - **Steps** for atomic idempotent operations.
  - **Sleeps** for "re-check in N days" work.
  - **Waits for event** for human-in-the-loop approvals.
  - **Cancellation** for emergency stop.
  - **Concurrency keys** per user and per target (e.g., one portal session per program at a time).
- **Rules:**
  - Every external side-effect is wrapped in an idempotency-keyed step.
  - Every workflow is versioned; replays reference the version.
  - No agent code runs outside a step (otherwise retries re-run the whole function).

### 4.4 Browser Automation (Playwright Worker)

- **Deployable:** Docker image on Fly.io (or Hetzner) VM, exposed via mTLS-authenticated HTTPS endpoint.
- **Inside:** Playwright + Browserbase session manager (optional) + portal adapters.
- **Why VM not serverless:** session state, long-running operations, sticky IPs, headful fallback for CAPTCHA.
- **Interface:** receives signed job requests from Inngest steps; returns result + trace URL.
- **Rules:**
  - One browser context per portal session; contexts persisted in worker-local storage with periodic snapshot to Blob.
  - Every run captures a Playwright trace, DOM snapshots per section, and screenshots.
  - The `submit` method does not exist. Only `prepare_submit`.
  - Fee pages trip an interrupt; the worker pauses and emits an approval request.

### 4.5 Crawling & Search

- **Primary:** Firecrawl for HTML→Markdown, Tavily/Exa for search, SerpAPI for Google Scholar.
- **PDFs:** pdfplumber-equivalent; fall back to OCR only for image-only PDFs (rare).
- **Rules:**
  - Respect robots.txt; custom UA string identifying the agent.
  - Per-domain concurrency cap + rate limit.
  - Per-university research budget (20 pages, 5 PDFs, 2 min wall-clock).
  - Cached HTML + MD in Blob with content-hash keys.

### 4.6 Extraction & Normalization

- **Stack:** AI SDK v6 via AI Gateway; Zod schemas per field group.
- **Pattern:**
  - Specialized prompts for deadline, fee, tuition_coverage, stipend, required_documents.
  - Generic prompt for everything else.
  - Every output includes a `quoted_source` field required by the Zod schema.
  - Rules-based post-validator (regex for dates, currency, etc.).
- **Rules:**
  - Extractor cannot return a field value without a quote from the source.
  - No cross-field inference at the LLM step (a separate rules step combines).

### 4.7 Ranking Engine

- **Stack:** Postgres SQL + materialized views.
- **Scoring:** deterministic weighted formula per [BLUEPRINT.md §8].
- **Personalization:** weights configurable per user; defaults documented.
- **LLM use:** only for qualitative re-ranking of ties, with user-visible rationale.

### 4.8 Document Generation

- **Stack:** AI SDK v6 + dedicated per-artifact prompts.
- **Flow:** draft (Opus) → critic (Sonnet, different prompt) → rewrite (Opus) → fact-check (deterministic) → style-check → user review.
- **Rules:**
  - Voice anchor is a system-prompt constraint, not a suggestion.
  - Fact-check rejects any unmapped verifiable claim.
  - Style-check emits cliché + originality scores; drafts below threshold are rewritten once more.

### 4.9 Contact Intelligence

- **Stack:** directory crawlers + approved enrichment provider + Google Scholar.
- **Flow:** resolve contact → attempt enrichment → multi-signal verify → persist with confidence.
- **Rules:**
  - Direct LinkedIn scraping is forbidden.
  - Binding threshold: 0.85 for outreach, 0.65 for internal use.
  - Staleness disables outreach but not internal use.

### 4.10 Approval Layer

- **Stack:** Postgres `approval_request` + frontend queue + Inngest waits.
- **Payload:** one-line summary, confidence, evidence snippets, default action, rationale.
- **Rules:**
  - Emergency stop cancels all running workflows via Inngest cancellation API.
  - Batch approvals are first-class (approve N free apps with a single diff review).
  - Every approval produces an `action_log` row with actor = user, decision, timestamp.

### 4.11 Monitoring & Retry

- **Stack:** Inngest scheduled functions + freshness SLA config per record class.
- **Rules:**
  - Stale records are blocked from use at query time.
  - Refreshes are scheduled on a decay curve: earlier-than-SLA when close to a user-actionable moment (e.g., approaching deadline).

### 4.12 Notifications

- **Stack:** Resend for email; in-app inbox via DB.
- **Channels:** email (default), SMS via Twilio for deadline-critical events (opt-in), in-app always.
- **Rules:**
  - Quiet hours respected.
  - Every user-visible notification has a one-click deep-link to the approval item.

### 4.13 Storage

- **Postgres (Neon):** primary DB; pgvector for embeddings.
- **Blob:** user docs (transcripts, CV, writing samples) with client-side encryption before upload; Playwright traces and DOM snapshots.
- **Redis (Upstash):** short-lived queues, rate-limit counters, locks.
- **Rules:**
  - User document keys are per-user salted; no shared namespace.
  - Encryption keys are per-user envelope keys; the server does not hold raw keys in memory longer than a request.

### 4.14 Logging & Observability

- **Errors:** Sentry.
- **Structured logs:** Axiom.
- **Traces:** OpenTelemetry; propagated through AI Gateway.
- **Workflow replays:** Inngest.
- **Agent spans:** every agent invocation = one span with agent name, inputs hash, model used, tokens, outcome.

---

## 5. Data Flow — Research Sweep Example

```
Coordinator workflow START
  ├── step: seed_institutions (deterministic)
  │     → emits university.qualified per institution
  ├── fan-out: program_qualify (parallel per university)
  │     → ProgramQualificationAgent
  │     → emits program.qualified per matching program
  ├── fan-out per program (parallel):
  │     ├── requirements_extract → RequirementsExtractionAgent
  │     ├── fee_extract → FeeAndWaiverAgent
  │     ├── funding_discover → FundingDiscoveryAgent
  │     │     └── fan-out: funding_classify per opportunity
  │     ├── portal_map → PortalMapperAgent
  │     └── contact_discover → ContactDiscoveryAgent
  │             └── fan-out: profile_enrich per candidate
  ├── step: persist_evidence (append-only ledger)
  ├── step: compute_scores (SQL materialized view refresh)
  └── emits research.cycle_complete
```

Every step is idempotent, evidence-producing, and replayable.

---

## 6. Configuration (`vercel.ts`)

Use `vercel.ts` (not `vercel.json`) with `@vercel/config/v1`:

- Framework: `nextjs`.
- Functions: default 300s timeout.
- Crons: scheduled refreshes and deadline escalations.
- Rewrites: API → internal handlers.
- Headers: strict CSP, HSTS, referrer-policy.
- Env: pulled via `vercel env pull` locally.

---

## 7. Security Model

- **Auth:** Clerk; mandatory MFA for the primary user.
- **Transport:** HTTPS everywhere; mTLS between Vercel and the Playwright worker.
- **Data at rest:** user PII encrypted with per-user envelope keys.
- **Credentials:** never in DB or logs; vault integration only (1Password / Bitwarden).
- **Secrets:** Vercel env + Marketplace integrations only.
- **Audit:** every external action → `action_log`.
- **Rate limits:** per-user per-action; per-domain crawl rate limits.
- **Webhook verification:** HMAC on every Inngest and email webhook.

---

## 8. Cross-Cutting Concerns

### 8.1 Idempotency

- All external side-effects require an idempotency key.
- Key format: `sha256(user_id + action_type + target_id + payload_hash)`.
- Keys recorded in `idempotency_ledger` before the action; on retry, a present key short-circuits.

### 8.2 Auditability

- Append-only `evidence_events` for facts.
- Append-only `action_log` for external side-effects.
- Profile is revision-append-only; applications reference the `profile_revision_id` used at submission.

### 8.3 Replayability

- Every workflow is deterministic with respect to Inngest step inputs; non-determinism is encapsulated in tool calls (LLM, HTTP).
- LLM calls pass through the Gateway with prompt caching enabled; repeated prompts within TTL are cheap.
- Replays do not re-execute `send_email` steps; they assume completed.

### 8.4 Reliability

- Per-step retries with exponential backoff + jitter, max 5.
- Circuit breakers on external providers; fall back to queueing user-visible degraded mode.
- Golden-set regression on merge.
- Weekly synthetic portal runs.

### 8.5 Cost Controls

- Per-user research budget.
- Per-university crawl budget.
- LLM model selection by task (Haiku for high-volume extraction; Opus only for creative drafts).
- Prompt caching enabled on the Gateway for repeated prefixes (system prompts, schemas).
- Extraction results cached by content hash.

### 8.6 Privacy

- Data-flow allowlist: which fields can go to which provider.
- Blob URLs are signed short-TTL only.
- No third-party analytics in onboarding.
- User-initiated data export + delete supported from day one.

---

## 9. Service-Level Objectives (targets)

| SLO | Target |
|---|---|
| Dashboard read p95 | < 500 ms |
| Onboarding Server Action p95 | < 1 s |
| Approval fulfillment p95 | < 3 s |
| Workflow step success rate | ≥ 99.5% |
| Portal adapter run success (non-portal-side failure) | ≥ 99% |
| Extraction golden-set F1 | ≥ 0.85 |
| Freshness SLA compliance | 100% (stale = blocked) |
| Zero external actions without approval | 100% (hard invariant) |

---

## 10. What the Architecture Does NOT Do

- Does not run Playwright in Vercel Functions (cold starts kill session state).
- Does not scrape LinkedIn directly.
- Does not store raw credentials.
- Does not auto-submit, auto-pay, or auto-send anything in v1.
- Does not support multi-tenancy in v1.
- Does not support offline use.

---

## 11. Extension Points

When adding capabilities, these are the correct extension points:

| Want to add... | Extend... |
|---|---|
| New portal support | `packages/portal-adapters/<portal>/` |
| New extractable field | `packages/extractors/<field>.ts` + schema + golden fixture |
| New agent | `packages/agents/<agent>.ts` + entry in [agents.md](agents.md) |
| New workflow | `packages/workflows/<workflow>.ts` + entry in [BLUEPRINT.md §16] |
| New data provider | `packages/contacts/providers/<provider>.ts` + ToS note in [risks.md](risks.md) |
| New LLM model | AI Gateway config + per-task routing table |

Unlisted extension = propose a design change first.

---

## 12. Change-Control

- Changes to the stack require a line edit in §3 and a note in [plan.md](plan.md).
- Changes to a layer's responsibilities require updating [agents.md](agents.md).
- Changes to storage require updating [data-model.md](data-model.md).
- All changes require the Propagation Checklist in [CLAUDE.md](CLAUDE.md) §7.

---

*Last updated: initial creation.*
