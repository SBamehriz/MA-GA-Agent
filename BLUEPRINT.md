# MA-GA-Agent — Master Blueprint

An execution-ready product and systems plan for an agentic platform that helps a user apply to Master's programs in Artificial Intelligence (and closely related fields) while simultaneously discovering and applying to Graduate / Teaching / Research Assistantships (GA/TA/RA) and other funding that reduces or covers tuition.

Working name: **MA-GA-Agent** ("Master's + Graduate Assistantship Agent").

Version: 1.0 (architecture + operations blueprint; no implementation code).

---

## SECTION 1 — PRODUCT DEFINITION AND VISION

### 1.1 What the product is

MA-GA-Agent is a local-first personal admissions and funding operator. It behaves like a highly capable, permission-bounded research associate and application coordinator that works on behalf of one user at a time. Its job is to turn deep onboarding, verified personal memory, and a small number of approval decisions into a high-quality application pipeline with funding intelligently attached to each program.

It is explicitly **not** a chatbot, not a "write my SOP" tool, and not a job-board. It is a *workflow operator* that:

- Builds and maintains a reusable user memory layer before trying to automate downstream work.
- Discovers programs and funding.
- Extracts the ground truth behind each opportunity.
- Scores and sequences applications by expected value.
- Generates tailored application materials grounded in a verified story bank.
- Prepares application packets and checklists so the user is ready before any portal-driving begins.
- Preserves browser automation as a later capability, not the first implementation priority.
- Identifies the humans who actually control outcomes and, when strategically useful, drafts outreach for the user to approve.
- Tracks every deadline, document, and follow-up, and asks the user the smallest possible number of questions to make progress.

### 1.2 The exact user problem

Applying to AI Master's programs is a hidden high-cost project with deeply asymmetric information:

- Funding is often the decisive factor (a $60k program with a full GA is *cheaper* than a $30k program with none), but funding rules are buried in department PDFs, coordinator-only pages, and oral tradition.
- Application fees ($75–$150 each) make a brute-force "apply to 30 schools" strategy financially painful; free applications and fee waivers are under-used because they are hard to surface.
- Each portal (Slate, CollegeNET, Liaison, ApplyWeb, Graduate CAS, custom Banner/Ellucian, in-house PHP, etc.) re-asks the same 60–150 fields with slightly different wording.
- Relevant assistantships are posted on 4–6 different systems per university (departmental job board, HR portal, central graduate school page, Handshake, faculty lab pages, sometimes only mentioned in an email thread).
- The people who can unlock a GA/TA/RA — a PI, graduate director, lab coordinator, department chair, HR contact — are rarely named in the same place as the opportunity.

The user's real problem is not "write essays faster." It is "*stop paying a hidden 100+ hour tax per cycle to discover, qualify, compose, and submit applications while still being strategic about funding and contacts.*"

### 1.3 The real user outcome

Within a 4–8 week cycle, the user has:

- An attested user profile revision with source documents, verified stories, and a voice anchor that downstream agents can trust.
- A ranked, evidence-backed list of 30–80 AI-adjacent Master's programs, each tagged with funding status, fee status, and contact clarity.
- A shortlist of 5–15 GA/TA/RA opportunities they can realistically pursue, with the relevant human contacts identified when possible.
- Tailored SOPs, PSs, short answers, cover letters, and resume variants grounded in the user's real story.
- Application-ready packets and checklists for the top targets, with risky actions still held behind approval gates.
- A minimal local control surface showing what remains, what is blocked on the user, and what the system is waiting on externally.

### 1.4 Primary user

- A prospective graduate applicant (senior undergrad, early-career professional, or career switcher) with the intent to pursue an AI or AI-adjacent Master's.
- Technically literate (can use GitHub, understands Google Docs, is comfortable with an agent operating on their behalf) but not required to code.
- Funding-sensitive: cannot or will not pay $60k+/yr out-of-pocket; GA/TA/RA outcomes materially change whether they enroll.
- Time-poor and decision-fatigued. Values a system that reduces choices they must make rather than one that gives them 40-tab dashboards.

### 1.5 What "high autonomy" realistically means

High autonomy here means *the system runs the workflow end-to-end by default, and the user intervenes only at well-defined safety gates*. It does **not** mean "the system submits final applications or sends external messages without explicit approval."

Operationally:

- Research, extraction, classification, scoring, drafting, form pre-filling, and tracking: **autonomous**.
- Submitting an application, paying a fee, sending any external communication, creating accounts with the user's legal identity, requesting a letter of recommendation: **always approval-gated**.
- Repetitive "approve the next 5 free applications" batch approvals are explicitly supported to keep friction low.

### 1.6 What "minimal user work" should look like

The user's realistic touchpoints per cycle:

| Stage | User work | Time |
|---|---|---|
| Onboarding | Structured interview + transcript upload + test scores + recommender contacts | 90–120 min, once |
| Story bank seeding | Answer ~20 story prompts by voice or text | 60–90 min, once |
| Weekly triage | Approve batch of ranked applications, review 1–3 flagged essays | 15–45 min/week |
| Outreach approvals | Skim drafted emails, hit approve/edit/skip | 5–15 min/week |
| Final submission gates | Review packet diff, click submit | 3–8 min per application |
| Interviews | Attend them | External |

### 1.7 Fully / partially / always-manual automation map

**Fully automated:**
- Program and funding discovery crawls.
- Extraction of deadlines, fees, required documents, essay prompts.
- Initial funding classification (full / partial / stipend / unclear).
- Contact resolution and LinkedIn matching.
- Scoring and ranking.
- First-draft generation of every written artifact.
- Form mapping and pre-filling of non-identity fields.
- Saving drafts inside portals.
- Monitoring for page drift and deadline changes.

**Partially automated (system executes, user reviews):**
- Essay personalization and final wording.
- Per-application strategy (e.g., "apply to program X track A vs B").
- Contact selection for outreach.
- Scheduling of paid applications.

**Always manual / always approval-gated:**
- Final portal submission.
- Payment authorization.
- Sending any external email, LinkedIn message, or form message.
- Requesting letters of recommendation.
- Making factual claims the user has not confirmed.
- Releasing credentials or documents to any third-party.

### 1.8 Why contact discovery and LinkedIn intelligence are strategic, not cosmetic

Most GA/TA/RA outcomes are not decided by an application form; they are decided by a single human — usually a PI, a graduate director, or a lab manager — who has a hiring budget and a short list. The application is often a *post-hoc formality*.

Contact intelligence therefore does three things:

1. **Internal routing** — tells the system which department actually hires for which kind of assistantship, which disambiguates funding claims.
2. **Strategic targeting** — lets the user prioritize programs where a real human is approachable and relevant.
3. **Outreach leverage** — when the user approves, a single well-written email to the right person can unlock an RA slot that no job board ever advertised.

LinkedIn matters because it is the most current, self-maintained professional surface for most academics and staff. Faculty pages go stale; LinkedIn is usually less stale and reveals moves, sabbaticals, and lab transitions the department site hides.

### 1.9 Balancing convenience, quality, trust, safety

- **Convenience** is maximized through batching, defaults, and "approve N at once" flows.
- **Quality** is enforced by grounding every generated artifact in the verified story bank and by never allowing unverified facts into a submission.
- **Trust** is built through transparent evidence trails ("we said tuition is waived because of [URL], last checked 3 days ago") and visible confidence scores.
- **Safety** is protected by hard gates on submission, payment, and outreach, plus credential isolation and audit logs.

Ranking: **Quality > Trust > Safety > Convenience**. A convenient product that produces a weak submission or a wrong-person outreach destroys the user's reputation and cannot be undone.

### 1.10 What v1 should NOT try to do

- Do **not** auto-submit final applications.
- Do **not** auto-pay fees.
- Do **not** send any external communication without approval.
- Do **not** handle PhD applications (different norms, advisor-first workflow, much higher personalization cost).
- Do **not** handle funding negotiation or offer comparison (post-admission problem).
- Do **not** store letters of recommendation (recommenders upload directly).
- Do **not** try to generate writing samples or code portfolios (curate only).
- Do **not** serve multiple users in parallel (single-tenant first; multi-tenant later).
- Do **not** integrate payment on behalf of the user.

### 1.11 What would make the product dangerous or low-trust if designed poorly

- Submitting an application with a hallucinated GPA, publication, or affiliation.
- Misclassifying a program's funding (e.g., saying "tuition waived" when it is only a fee reduction) and letting the user enroll on that basis.
- Sending a cold email to the wrong professor, or to someone who left the institution, under the user's name.
- Losing credentials to a portal breach.
- Over-automating to the point the user can't answer interview questions about their own application.
- Drift between what the system believes and what the admissions office actually sees (e.g., partial submission shown as "complete").

---

## SECTION 2 — COMPLETE PROBLEM DECOMPOSITION

Each subproblem is defined with: why it is hard, required data, sources, failure modes, responsible agent/workflow, confidence representation, and uncertainty behavior.

### 2.1 University discovery

- **Why hard:** ~4,000+ US institutions; only a subset offer AI-relevant Master's; names vary ("MS in AI", "MS CS with AI concentration", "MS in Intelligent Systems", "MS in Data Science with ML track").
- **Data needed:** canonical institution list, Carnegie classification, rough tier, location, international-student friendliness.
- **Sources:** IPEDS, Common Data Set, Wikipedia lists, Peterson's, curated seed list, site-level crawls.
- **Failure modes:** miscounting satellite campuses as separate institutions; missing non-R1 schools that have strong AI programs; confusing colleges within a university.
- **Owner:** `UniversityDiscoveryAgent` + seed dataset.
- **Confidence:** existence confidence rarely below 0.95; only uncertain when a crawl returns 404s repeatedly.
- **Uncertain behavior:** mark institution as `provisional`; do not use for downstream matching until re-verified.

### 2.2 Program qualification / relevance

- **Why hard:** AI programs live in CS, ECE, Data Science, Informatics, Statistics, Industrial Engineering, Applied Math, Linguistics, Cognitive Science, iSchools, and Business Analytics departments. Titles are inconsistent.
- **Data needed:** program title, degree type (MS/MEng/MSE/MASc/MPS/MSCS), curriculum keywords, concentration, credit count, modality, length.
- **Sources:** program catalog pages, course lists, department faculty research pages.
- **Failure modes:** labeling an "MS in Data Science" as AI-relevant when its curriculum is BI-focused; missing a renamed program; counting dual-listed certificates as degrees.
- **Owner:** `ProgramQualificationAgent`.
- **Confidence:** derived from (a) keyword density in curriculum, (b) research area alignment of faculty, (c) explicit "AI/ML" language in program page.
- **Uncertain behavior:** mark as `adjacent` instead of `core`; include only if user has broad preferences.

### 2.3 Admissions requirements extraction

- **Why hard:** requirements are split between graduate school (transcripts, fees) and department (letters count, prompts, GRE waivers). Language is vague ("GRE typically not required").
- **Data needed:** transcripts policy, GPA floor, English test policy (TOEFL/IELTS/DET), GRE policy, LoR count, SOP prompt(s), CV requirement, portfolio, writing sample, prerequisites, program-specific questions.
- **Sources:** admissions pages, department admissions pages, FAQ pages, PDF handbooks.
- **Failure modes:** missing a "conditional admit" clause; confusing international vs domestic rules; treating "recommended" as "required."
- **Owner:** `RequirementsExtractionAgent`.
- **Confidence:** high only if at least two independent pages agree.
- **Uncertain behavior:** ask user to confirm one-line summary rather than assume.

### 2.4 Application fee and fee waiver

- **Why hard:** fee amount is sometimes on a different page than waiver rules; waivers may be automatic (e.g., McNair, recruiting events), request-based (form + essay), or conditional on income/fee-waiver codes; some schools are *always* free ("no application fee") and the system should surface these loudly.
- **Data needed:** fee amount, currency, waiver eligibility rules, waiver workflow, deadline for waiver request, whether it requires documentation.
- **Sources:** admissions fee page, waiver page, financial aid page, sometimes a PDF form.
- **Failure modes:** waiver gets buried under an unrelated financial-aid tab; fee changes between cycles and cached value goes stale.
- **Owner:** `FeeAndWaiverAgent`.
- **Confidence:** freshness-weighted; must be re-verified < 14 days before a user acts on it.
- **Uncertain behavior:** do not offer "free" classification without an explicit quote from an official page.

### 2.5 Funding and assistantship discovery

- **Why hard:** opportunities are decentralized (central grad school, department HR, individual PI pages, university job board, sometimes Handshake); some are posted only on internal-only pages that require sign-in; many are never posted at all and exist only through direct PI hiring.
- **Data needed:** opportunity title, host unit, funding type (GA/TA/RA/Fellowship/Grader/Tutor), stipend, tuition coverage, FTE, eligibility, application link, deadline, contact.
- **Sources:** department GA pages, grad-school funding pages, faculty lab "join us" pages, central HR job board, Handshake feeds, news posts.
- **Failure modes:** treating a TA position that only covers a partial tuition waiver as full; inferring assistantships exist because the department mentions them historically.
- **Owner:** `FundingDiscoveryAgent`.
- **Confidence:** encoded per-field (e.g., "tuition coverage" separately scored from "stipend amount").
- **Uncertain behavior:** record the opportunity but tag `funding_unclear`; rely on contact discovery to ask the right human.

### 2.6 Funding interpretation and classification

- **Why hard:** language is deliberately vague ("supports qualified students," "most students receive some form of aid"); "tuition waiver" can mean in-state only, or credit-capped, or taxable.
- **Classification target:**
  - `full_tuition_plus_stipend`
  - `full_tuition_only`
  - `partial_tuition`
  - `stipend_only`
  - `fee_reduction_only`
  - `case_by_case`
  - `unclear`
- **Sources:** same as 2.5 + policy PDFs.
- **Failure modes:** mapping "in-state tuition waiver" to `full_tuition` for an international student; mapping "RA positions *may* include tuition" to `full_tuition`.
- **Owner:** `FundingClassificationAgent` (LLM-reasoned, rules-guarded).
- **Confidence:** derived from explicit language match; downgraded for soft language.
- **Uncertain behavior:** mark `unclear` and add a question to the contact outreach draft queue.

### 2.7 Deadline extraction and comparison

- **Why hard:** multiple deadlines per program (priority, international, funding-consideration, rolling, final); dates are often in prose, not tables; time zones are rarely specified; dates shift mid-cycle.
- **Data needed:** deadline type, date, time, time zone, applicability (intl/domestic, with/without funding).
- **Failure modes:** picking the "final" deadline when the "funding-consideration" deadline is the real one; missing priority deadlines; using last cycle's date.
- **Owner:** `DeadlineAgent`.
- **Confidence:** must capture date + a quote from the page; require re-verification weekly as deadline approaches.
- **Uncertain behavior:** show both candidate dates to the user, never silently pick.

### 2.8 Portal and workflow detection

- **Why hard:** schools use Slate, CollegeNET, Liaison GradCAS, ApplyWeb, Banner, Ellucian, Embark, custom. Portal determines automation strategy.
- **Data needed:** portal vendor, URL, auth model, account-creation flow, fee gate location, file upload specs.
- **Owner:** `PortalMapperAgent`.
- **Confidence:** high — portals can usually be fingerprinted from DOM/URL/headers.
- **Uncertain behavior:** fall back to generic field-mapping heuristics + human-assisted mapping.

### 2.9 User profile ingestion

- Covered in Section 5. Key difficulty: asking just enough to be useful without fatiguing the user.

### 2.10 Story bank generation

- **Why hard:** good essays require specific vignettes; users rarely volunteer them in a form.
- **Sources:** structured interview, resume parse, voice capture, follow-up prompts.
- **Owner:** `StoryBankBuilderAgent`.
- **Uncertain behavior:** mark a story as `unverified`; never use unverified stories in submissions.

### 2.11 Essay and short-answer generation

- **Why hard:** must be specific to the program, grounded in true facts, and sound like the user — not an LLM.
- **Owner:** `WritingAgent` with draft/critique/rewrite loop.

### 2.12 Application form execution

- **Why hard:** hundreds of fields per portal; each portal has quirks (MM/DD/YYYY vs DD/MM, state dropdowns, required-but-optional fields, silent validation failures).
- **Owner:** `ApplicationExecutionAgent` + portal adapters.

### 2.13 Recommendation workflow management

- **Why hard:** most portals email recommenders directly with a portal-hosted upload link. The system must feed correct recommender info, track status, and follow up — without impersonating the user.
- **Owner:** `RecommendationCoordinator`.
- **Uncertain behavior:** never contact a recommender without explicit per-recommender user approval.

### 2.14 Contact discovery

- Covered in Sections 6 and 11.

### 2.15 LinkedIn / professional-profile matching

- **Why hard:** name collisions, out-of-date roles, private profiles, anti-scraping.
- **Owner:** `ProfileEnrichmentAgent`.
- **Confidence:** multi-signal (name + institution + title + photo consistency).
- **Uncertain behavior:** store candidates ranked; never surface a single match unless score > threshold.

### 2.16 Outreach decision-making

- **Why hard:** wrong-time or wrong-tone outreach can hurt an application. Some departments explicitly ask applicants not to email faculty.
- **Owner:** `OutreachStrategyAgent`.

### 2.17 Approval and human-in-the-loop

- Covered in Section 12.

### 2.18 Monitoring and refresh workflows

- **Why hard:** pages drift, deadlines change, fees change, the user's profile evolves, faculty leave.
- **Owner:** `MonitorAgent` + freshness SLAs per field type.

### 2.19 Uncertainty management

- **Why hard:** most failures are silent. The system must be loud about not knowing.
- **Convention:** every stored fact has `value`, `confidence ∈ [0,1]`, `evidence[]`, `last_verified_at`, `volatility_class`, `source_quality`.

### 2.20 Evidence tracking

- Every claim the system acts on must be traceable to at least one URL-anchored quote. "No evidence" = "do not act."

### 2.21 Error recovery

- **Why hard:** browser automation breaks; LLM calls fail; portals log users out.
- **Convention:** idempotent workflows with checkpoints; never retry a payment or submission without explicit re-approval.

---

## SECTION 3 — SYSTEM ARCHITECTURE

### 3.1 Architectural style recommendation

**Recommended: a single-user, event-driven modular monolith that runs locally first, preserves the current package and app scaffold, and can later be hosted if needed. Keep the existing Next.js-based structure, but do not make Vercel, Clerk, Redis, Blob, or browser-worker provisioning a blocker for the first useful slice.**

Why not microservices in v1: this is one user, one workflow, moderate throughput. Microservices add deployment and observability cost for no benefit. Agents are logical modules inside a monolith, not separate services.

Why event-driven: admissions workflows are long-running, depend on external state (portals, emails, page refreshes), and must survive restarts. Synchronous request-response is the wrong default.

Why a durable workflow engine: we need first-class retries, timeouts, sleeps ("re-check this page in 7 days"), human-in-the-loop pauses, and replay. Hand-rolling this from cron + queue is a trap.

Why a separate browser worker: Playwright sessions are stateful, heavy, and need sticky IPs for portals that fingerprint. They do not belong in serverless functions.

### 3.2 Layers

#### 3.2.1 Frontend (Next.js App Router)

- **Purpose:** a thin local operator surface for onboarding review, approvals, evidence inspection, and manual overrides.
- **Responsibilities:** render onboarding review state first; ranked lists, dashboards, and richer operator views later.
- **Inputs:** user actions, server-rendered data.
- **Outputs:** approval events, user-profile updates.
- **MVP stack:** keep the existing Next.js 16 App Router scaffold, but prioritize `(onboarding)` and minimal review surfaces. Local single-user mode does not require auth.
- **Scale stack:** unchanged; add offline-capable mobile wrapper only after MVP validated.
- **Tradeoff:** thin local review surface vs broad dashboard. Recommend the thin surface first.

#### 3.2.2 Backend / API (Node.js runtime)

- **Purpose:** the thin local API and script entrypoint layer between the operator surface and the workflow engine.
- **Responsibilities:** CRUD for profile and source documents, trigger workflows, emit events, fulfill approvals when those workflows arrive.
- **Inputs:** local UI calls, scripts, and later workflow webhooks if hosted services are introduced.
- **Outputs:** events into the workflow engine.
- **MVP stack:** Next.js Route Handlers + Drizzle ORM + a Postgres-compatible database. Hosted Neon wiring is optional later.
- **Tradeoff:** scripts/CLI vs REST vs Server Actions. Recommend scripts and Server Actions for the first local slice, REST only where another process truly needs it.

#### 3.2.3 Orchestration layer / workflow engine

- **Purpose:** durable execution of long-running, multi-step workflows that sleep, retry, and pause for humans.
- **Responsibilities:** run the workflows defined in Section 16.
- **MVP stack:** typed workflow definitions with a local coordinator runner first; **Inngest** remains a strong hosted option once durability beyond local execution is needed.
- **Scale stack:** Inngest continues to scale; consider Temporal only if the team grows to require stronger typing and multi-language workers.
- **Tradeoff:** local runner vs Inngest vs Workflow DevKit vs Temporal. Recommend local runner for the onboarding-memory slice, then promote the same contracts into Inngest if needed.

#### 3.2.4 Browser automation layer

- **Purpose:** drive portals, fill forms, save drafts, detect state, capture screenshots.
- **Responsibilities:** open browser contexts, maintain per-portal sessions, upload files, read validation messages, produce structured run logs.
- **MVP stack:** **Playwright** on a persistent VM (Fly.io or a small Hetzner box), wrapped with **Browserbase** or **Steel.dev** for managed sessions + captcha handling. Use `@playwright/test`'s trace viewer output for audit.
- **Scale stack:** Browserbase pool + sticky residential IPs where ToS allows.
- **Priority note:** preserve the interface and worker boundary early, but do not let portal-driving become the first implementation milestone.
- **Not recommended for MVP:** running Playwright inside Vercel Functions (cold starts kill session state).

#### 3.2.5 Crawling and search layer

- **Purpose:** feed research agents with web pages and structured search.
- **Responsibilities:** fetch pages, convert PDFs to text, respect robots.txt, cache.
- **MVP stack:** **Firecrawl** or **Jina Reader** for HTML-to-Markdown, `pdf-parse`/`pdfplumber` for PDFs, **Tavily** or **Exa** for web search, **Google Scholar** via SerpAPI for faculty publications.
- **Scale stack:** self-hosted Playwright crawler pool + a small vector index of the crawled corpus.

#### 3.2.6 Extraction and normalization layer

- **Purpose:** convert raw content into typed records (program, deadline, fee, assistantship, contact).
- **Responsibilities:** LLM-based structured extraction with strict schemas + rules-based validators.
- **MVP stack:** AI SDK v6 via a shared AI abstraction (Vercel AI Gateway optional), with schemas enforced by Zod. Use a mix of Claude Sonnet (accuracy) and Haiku (throughput). Never let extraction hallucinate a URL — require quoted source text.
- **Tradeoff:** generic single-prompt extraction vs. per-field specialized prompts. Recommend specialized prompts for the five highest-stakes fields (deadline, fee, tuition coverage, stipend, required documents) and a general prompt for the rest.

#### 3.2.7 Ranking engine

- **Purpose:** score opportunities and sequence user actions.
- **Responsibilities:** compute weighted scores (Section 8), produce sorted queues, expose why a row was ranked where it was.
- **MVP stack:** deterministic scoring in Postgres + materialized views; LLM used only for qualitative re-ranks on ties.

#### 3.2.8 Document generation engine

- **Purpose:** produce essays, SOPs, cover letters, outreach drafts, CV variants.
- **Responsibilities:** draft → self-critique → rewrite → fact-check → style-check.
- **MVP stack:** AI SDK v6 + Claude Opus 4.7 for drafts, Claude Sonnet 4.6 for critique, deterministic fact-check against the story bank.

#### 3.2.9 Contact intelligence layer

- **Purpose:** resolve the humans behind each opportunity (Section 11).
- **MVP stack:** faculty-page crawlers + LinkedIn via an approved data provider (Proxycurl/PeopleDataLabs) or user-provided cookie for signed-in access + name-matching rules.

#### 3.2.10 Human approval layer

- **Purpose:** expose structured approval items, enforce gates, and record decisions.
- **MVP stack:** a Postgres `approval_request` table + local review surface. Notification fan-out can wait.

#### 3.2.11 Monitoring and retry system

- **Purpose:** keep data fresh; detect broken portals; alert on deadlines.
- **MVP stack:** Inngest scheduled functions + a `freshness_sla` column per record type.

#### 3.2.12 Notifications system

- **Purpose:** tell the user what needs their attention.
- **MVP stack:** local review queue first. Email and SMS are optional later additions, not Phase 1 blockers.

#### 3.2.13 Storage layer

- **Primary DB:** Postgres-compatible storage, local first.
- **Object storage:** local files or generic object storage for user documents (transcript, CV, writing samples), with client-side encryption before upload where appropriate.
- **Cache / queue:** optional in the first slice; add Redis only when local-first execution actually needs it.
- **Vector store:** pgvector remains the default when embeddings become necessary.

#### 3.2.14 Logging and observability

- **MVP stack:** Sentry (errors) + Axiom (logs) + OpenTelemetry traces + per-workflow replay URLs from Inngest.

### 3.3 Cross-cutting architectural rules

- **Idempotency keys** on every external side-effecting action (submit, pay, send email). Retries must not double-act.
- **Append-only evidence ledger** (`evidence_events` table) — facts change but history is preserved.
- **Replayability:** every workflow must be replayable from any checkpoint with the same inputs.
- **Auditability:** every external action emits an `action_log` row with actor (system/user), target, payload hash, and outcome.
- **Human-override escape hatches** everywhere: any automation step can be paused, skipped, or replaced by a manual note.

### 3.4 Monolith vs microservices, sync vs async — concrete recommendation

- Monolith for the app. Separate worker for the browser layer only.
- Async by default. Synchronous only for user-facing reads (dashboard) and onboarding writes.
- Event-driven via Inngest; no direct function-to-function imports for long-running work.

---

## SECTION 4 — AGENT AND WORKFLOW DESIGN

### 4.1 Coordinator pattern

One **Coordinator Workflow** per user per cycle owns high-level state (`researching`, `drafting`, `applying`, `awaiting_user`). It dispatches specialized agents via typed events. Agents never call each other directly; they emit events the coordinator consumes. This prevents the classic multi-agent failure of cascading re-entry.

### 4.2 Agent catalog

For each agent: job, inputs, outputs, context/memory, tools, handoffs, escalation, failure modes, confidence rules.

#### 4.2.1 UniversityDiscoveryAgent

- **Job:** produce a ranked list of candidate universities for the user.
- **Inputs:** user preferences (countries, states, tuition budget, visa constraints), seed dataset.
- **Outputs:** `university_candidate` records with provenance.
- **Context/memory:** canonical institution DB, prior cycles' blacklist.
- **Tools:** Tavily/Exa search, Firecrawl, seed CSV.
- **Handoff:** emits `university.qualified` → ProgramQualificationAgent.
- **Escalation:** unknown institution with strong AI signal → flag to user.
- **Failure modes:** satellite-campus duplication; non-US institutions included when user said US-only.
- **Confidence:** identity confidence ≥0.95 or rejected.

#### 4.2.2 ProgramQualificationAgent

- **Job:** find AI-relevant Master's programs at a university.
- **Inputs:** university record.
- **Outputs:** `program` records with `relevance_class ∈ {core, adjacent, tangential, rejected}`.
- **Tools:** site search, Firecrawl, curriculum classifier (LLM).
- **Handoff:** emits `program.qualified` → RequirementsExtractionAgent, FundingDiscoveryAgent, FeeAndWaiverAgent, PortalMapperAgent in parallel.
- **Failure modes:** mislabeling data science as core AI; missing renamed programs.
- **Deterministic guardrail:** relevance_class is a deterministic function of a keyword + faculty alignment score, not an LLM freeform judgment.

#### 4.2.3 RequirementsExtractionAgent

- **Job:** extract the admissions requirements into a typed record.
- **Outputs:** `program_requirements` with fields for GPA floor, English tests, GRE, LoR count, SOP prompts, etc., each with `evidence`.
- **Tools:** Firecrawl + structured extractor with Zod schema.
- **Failure modes:** "recommended" coded as "required."
- **Rule:** any value without a quoted source string is rejected at write time.

#### 4.2.4 FeeAndWaiverAgent

- **Job:** resolve fee amount and waiver path.
- **Outputs:** `fee_policy` record with amount, waiver rules, waiver workflow URL, waiver deadline.
- **Failure modes:** waiver rules scattered across 3 pages; stale fee.
- **Freshness SLA:** 14 days before user action.

#### 4.2.5 FundingDiscoveryAgent

- **Job:** find every assistantship, fellowship, or funding opportunity tied to the program, department, or lab.
- **Tools:** department HR pages, central graduate school pages, lab "join us" pages, Handshake, LinkedIn jobs, Google search targeted at the department domain, cached PI publication pages.
- **Outputs:** `funding_opportunity` records.
- **Failure modes:** treating a historical mention as a current opening; duplication across sources.

#### 4.2.6 FundingClassificationAgent

- **Job:** classify each opportunity into a funding class with explicit evidence.
- **Deterministic guardrail:** a taxonomy table maps specific phrases to classes; LLM only fills in when no phrase matches, and always at lower confidence.

#### 4.2.7 ContactDiscoveryAgent

- **Job:** identify the humans relevant to a program/opportunity (graduate director, department admin, PI, lab manager, funding coordinator).
- **Outputs:** `contact` records with role, email, evidence, and a *role-relevance score*.
- **Tools:** department faculty pages, lab pages, grad-school staff pages, Google Scholar.

#### 4.2.8 ProfileEnrichmentAgent (LinkedIn + beyond)

- **Job:** resolve a contact to a LinkedIn / Google Scholar / personal site profile.
- **Tools:** approved data provider (Proxycurl) or user-authenticated LinkedIn session; Scholar; personal homepages.
- **Confidence:** multi-signal; requires at least two matching signals (institution + title, or institution + name + photo) before binding.

#### 4.2.9 UserProfileIngestionAgent

- **Job:** run the structured onboarding interview and build the user profile.
- **Tools:** transcript parser, resume parser, form UI, voice-to-text for story bank.

#### 4.2.10 StoryBankBuilderAgent

- **Job:** produce ~30 reusable vignettes tagged by theme (technical achievement, leadership, adversity, research curiosity, teamwork, teaching).
- **Verification:** each story has a `verified_by_user: bool` flag; unverified stories cannot be used in submissions.

#### 4.2.11 WritingAgent

- **Job:** draft SOPs, PS, short answers, cover letters, outreach.
- **Loop:** draft → critique (by a separate critic role) → rewrite → fact-check → user review.
- **Guardrail:** fact-check runs against the story bank and user profile; any claim not traceable blocks the draft.

#### 4.2.12 ApplicationExecutionAgent

- **Job:** log into portals, fill forms, save drafts, upload files, surface validation errors.
- **Handoff:** always stops at the submission button until approval.
- **Failure modes:** silent field failures; dropdown mismatches; file-type rejections.

#### 4.2.13 PortalMapperAgent

- **Job:** fingerprint the portal and load the right adapter.
- **Adapters (MVP):** Slate, CollegeNET, Liaison GradCAS, ApplyWeb. Generic adapter for everything else.

#### 4.2.14 ApprovalCheckpointAgent

- **Job:** construct approval payloads (diffs, drafts, evidence) and pause workflows until the user responds.

#### 4.2.15 DeadlineMonitorAgent

- **Job:** watch all upcoming deadlines, escalate urgency, trigger re-verification.

#### 4.2.16 FollowUpAgent

- **Job:** post-submission status checks, decision tracking, follow-up drafting (always approval-gated).

### 4.3 Where agentic vs deterministic

| Task | Style | Why |
|---|---|---|
| Seed URL discovery | Agentic | Open-ended search |
| Fee amount extraction | Deterministic + LLM | Regex + validator |
| Funding classification | Deterministic-first, LLM fallback | Taxonomy-mappable |
| Essay drafting | Agentic | Creative |
| Form filling | Deterministic | Portal adapters |
| Outreach drafting | Agentic | Creative |
| Approval routing | Deterministic | Rule-based |
| Deadline tracking | Deterministic | Scheduler |

### 4.4 Anti-hallucination rules

- **No unsourced facts.** Every stored fact carries `evidence[]`. Extraction that cannot produce a source string is discarded.
- **Story-bank-only facts in writing.** The WritingAgent is told, system-level, that claims it wants to make must exist in the story bank or be rejected.
- **Self-critique is not enough.** A *different* model/prompt critiques the draft.
- **Silent mode during extraction.** The extractor cannot "guess" dates; it produces `null` with a reason.

### 4.5 Preventing duplicated work / context drift

- Single source of truth per entity in Postgres.
- Agents receive only the slice of context they need.
- The coordinator is the only component allowed to fan out.
- Workflows are named and versioned; replays are explicit.

---

## SECTION 5 — USER PROFILE AND MEMORY MODEL

### 5.1 Data categories (minimum viable)

| Category | Example fields | Required | Why | Reuse |
|---|---|---|---|---|
| Legal identity | Full legal name, DOB, gender (optional), nationality, countries of citizenship | ✓ | Every form asks | Every app |
| Contact | Email, phone, mailing address, emergency contact | ✓ | Every form asks | Every app |
| Visa / status | Residency, visa type, intent to study on F-1/J-1, prior US study | If international | Eligibility for aid and assistantships | Funding |
| Academic history | Institutions, degrees, dates, majors, minors, GPA, scale | ✓ | Eligibility and SOP | Every app |
| Transcript details | Per-course grades for top 10–20 relevant courses | ✓ | Essays and prereqs | Essays |
| Key coursework | Courses + short descriptions | Optional | Shows rigor | Essays |
| Projects | Title, role, outcome, URL | ✓ | Story bank | Essays |
| Internships | Org, role, dates, accomplishments | Optional | Story bank | Essays |
| Work experience | Employer, role, dates, scope | Optional | Story bank | Essays |
| Research interests | 1–3 sentences + sub-areas | ✓ | Program fit + outreach | Essays, scoring |
| Technical skills | Languages, frameworks, tools, with years | ✓ | CV, SOP | CV, SOP |
| Leadership | Groups, roles, outcomes | Optional | Essays |
| Publications | Title, venue, authorship, URL | If any | CV, SOP | CV, SOP |
| Awards | Name, granting body, year | Optional | CV | CV |
| Standardized tests | GRE, subject, scores, dates | If taken | Eligibility | Apps |
| English tests | TOEFL/IELTS/DET, scores, dates | If required | Eligibility | Apps |
| Portfolio / GitHub | URLs | Optional | Essays, CV | Essays, CV |
| Target geography | Countries, states, city constraints | ✓ | Scoring | Scoring |
| Budget | Max out-of-pocket, willingness to pay fees | ✓ | Strategy | Ranking |
| Funding priorities | Rank of GA/TA/RA/fellowship, willingness to teach | ✓ | Strategy | Funding |
| Program preferences | MS vs MEng vs MPS, thesis vs non-thesis, online tolerance | ✓ | Qualification | Qualification |
| Lab / PI interests | Named professors, research themes | Optional but high-value | Outreach | Outreach |
| Recommenders | Name, title, institution, email, relationship, strength | ✓ | LoR workflow | LoR |
| Approval preferences | Batch size, quiet hours, channels | ✓ | UX | System-wide |
| Outreach preferences | Tone, signature, taboos | ✓ | Outreach | Outreach |
| Privacy permissions | Which data can be sent to which third parties | ✓ | Safety | System-wide |
| Credential handling | Which portals system may log into | ✓ | Safety | Automation |
| Writing style | Sample paragraphs, words to avoid, voice notes | ✓ | Essays | Essays |
| Story bank | ~30 vignettes | ✓ | Essays | Essays, outreach |

### 5.2 Storage

- Postgres normalized tables per category.
- Sensitive values (test IDs, DOB, addresses) encrypted at rest with a per-user envelope key.
- Versioning: every field has a `profile_revision_id` — profile is append-only, so an old application references the profile snapshot used at submission time.

### 5.3 Validation

- Structural (Zod) at write time.
- Semantic (e.g., "GPA must be ≤ 4.0 on a 4.0 scale") at ingestion.
- Cross-field ("DOB implies age ≥ 17 at program start") at onboarding completion.
- Attestation: the user must click "these values are true to my knowledge" before any writing agent uses them.

### 5.4 Updates

- User can edit any field anytime. Edits produce a new `profile_revision_id`.
- If a revision changes a field used in a submitted application, the system flags it, not rewrites history.

### 5.5 Privacy implications

- Transcripts and resumes are blob-encrypted.
- Recommender contacts are treated as third-party PII; the system never stores their personal notes.
- No third-party analytics in the onboarding flow.

### 5.6 Onboarding flow (non-overwhelming)

A three-session structure, each ≤40 minutes, saved progressively:

**Session 1 — Identity, Academics, Targets.**
Upload transcript + resume. System auto-extracts first pass. User confirms/edits in a single scrollable review screen. User picks target geography and budget.

**Session 2 — Story Interview.**
Conversational agent asks ~20 open prompts ("What project are you proudest of? What did you try that failed?"). Voice or text. Story bank generated at the end for user review.

**Session 3 — Preferences and Permissions.**
Approval preferences, outreach preferences, credential handling, recommender list, writing style samples.

The system never asks twice. Gaps surface as per-application micro-prompts ("This program asks for your undergraduate rank — do you want to provide it or leave blank?").

---

## SECTION 6 — SCHOOL, PROGRAM, FUNDING, AND CONTACT DATA MODEL

### 6.1 Entities (summary)

| Entity | Key fields | Notes |
|---|---|---|
| `university` | id, name, aliases[], country, state, tier, website, ipeds_id | Canonical record |
| `school_or_college` | id, university_id, name (e.g., "College of Engineering") | Intermediate |
| `department` | id, school_id, name, website, admissions_url | |
| `graduate_program` | id, department_id, title, degree_type, modality, credit_count, thesis_option, concentration, curriculum_url, relevance_class | |
| `admissions_cycle` | id, program_id, term ("Fall 2026"), state ("open"/"closed") | |
| `application_deadline` | id, cycle_id, type (priority/final/funding/intl), date, time, tz, applicability, evidence | Multiple per cycle |
| `fee_policy` | id, program_id, amount, currency, waiver_available, waiver_workflow_url, waiver_deadline, evidence, last_verified_at | |
| `requirement_set` | id, program_id, gpa_floor, gre_policy, english_policy, lor_count, sop_required, sop_prompts[], cv_required, portfolio_required, prereqs[], evidence | |
| `essay_prompt` | id, requirement_set_id, text, word_limit, tag, evidence | |
| `funding_opportunity` | id, host_type (dept/lab/grad_school), host_id, title, funding_class, stipend_amount, stipend_period, tuition_coverage, fte_pct, eligibility, intl_eligible, application_url, deadline, contact_id, evidence, last_verified_at | |
| `professor` | id, department_id, name, title, research_areas[], faculty_page_url, scholar_url, personal_url, active, evidence | |
| `graduate_director` | id, department_id, professor_id or name, email, evidence | |
| `department_coordinator` | id, department_id, name, email, role, evidence | |
| `lab` | id, department_id, pi_id (professor_id), name, url, join_page_url, active | |
| `hiring_contact` | id, host_type, host_id, person_id, role, evidence | |
| `person_role` | id, person_id, role, org_id, start_date, end_date | History over time |
| `linkedin_profile` | id, person_id, url, last_verified_at, verification_signals[], confidence | |
| `professional_profile` | id, person_id, type (scholar/personal/github), url, verification_signals[] | |
| `evidence` | id, subject_type, subject_id, source_url, quoted_text, fetched_at, crawler_id, hash | Append-only |
| `source_quality` | id, domain, quality_score, notes | Static weights |

### 6.2 Versioning

- All "interpreted" records (`fee_policy`, `application_deadline`, `funding_opportunity`, `requirement_set`) are versioned by `valid_from`/`valid_to`.
- `application` records reference the exact versions used.

### 6.3 Provenance

- Every non-trivial field has `evidence_id[]`. No evidence → field is `null` with `reason`.
- `source_quality` table weights domain reliability (a .edu admissions page > a third-party aggregator > a student blog).

### 6.4 Conflicting data

- Same field, multiple sources, different values → store all candidates in a `field_candidate` table; pick the winner by (source quality × freshness).
- If the top two candidates disagree beyond threshold → mark `conflict` and escalate.

### 6.5 Multiple possible contacts

- Store all candidates with their own confidence; do not collapse prematurely.
- Outreach is only allowed against a single high-confidence binding (>0.85 after multi-signal check).

### 6.6 Stale evidence

- `last_verified_at` + volatility class → freshness SLA (fee: 30d, deadline: 14d near deadline / 60d far; contact: 90d; funding: 30d).
- Stale records cannot be acted upon; they must be refreshed first.

---

## SECTION 7 — RESEARCH AND DISCOVERY ENGINE

### 7.1 Finding candidate universities

1. **Seed list** from curated public sources (CSRankings for AI-strong departments, US News tiers, user-provided list, country filters).
2. **Expansion** via "schools mentioned alongside" Scholar patterns, co-authorship networks (for ML-active departments), and common admissions aggregators.
3. **De-duplication** on `ipeds_id` or canonical domain.

### 7.2 Finding AI-relevant programs

- Query admissions search + Google `site:dept.edu "master" (ai OR "artificial intelligence" OR "machine learning" OR "data science")`.
- Classify curricula using a keyword + faculty-research-alignment model.
- Capture program title variants and aliases.

### 7.3 Expansion to adjacent fields

- If the user's preferences allow adjacent fields, expand into Data Science, CS with AI concentration, ECE with ML, Applied Math, Statistics with ML, Cognitive Science, Informatics.
- Each adjacent program is tagged `adjacent` and shown only if user opted in or if core options are thin in the target geography.

### 7.4 Verifying program is active and relevant

- Program page loaded in last 90 days.
- Curriculum link exists and returns 200.
- At least one admissions-cycle signal (dates, "apply now" page).
- At least 3 faculty in the department with AI/ML research pages.
- Otherwise mark `dormant` and exclude.

### 7.5 Finding admissions and funding pages

- BFS crawl from the department root, depth limited to 3, with a learned page-type classifier (admissions/funding/requirements/faculty/lab/other).
- Expand to graduate school and HR sites via department links + domain search.

### 7.6 Distinguishing department vs university-wide funding

- A funding page at `grad.university.edu/funding` = university-wide baseline.
- A funding page at `department.university.edu/*assistantship*` = department-specific.
- A lab page "we are hiring RAs" = lab-specific.
- Each tier is recorded separately; the user is shown the highest-specificity match.

### 7.7 PDFs, handbooks, FAQs, staff pages

- A dedicated `pdf_ingest` pipeline converts to Markdown with layout hints, then runs the same extraction agents.
- Staff pages and directory pages are specifically targeted because they reveal coordinators.

### 7.8 Identifying humans tied to an opportunity

- Funding opportunity page often names a contact; follow to the person.
- Lab pages list PIs and students.
- Department directory + grad-school directory cross-referenced.
- Scholar links confirm research area.

### 7.9 Searching for LinkedIn

- `"Name" "Institution" site:linkedin.com/in`.
- Confirm with institution + title + headshot comparison when possible.
- Through a data provider is preferred (legal + reliable).

### 7.10 Resolving person identity ambiguity

- Multi-signal match (name + institution + role + research area overlap + photo when available).
- If signals conflict, keep candidates distinct until a disambiguation signal arrives.

### 7.11 Confidence assignment

- Every conclusion has `confidence = f(source_quality, freshness, corroboration, linguistic_specificity)`.
- Confidence decays with time at a volatility-class-specific rate.

### 7.12 Evidence storage

- Quoted text + URL + hash + fetched_at + crawler_id, append-only.
- No derived fact without at least one evidence row.

### 7.13 Strategies

- **Search:** domain-scoped + curated query templates per extraction target.
- **Crawl depth:** 3 for program/department; 2 for grad school; 1 for HR portal listings; unlimited targeted for a specific PI page.
- **Extraction:** typed schemas; per-field specialized prompts for high-stakes fields; generic for low-stakes.
- **Evidence ranking:** official .edu > official PDF > news release > third-party aggregator > blog.
- **Fallback:** when a field cannot be extracted, add it to the `human_inquiry_queue` for optional outreach.
- **Freshness:** per-class SLA.
- **Retry:** transient failures retried with exponential backoff; permanent 404s mark the link dead and trigger rediscovery.
- **Stopping:** per-university budget (e.g., 20 pages, 5 PDFs, 2 min wall-clock) to prevent rabbit-holes.

### 7.14 Uncertain versus unsupported

- `uncertain`: some signal exists but corroboration is missing → keep in pipeline, refresh soon.
- `unsupported`: explicit counter-evidence (e.g., "we do not admit international students") → exclude.

---

## SECTION 8 — APPLICATION STRATEGY AND PRIORITIZATION ENGINE

### 8.1 Scoring function (illustrative weights)

```
score = 0.22 * program_fit
      + 0.18 * funding_strength
      + 0.10 * funding_confidence
      - 0.10 * fee_burden
      - 0.08 * deadline_urgency_penalty_if_too_soon
      + 0.10 * admissions_realism
      + 0.06 * location_preference
      + 0.08 * assistantship_compatibility
      + 0.06 * outreach_opportunity_quality
      + 0.05 * contact_clarity
      + 0.05 * evidence_freshness
```

Each component normalized to [0,1]; weights sum to 1.0 (penalty terms applied after).

### 8.2 Hard filters

- Program must be `core` or `adjacent` per user preference.
- User must meet the published GPA floor (or within 0.2 with compensating signal).
- English test score meets minimum (or waiver path exists).
- Program deadline > today + buffer (buffer = 10 days for free, 21 days for paid).
- For free-only mode: `fee_amount == 0` OR `waiver_available && eligible`.

### 8.3 Soft preferences

- Tier alignment with user target.
- Location preference.
- Research area overlap with named PIs.
- Historical admit data if available.

### 8.4 Budget-aware rules

- Phase A: only free + waiver-eligible.
- Phase B (after A exhausted or user opens budget): paid applications up to user's per-cycle fee budget, prioritized by expected value.
- Each paid application requires explicit approval.

### 8.5 User overrides

- User can pin or blacklist any program.
- User can shift weights (e.g., "prioritize funding over tier") in preferences.

### 8.6 Decision thresholds and statuses

| Status | Meaning | Action |
|---|---|---|
| `auto_progress_free` | Free, high-score, all evidence fresh | System proceeds through drafting; approval only at submit |
| `apply_now` | High-score, deadline within 21 days | Surface at top of queue |
| `high_priority_wait` | High-score but deadline far | Draft early, hold |
| `needs_user_review` | Missing critical data the user must provide | Ask one question |
| `pay_only_with_approval` | Fee > 0 | Hold in Phase B queue |
| `low_confidence_hold` | Key field's confidence < 0.6 | Re-verify before acting |
| `skip` | Hard filter failed | Archive with reason |
| `conflict` | Evidence disagreement | Escalate |

---

## SECTION 9 — DOCUMENT GENERATION AND WRITING SYSTEM

### 9.1 Artifact types

- Statement of Purpose (long-form, program-specific).
- Personal Statement (diversity/adversity style, when asked).
- Short-answer prompts (100–500 words).
- GA cover letter (to department or specific hiring committee).
- TA/RA response (typically form-based; short responses to prompts).
- Resume tailoring (per-program keyword + length tuning).
- CV tailoring (academic variant with publications).
- Outreach emails (to professors, PIs, directors, coordinators).
- LinkedIn-style outreach drafts when email is not available and the user has opted in.

### 9.2 Story bank operation

- ~30 verified vignettes tagged with themes and surface skills (e.g., "debugging-under-pressure", "ownership", "teaching-peers").
- The writing agent retrieves 2–4 vignettes relevant to a prompt and composes around them.
- Stories outside the bank cannot be introduced by the agent.

### 9.3 Truthfulness enforcement

- `fact_check` step: extract every claim from the draft; map each to a story bank entry or profile field; reject drafts with unmapped claims.
- Claims that are subjective ("I am passionate about ML") are allowed; claims that are verifiable and new ("I published at NeurIPS") are not.

### 9.4 Staying personal / non-generic

- Voice anchor: a 3–5 paragraph sample of the user's own writing feeds the style constraint ("match cadence, contractions, metaphor density, sentence length variance").
- Prohibited phrase list (the infamous SOP clichés) maintained and enforced.
- Per-program personalization budget: at least 2 program-specific details must appear (lab name, course title, faculty reference) grounded in extracted evidence.

### 9.5 Draft-review-rewrite loop

1. **Draft** (Opus-class model, high-creativity, grounded context = story bank + prompt + program evidence + voice anchor).
2. **Critic pass** (different prompt, Sonnet-class): checks fit-to-prompt, evidence grounding, clichés, length, tone.
3. **Rewrite** (addresses critic notes).
4. **Fact-check** (deterministic + LLM): every factual claim traceable.
5. **Style-check:** voice anchor similarity, cliché scan, originality heuristic.
6. **User review:** required for SOP/PS; optional per user setting for short answers under 150 words.

### 9.6 Red flags the system raises

- Any sentence not grounded in story bank or evidence.
- Claim of a skill not in the profile.
- Program-specific details copied from another draft (template leak).
- Tone mismatch (overclaim, manipulative flattery, hyperbole).
- Output too similar to prior drafts (>85% cosine) — risk of cookie-cutter feel.

### 9.7 Outreach tailoring

- Outreach style template is built per role:
  - **PI**: research-first, one-paragraph fit statement, concrete ask.
  - **Graduate director**: program-fit, one specific question, respectful of workload.
  - **Coordinator**: operational question, no pitch.
  - **Lab manager**: capability + availability statement.
- All outreach drafts must be user-approved.

---

## SECTION 10 — BROWSER AUTOMATION AND FORM EXECUTION

### 10.1 Portal adapter architecture

- `PortalAdapter` interface: `detect`, `login`, `create_account`, `start_application`, `fill_fields`, `upload_files`, `save_draft`, `read_validation`, `capture_state`, `prepare_submit` (never `submit`).
- Adapters: Slate, CollegeNET, Liaison GradCAS, ApplyWeb, generic fallback.
- Generic fallback uses a DOM-learning pass: extract all fields, map to profile via LLM with schema, present proposed mapping for one-time user confirmation, then reuse.

### 10.2 Account creation

- Always approval-gated on first portal use.
- Uses a per-portal email alias if the user opts in (e.g., `user+uga@domain`).
- Password generated by password manager integration; system never stores raw credentials, only references a vault.

### 10.3 Login flows

- Prefer user SSO when available.
- For portals without SSO, use credentials from the user's vault (1Password, Bitwarden) via official integrations; credentials never written to the DB.
- 2FA: user is pinged with a push approval in real time; automation waits up to 5 minutes.

### 10.4 Draft saving

- After every section, save and capture a DOM snapshot + screenshot in the evidence store.
- Use the portal's native save where possible; fallback to local rehearsal and replay on next login.

### 10.5 Field mapping

- A per-portal field dictionary is maintained; new fields trigger a learning pass.
- Identity fields (name, DOB, SSN if applicable) are mapped deterministically from profile.
- Free-text fields (short answers) are filled from generated artifacts after user approval.

### 10.6 File uploads

- Validate file types and sizes against portal specs before attempting upload.
- Transcripts: use the exact version the user uploaded to the vault; never regenerate.
- Essays: PDF generated from the approved draft with consistent formatting.

### 10.7 Validation, broken forms, CAPTCHAs, 2FA, session handling

- **Validation failures:** log and retry if parseable; if ambiguous, escalate.
- **CAPTCHAs:** only automated via explicit vendor service (2Captcha-style) when the portal's ToS permits; otherwise user is pinged.
- **2FA:** real-time user ping.
- **Sessions:** per-portal storage bucket; auto-reauth on expiry with a single user ping.
- **Broken forms:** if a page is broken, stop, capture, notify.

### 10.8 State persistence

- Every run has a `run_id`; all DOM/screenshot/evidence artifacts carry it.
- `application_state` tracks sections completed, fields filled, files uploaded, draft saved.

### 10.9 Fee page detection + final submission gating

- Fee page is fingerprinted per portal. When encountered, automation stops and creates an approval request.
- Final submission button is never clicked by automation; it is always human-clicked, via a "proxy-click" UX where the user reviews the final diff and presses a confirm button that releases the click.

### 10.10 Auto-fill vs prepare-only

- Auto-fill: identity, education history, test scores, short demographic fields.
- Prepare-only: essays, short answers, portfolio links that need per-program curation, any field flagged `needs_user_review`.

### 10.11 Recovering from portal changes + detecting drift

- Every run compares DOM hashes of key sections against the last good run.
- Drift > threshold triggers an adapter rebuild (LLM-driven field mapping refresh with a user confirmation step before resuming).

### 10.12 Audit logs and replayability

- Every run stores a Playwright trace (time-travel debug), DOM snapshots, screenshots, and an action log.
- Any submission must be reproducible from the action log.

### 10.13 Making automation reliable enough for real use

- Dry-run mode for every adapter before production use.
- A small "golden set" of completed applications re-run weekly to detect portal regressions.
- Alert on any run with > N validation errors.

---

## SECTION 11 — CONTACT INTELLIGENCE AND OUTREACH STRATEGY

### 11.1 Who is the relevant person?

Per opportunity type:

| Opportunity | Primary contact | Secondary | When outreach helps |
|---|---|---|---|
| Named RA position (lab page) | PI | Lab manager | Almost always |
| TA (department pool) | TA coordinator / DGS | Department chair | Sometimes; check policy |
| GA (unit outside dept) | Unit hiring manager | HR | Usually |
| Fellowship | Fellowship coordinator | Grad school office | Rarely (process-driven) |
| Ambiguous funding | DGS | Dept coordinator | When clarifying |
| Program admissions | Admissions office | DGS | Rarely for AI Master's |

### 11.2 Distinguishing roles

- **Professor / PI**: runs a research group; hires RAs from their grant.
- **Graduate director (DGS)**: owns admissions policy; not usually the RA hirer.
- **Department coordinator**: owns logistics and can clarify process.
- **HR contact**: owns non-academic employment paperwork.
- **Lab manager**: often the real triage point for RA hiring.

Role is stored as a typed field, not free text, so strategy logic can branch on it.

### 11.3 Useful / irrelevant / risky

- **Useful:** PI whose research aligns with user and who has a recent paper or grant suggesting hiring.
- **Irrelevant:** DGS for a simple process question that's answered on the website.
- **Risky:** emeritus, on sabbatical, or retired — or an admissions committee member where cold-emailing is explicitly discouraged.

### 11.4 Finding profiles

- LinkedIn: institution + title + name query; approved data provider preferred.
- Faculty page: department directory.
- Lab page: often has student and staff listings.
- Google Scholar: verifies research area and recency.
- Personal site: final signal, confirms active.

### 11.5 Resolving ambiguity

- Two candidates same name, same institution: split by department, title, photo.
- Candidate with no institution match: excluded.
- Candidate with title change (e.g., moved to another school): `person_role` history captures this; the system picks the *current* affiliation.

### 11.6 Match confidence

- Signals each worth 0.2–0.4 depending on strength: exact institution + department, exact title, co-mentioned with program on faculty page, photo match (if available), research area overlap with public papers.
- Outreach threshold: 0.85. Internal-use threshold: 0.65.

### 11.7 Stale / low-quality contact data

- `last_verified_at` + `role_history`.
- Staleness disables outreach but keeps the record for internal routing.

### 11.8 Internal use without outreach

- Even without outreach, contact data feeds:
  - Program-fit scoring (is there a PI whose work overlaps?).
  - Funding interpretation (the lab page clarifies what the department page obscured).
  - Story tailoring (essay mentions a real, active PI by name).

### 11.9 When outreach helps vs hurts

Helps:
- User's research area aligns with a PI who has recent (last 18 months) hiring signals (grants, new papers, "joining the lab" posts).
- Opportunity is lab-hosted and lightly posted.
- User has a concrete, short question the website does not answer.

Hurts:
- Department explicitly asks applicants not to email faculty (common at top programs).
- User has nothing program-specific to say and would send a template.
- Recipient is the admissions committee chair in review season.

### 11.10 Personalization

- Always cites a concrete paper / project / course by the recipient.
- Ties it to a user vignette from the story bank.
- One clear ask (e.g., "Are you expecting to hire RAs for Fall 2026?").
- Never more than 180 words.

### 11.11 Tone and professionalism

- Style guide enforced: formal salutation, no flattery, no hyperbole, no jargon unless recipient uses it, no LinkedIn-speak.
- Signature standardized.

### 11.12 Approval-only send

- Every outreach draft has an approval item: recipient, channel, draft text, rationale, evidence (paper/project cited).
- The user can approve, edit, or skip.
- Nothing leaves the system without an approval.

### 11.13 Which opportunities benefit most from outreach

- Lab-posted RA openings.
- Ambiguous funding where a single email clarifies tuition coverage.
- Newly-announced labs or recent PI moves.
- Programs with explicit "reach out if interested" language.

### 11.14 Contacts usually not to message

- Admissions committee during review season.
- DGS for website-answered questions.
- HR for research fit questions.
- Any recipient flagged `do_not_contact` in user preferences.

### 11.15 Fit into the broader workflow

- Outreach is parallel to application drafting; never a blocker.
- If outreach yields a signal (reply, auto-reply, silence) it updates the opportunity's score.

---

## SECTION 12 — HUMAN-IN-THE-LOOP, APPROVALS, AND SAFETY GATES

### 12.1 Action classification

| Action | Policy |
|---|---|
| Submit application | Always approval-gated |
| Pay application fee | Always approval-gated |
| Send email or LinkedIn message | Always approval-gated |
| Request letter of recommendation | Always approval-gated per recommender |
| Finalize an essay | Approval-gated for SOP/PS; optional for <150 words if user opts in |
| Create account with legal identity | Always approval-gated |
| Store credentials | User-approved vault references only; no raw storage |
| Update profile facts | Approval-gated if the change contradicts a user-attested value |
| Apply for GA/TA/RA form | Approval-gated (counts as external submission) |
| Schedule a future send | Allowed with a preview approval that binds the eventual send |

### 12.2 Confidence-driven auto-approval

- **Safe to auto-advance (not submit)**: extraction, classification, drafting, form pre-fill, scoring.
- **Auto-advance allowed with high confidence**: re-verifying a deadline when the new value matches old within 0 days.
- **Always human**: anything external-facing or irreversible.

### 12.3 Approval UX

- Single unified approval queue on the dashboard.
- Each item has: one-line summary, confidence score, evidence snippets, default action (Approve / Edit / Skip / Defer).
- Batch approvals for "approve next N free applications" with a single review of the batch diff.
- Quiet hours + notification channel preferences respected.

### 12.4 Emergency stop

- A single "Stop Everything" button that:
  - Cancels all running Inngest workflows.
  - Logs the user out of all portal sessions.
  - Flushes all pending approval sends.
  - Requires an explicit resume to re-enable.

### 12.5 Rollback / cancel

- Submissions cannot be rolled back (external).
- Everything pre-submission (drafts, applications in progress, outreach queued) can be canceled.

### 12.6 Low-friction review

- The dashboard shows diffs, not full records, for repeat approvals.
- Essay review UI shows inline critic notes.
- Mobile-friendly approval buttons for out-of-office decisions.

### 12.7 Communicating uncertainty

- Confidence badges (Low/Medium/High) + underlying reasons.
- "We're not sure because..." disclosure at every uncertain claim.
- Evidence inspector one-click accessible.

---

## SECTION 13 — RISKS, SAFETY, TRUST, AND FAILURE PREVENTION

| # | Risk | How it happens | Severity | Detection | Mitigation | Fallback | Alerting |
|---|---|---|---|---|---|---|---|
| 1 | Hallucinated program details | LLM extraction fills gaps | High | Zod validator + evidence required | Reject unsourced fields | Mark unclear; ask user | Immediate flag |
| 2 | Wrong deadline | Last-cycle date cached | High | Freshness SLA + weekly re-verify near deadline | Two-source rule for deadlines within 30d | Show both candidates | Email alert |
| 3 | Outdated fee | Page change | Medium | Re-verify 14d before action | Re-fetch on action | Show stale flag | In-app |
| 4 | Wrong funding interpretation | Ambiguous language | High | Taxonomy-first, LLM fallback only at low confidence | Mark `unclear` and prompt outreach | Skip funding claims in essay | In-app |
| 5 | False "full tuition" assumption | Partial waiver misread | Critical | Explicit language requirement | Never auto-classify without matching phrase | Defer to user | Email |
| 6 | Wrong person identified | Name collision | High | Multi-signal threshold | ≥2 signals to bind | Keep candidates separate | In-app |
| 7 | Wrong LinkedIn match | Private or stale profiles | Medium | Confidence threshold ≥0.85 for outreach | Don't link below threshold | Use faculty page only | In-app |
| 8 | Bad outreach judgment | Timing or role wrong | High | Policy filter (season, role) | Block drafts against policy | Require explicit override | In-app |
| 9 | Generic/weak essays | Over-templated | High | Originality + cliché scan | Voice-anchor enforced | Force rewrite | In-app |
| 10 | Accidental false claims | Draft introduces new facts | Critical | Fact-check step | Reject draft | Force rewrite | In-app |
| 11 | Duplicate applications | Re-run workflows | Medium | Idempotency keys | Dedup by `program_id + cycle_id` | Merge state | In-app |
| 12 | Broken browser flows | Portal changes | Medium | Golden-set weekly run | Adapter rebuild with user confirm | Manual session | Email |
| 13 | Anti-bot blocks | Too-aggressive crawl | Medium | 429/captcha detection | Backoff, residential IP, obey ToS | Switch to user-assisted | In-app |
| 14 | Incorrect recommendation handling | Wrong recommender emailed | High | Per-recommender approval | Explicit gate | Rollback via portal when possible | Email |
| 15 | Privacy risk | PII leaked to third-party | Critical | Data-flow allowlist | Only approved providers | Redact | Immediate |
| 16 | Credential storage risk | Secrets persisted | Critical | Never store raw secrets | Vault integration only | Break-glass rotation | Immediate |
| 17 | Legal/policy | Scraping ToS | High | Per-domain policy | Prefer official APIs/providers | Manual fallback | Policy review |
| 18 | User trust erosion | Silent failures | High | Visible "we don't know" | Loud uncertainty UX | Opt-in auto features | Surveys |
| 19 | Over-automation | Auto-submit | Critical | Hard gate | Never auto-submit in v1 | Always human click | N/A |
| 20 | Stale data | Old fields acted on | High | SLA per class | Block action on stale | Refresh first | In-app |

---

## SECTION 14 — MVP DEFINITION

### 14.1 What the MVP includes

- Single-user, local-first system for one applicant.
- Onboarding memory: identity, academics, targets, source documents, story interview, preferences, attestation, and voice anchor.
- Research engine for ~75–150 curated institutions (CSRankings top-50 + user-specified + 20 mid-tier state schools with strong AI).
- Program qualification, requirements extraction, fee/waiver, deadlines, funding discovery, funding classification.
- Contact discovery (internal use) with LinkedIn/faculty/Scholar enrichment.
- Scoring and a minimal review surface; dashboard breadth can wait.
- Essay draft/critique/rewrite loop for SOP, PS, short answers, and resume/CV tailoring.
- Application packet and checklist generation for top targets.
- Approval queue + emergency stop for risky actions.
- Outreach drafting (not sending) — drafts stored but not released in MVP (see Section 18).
- Deadline monitoring.
- Evidence ledger and confidence surfacing.

### 14.2 What the MVP excludes

- No auto-submit (never in v1, period).
- No auto-pay.
- No outreach sending in first release (drafts only; sending enabled in a follow-up release once trust is established — see Section 18).
- No hosted deployment dependency for the first useful slice.
- No auth-first product shell requirement for local single-user operation.
- No portal automation requirement for the onboarding-memory, discovery, writing, and packet-prep milestones.
- No PhD workflows.
- No offer negotiation.
- No multi-tenant.
- No mobile app.
- No international-only institutions in v1 unless user specifies — reduce scope.
- No curricular prerequisite checker beyond keyword match.

### 14.3 Manual in MVP

- Document uploads (transcripts, CV, writing samples).
- Recommender requests (always user-approved).
- Credential vaulting (user configures).
- Final submission click.
- Fee payment.

### 14.4 Automated in MVP

- Research, extraction, scoring, drafting, resume tailoring, packet/checklist preparation, contact discovery, enrichment (internal), deadline tracking, freshness refreshes.

### 14.5 Target institutions count for first run

- **75–150 institutions** in MVP. Rationale: enough to produce a meaningful ranked list without drowning the research budget in long-tail noise.

### 14.6 Contact intelligence in MVP — yes

- Include contact discovery and enrichment. It powers scoring and essay personalization even without outreach.

### 14.7 Outreach in MVP — draft-only

- Drafts are generated and stored. Sending is disabled in first release.
- Rationale: outreach quality depends on accurate contact intelligence, which needs a few weeks of operation before the system and user both trust it.

### 14.8 Success looks like

- User completes onboarding once and gets a reusable attested profile revision, verified stories, and a voice anchor that downstream agents can trust.
- User receives an evidence-backed ranked list plus funding/contact intelligence for the first meaningful batch of programs without needing a hosted deployment setup.
- User gets tailored SOP/PS/short-answer/resume outputs for top targets with fact-check constraints enforced.
- User gets multiple application-ready packets/checklists before browser automation is required.
- ≥85% deadline accuracy on the "apply now" queue.
- ≥90% funding classification agrees with a manual audit on a sample of 30.
- ≥80% essay drafts need only light edits before submission.
- Zero outbound messages sent without approval.

### 14.9 Why this MVP is the correct first build

- It attacks the highest-leverage manual tax (onboarding memory + discovery + writing + preparation) without taking the risks that would destroy trust (auto-submit, auto-send).
- It generates an operational record that enables safe expansion in v2.

---

## SECTION 15 — PHASED ROADMAP

### Phase 0 — Foundations and local execution (2 weeks)

- Objectives: confirm scope, preserve the scaffold, and make the core runtime work locally without hosted blockers.
- Deliverables: settled entity model, onboarding script, typed env/config, evidence ledger spine, local execution path.
- Dependencies: user availability for story interview prototype.
- Tasks: keep the existing repo shape, settle the profile/source-document model, wire the coordinator contracts, define safe local defaults.
- Risks: over-investing in hosted plumbing before the first useful slice exists.
- Exit: architecture, data model, and onboarding-memory direction are signed off.

### Phase 1 — Onboarding and memory (3 weeks)

- Objectives: capture deep user context once and make it reusable everywhere else.
- Deliverables: profile revision flow, source-document tracking, story-bank verification, voice anchor, attestation, `onboarding.complete`.
- Tasks: transcript/resume ingestion, onboarding answers capture, story verification, voice-anchor persistence, local review surface or script trigger.
- Risks: weak source linkage or unverifiable stories poisoning downstream writing.
- Exit: one real user profile revision is persisted locally with verified stories and attested fields.

### Phase 2 — Program, funding, and contact discovery (4 weeks)

- Objectives: run research, extraction, classification, and evidence collection end-to-end on a meaningful institution set.
- Deliverables: working research pipeline, funding taxonomy, contact discovery + enrichment, evidence inspector/read model.
- Tasks: crawler, extractors, funding classifier taxonomy, deadline validator, PDF pipeline, contact resolution.
- Risks: LLM extraction cost and noisy discovery breadth; mitigate with specialized prompts, caching, and curated seeds.
- Exit: a ranked evidence-backed discovery set is usable on 20 institutions with contact intelligence included.

### Phase 3 — Writing and resume tailoring (4 weeks)

- Objectives: turn verified user memory plus program evidence into strong application artifacts.
- Deliverables: SOP/PS/short-answer drafting loop, fact-check, style-check, resume/CV tailoring, review path.
- Tasks: prompt library, voice-anchor use, claim-to-story/profile mapper, tailored resume outputs.
- Risks: generic outputs or invented claims; enforce fact-check and voice constraints aggressively.
- Exit: 3 SOPs, 5 short answers, and at least 2 tailored resume variants reviewed with light user edits.

### Phase 4 — Application preparation and checklist generation (3 weeks)

- Objectives: make top targets ready without depending on portal automation.
- Deliverables: application-ready packets, artifact bundles, requirement checklists, missing-info flags, readiness states.
- Tasks: derive per-program packet requirements, assemble approved artifacts, produce checklist/status outputs, surface blockers.
- Risks: preparing packets that are incomplete or not traceable to the attested profile revision.
- Exit: several top programs are marked ready-for-user-review with complete packet/checklist state.

### Phase 5 — Approval-based automation support (2 weeks)

- Objectives: formalize pause/resume, approval queues, and emergency-stop behavior before any risky automation expands.
- Deliverables: approval queue, approval builders, workflow pause/resume, emergency stop.
- Tasks: approval payload design, batch review patterns, audit logs, decision replay.
- Risks: hidden side-effect paths; mitigate with hard gates and compile-time exclusions.
- Exit: risky actions cannot proceed without explicit user decisions and are fully auditable.

### Phase 6 — Browser automation and portal execution (later)

- Objectives: drive portals only after onboarding, discovery, writing, packet prep, and approvals already work.
- Deliverables: portal adapters, draft-save workflows, validation handling, fee/submit gates.
- Tasks: Playwright worker, adapter DSL, drift handling, golden-set portal regressions.
- Risks: portal anti-bot and adapter brittleness.
- Exit: real applications can be prepared to the submit gate without violating earlier safety constraints.

### Phase 7 — Reliability, hosted hardening, and advanced autonomy (ongoing)

- Objectives: harden the system after the local-first operator core is already useful.
- Deliverables: SLOs, dashboards, backups, optional hosted deployment polish, later outreach-send controls.
- Exit criterion: trust metrics hit targets (Section 17).

---

## SECTION 16 — OPERATIONAL WORKFLOWS

Every workflow runs with named steps and explicit checkpoints. Inngest remains a strong later durability option, but the contracts should also make sense in local-first execution.

### 16.1 New user onboarding

1. `onboarding.started` → create or resume the local user workspace.
2. `onboarding.answers_captured` (identity, academics, targets, preferences) → profile draft saved.
3. `ingest.source_document` for transcript, resume, and related materials → extracted facts queued for user review.
4. `story_bank.draft_generated` from interview + source docs → candidate stories saved with source references.
5. `voice_anchor.captured` → writing-style anchor saved.
6. `story.verify` + `profile.attest` → verified stories and attested profile revision frozen.
7. Emit `onboarding.complete`.
8. Kickoff `research.cycle_begin`.

Failure: any incomplete section → `onboarding.resume_at`.

### 16.2 Research sweep

1. `research.seed_institutions` → from curated + user list.
2. For each institution: `program.qualify` (parallel).
3. Qualified programs fan out to `requirements.extract`, `fee.extract`, `funding.discover`, `portal.map`.
4. `funding.classify` per opportunity.
5. `contact.discover` per program/opportunity.
6. `profile.enrich` for each contact.
7. `evidence.persist` for everything.
8. Emit `research.cycle_complete` when coverage SLA is met.

Failure: transient → backoff; persistent → `research.mark_unsupported`.

### 16.3 Funding verification

1. Scheduled every 30 days (or 14 near deadline).
2. For each `funding_opportunity`: refetch source, re-extract, re-classify.
3. If classification changes → `approval.funding_change` + notify user.

### 16.4 Contact discovery

1. Triggered post-program qualification.
2. Query department directory + lab pages + grad school pages.
3. For each candidate: attempt enrichment.
4. Persist with role + evidence.
5. Escalate ambiguity to a `needs_review` queue.

### 16.5 Free application first-pass

1. `strategy.queue` filters `fee_amount==0` and high scores.
2. For each: `application.prepare` (create account with approval, open draft).
3. `fields.fill` (identity).
4. `documents.attach` (CV, transcript).
5. `essay.generate` (draft/critique/rewrite).
6. `essay.user_review` (required for SOP/PS).
7. `application.save_draft`.
8. `approval.submit` → wait for user click.
9. On click: user submits via proxy-click UI; system records `submitted_at`.

### 16.6 Fee-waiver

1. Detect waiver path per program.
2. `waiver.apply` → generate waiver request materials.
3. `approval.waiver` → user submits waiver.
4. On waiver granted: move application into free queue.

### 16.7 Paid-application approval

1. Batch proposal: system surfaces top N paid options with fee, confidence, expected value.
2. User approves whole batch or individual items.
3. Each approved item moves into `application.prepare` branch.

### 16.8 Document generation

1. Gather prompt + program evidence + story bank + voice anchor.
2. Draft → critic → rewrite → fact-check → style-check.
3. User review for SOP/PS.
4. Persist approved draft to application state.

### 16.9 Application execution

1. Portal adapter runs per section.
2. Draft saved after each section.
3. State checkpointed.
4. On completion, produce submission preview.

### 16.10 Deadline escalation

- Daily at 09:00 user local time.
- Upcoming deadlines in 14/7/3/1 days → surface in dashboard.
- ≤3 days + not submitted → additional email + SMS (if opted in).

### 16.11 Post-submission

1. Confirmation email parsed from user inbox (with user consent via a read-only integration).
2. `application.status = submitted_confirmed`.
3. Schedule `followup.check` at T+14, T+30.

### 16.12 Follow-up

1. Schedule polite nudges for missing items (recommender late, document missing).
2. Always drafted, always approval-gated.

---

## SECTION 17 — EVALUATION FRAMEWORK

### 17.1 Offline metrics (pre-launch)

- **Research accuracy**: precision/recall of program discovery against a hand-curated 30-institution gold set.
- **Extraction accuracy**: per-field F1 on deadlines, fees, LoR count, English test, funding class.
- **Funding classification accuracy**: confusion matrix on 60 opportunities.
- **Contact identification accuracy**: precision at 1 vs gold set.
- **LinkedIn/profile match accuracy**: top-1 match rate.
- **Essay quality**: holistic rubric scored by a trained reviewer.

### 17.2 In-MVP metrics

- Application completion rate (drafted to user-submitted).
- User effort reduction (time to complete X applications vs manual baseline).
- Approval burden (count + time per approval).
- Field-fill correctness on a sampled portal.
- Evidence coverage (fraction of facts with ≥1 evidence row).

### 17.3 Post-launch metrics

- Deadline miss rate (target 0).
- False-positive apply recommendations (user pins "bad fit").
- Outreach send-approval rate (post-outreach release).
- Admit and funding yields by cohort.
- Trust score (user survey).

### 17.4 Benchmarks

- Before launch: 30-institution golden set; accuracy targets per Section 17.1.
- During MVP: weekly regression run on golden set; per-PR regression for extractors.
- Post-launch: monthly audit of 10 submitted applications vs what the portal actually shows.

### 17.5 Human review loops

- Weekly extraction audit (15 min sampling).
- Per-application submission audit during first 20 submissions.
- Bi-weekly essay rubric review.
- Incident review after any Critical-severity failure.

---

## SECTION 18 — FINAL RECOMMENDATIONS

These are opinions, not menus.

### 18.1 Research assistant first or full executor?

**Executor, but gated.** Build the full executor path through form pre-fill and draft-save from day one. The value of research alone is small; the value multiplier comes from the last mile. What is gated is *external side-effects* (submit, pay, send), not the pipeline itself.

### 18.2 Auto-submit anything in v1?

**No. Never.** Not even free, high-confidence, obvious cases. The reputational cost of one wrong submission dwarfs the minor convenience. A two-second approve-click per application is an acceptable tax.

### 18.3 AI Master's only or include adjacent?

**AI core + adjacent programs that the user opts into**, classified separately. The user's budget and energy are finite; adjacency expands options without diluting focus if it is opt-in and labeled.

### 18.4 Broad search or curated targets?

**Curated first, then expand.** Start from CSRankings top-50 + 20 strong mid-tier publics + user-specified schools = 75–150 institutions. After Phase 2 is stable, expand search via site-level discovery. Broad crawling from day one is the fastest path to drowning in noise.

### 18.5 Contact intelligence in MVP?

**Yes, for internal use.** Even without outreach, contact data powers program fit, funding interpretation, and essay personalization. Building it later means rebuilding the scoring and essay agents; build it now.

### 18.6 Outreach in MVP?

**Draft-only in v1; sending in v2.** Generate drafts, surface them for review, but do not send until the system has run long enough (and the user has enough context) to trust the judgment layer. Once trust is established, sending is enabled with per-channel rate limits.

### 18.7 Credential storage?

**Never store raw credentials.** Integrate with a user-controlled vault (1Password, Bitwarden). For portals that can't work with vault autofill, use per-session user-handed credentials that never persist.

### 18.8 Best autonomy model

**"Approval at the edges, autonomy in the middle."**
- Inside the system (research, extraction, ranking, drafting, pre-fill, monitoring): fully autonomous.
- At every boundary with the external world (submit, pay, send, impersonate): always human.
- Approvals are batchable so convenience stays high.
- The emergency-stop is one click away at all times.

### 18.9 Best first implementation path

1. Lock this blueprint.
2. Keep the current scaffold, but make it work locally before expanding hosted dependencies.
3. Build the evidence ledger + profile/source-document model first.
4. Implement onboarding ingestion, story verification, voice anchor capture, and `onboarding.complete`.
5. Add program, funding, and contact discovery against a curated golden set.
6. Add writing and resume tailoring with fact-check hard-enforced.
7. Add application packet and checklist generation before any portal driving.
8. Add approval-based automation support.
9. Add portal adapters only after the earlier slices are already useful.
10. Harden with golden-set regressions, freshness SLAs, and monitoring.
11. Only then consider more hosted plumbing or outreach sending in a later release.

### 18.10 The north-star rule

**Be loud about uncertainty, silent about success.** The system earns trust by showing its work when it doesn't know, not by celebrating when it does. Every wrong-person email, every mis-classified "tuition waiver," every missed deadline costs far more than the hundred quiet wins that brought the user this far. Build accordingly.

---

*End of blueprint. Next step when ready: implement the onboarding-memory slice inside the existing scaffold and keep hosted plumbing optional until that slice is genuinely useful.*
