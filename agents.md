# agents.md — Agent Catalog & Contracts

> Every agent, its job, inputs, outputs, tools, handoffs, and escalation rules.
> Source: [BLUEPRINT.md §4, §11](BLUEPRINT.md). Data: [data-model.md](data-model.md). Architecture: [architecture.md](architecture.md).

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Coordinator Pattern

There is **one Coordinator Workflow** per user per cycle. It:

- Owns high-level state: `onboarding`, `researching`, `drafting`, `applying`, `awaiting_user`, `complete`.
- Dispatches agents via typed Inngest events.
- Consumes agent results via event subscriptions.
- Is the **only** component allowed to fan out work.

Agents never call each other directly. They emit events; the Coordinator routes. This prevents cascading re-entry and makes the system replayable.

```
User action / schedule
        │
        ▼
  Coordinator ─── emits ──▶ agent.topic.event
        ▲                          │
        │                          ▼
        │                   Specialized Agent
        │                          │
        └── subscribes ── emits ──┘
```

---

## 2. Agent Contract (common shape)

Every agent conforms to:

```
interface AgentContract {
  name: string;                // e.g., "FundingClassificationAgent"
  version: string;             // semver; bump on breaking output changes

  inputs: ZodSchema;           // typed input payload
  outputs: ZodSchema;          // typed output payload (always includes evidence_id[])

  tools: Tool[];               // explicit whitelist
  model: ModelRouting;         // which model(s) used; e.g., Sonnet for extract, Opus for draft

  invariants: string[];        // "every output field must have evidence"
  failureModes: string[];      // documented classes of failure
  escalation: EscalationRule;  // when to stop and alert user

  confidence: ConfidenceRule;  // how confidence is computed
  idempotency: IdempotencyRule;// key formula
}
```

Contracts live in `packages/agents/<agent>/contract.ts` and must match the entry in this file.

---

## 3. Global Agent Rules

These are non-negotiable across every agent:

1. **Evidence-first.** Every non-trivial output field includes `evidence_id[]` or is `null` with a `reason`. An output without required evidence fails validation.
2. **No cross-agent calls.** Agents emit events; the Coordinator routes. Shared helpers are fine; inter-agent invocation is not.
3. **Deterministic-first, LLM-fallback.** If a rule / regex / taxonomy can answer, use it. LLM only when required, at lower base confidence.
4. **Confidence is a field, not a vibe.** Every output includes `confidence ∈ [0,1]`.
5. **Freshness-aware.** Agents consuming stored data check SLA; stale data is refreshed or the work pauses.
6. **Tool whitelist.** Agents can only call the tools declared in their contract.
7. **No external side-effects without an approval gate.** Agents may prepare, never send.
8. **Log spans.** Every invocation produces an OTel span.

---

## 3.1 Current Implementation Emphasis

- The current build order for the local personal-agent implementation is: `UserProfileIngestionAgent` → `StoryBankBuilderAgent` → discovery agents (`UniversityDiscoveryAgent`, `ProgramQualificationAgent`, funding/contact agents) → `WritingAgent` (including resume tailoring) → application-preparation/checklist workflows → approval support → browser/portal automation later.
- The catalog below is still the full target system. Deferred agents stay in the design so contracts, entities, and handoffs remain stable.
- Deferment is a priority decision, not a removal decision.

---

## 4. Agent Catalog

Each entry specifies: job, inputs, outputs, context/memory, tools, handoffs, escalation, failure modes, confidence, idempotency.

---

### 4.1 UniversityDiscoveryAgent

- **Job:** produce a ranked list of candidate universities for the user's criteria.
- **Inputs:** `{ user_id, geo_filter, budget_cap, relevance_preferences, seed_overrides[] }`.
- **Outputs:** `university_candidate[]` with `{ university_id, source, reason, initial_fit_score, evidence_id[] }`.
- **Context/memory:** canonical institution DB (IPEDS seed), prior blacklist, user preferences.
- **Tools:** Tavily/Exa search, Firecrawl, seed CSV.
- **Handoffs:** emits `university.qualified` → `ProgramQualificationAgent`.
- **Escalation:** unknown institution with strong AI signal not in seed → flag to user.
- **Failure modes:** satellite campus duplication; non-target countries slipping in.
- **Confidence:** identity confidence ≥ 0.95 or rejected.
- **Idempotency:** keyed on `{user_id, filters_hash}`.

---

### 4.2 ProgramQualificationAgent

- **Job:** find AI-relevant Master's programs at a given university.
- **Inputs:** `university` record.
- **Outputs:** `program[]` each with `relevance_class ∈ {core, adjacent, tangential, rejected}`, evidence.
- **Context:** faculty research keywords, curriculum text.
- **Tools:** site search, Firecrawl, keyword classifier, faculty-alignment scorer (LLM-assisted, deterministic wrapper).
- **Handoffs:** emits `program.qualified` (parallel) → `RequirementsExtractionAgent`, `FeeAndWaiverAgent`, `FundingDiscoveryAgent`, `PortalMapperAgent`, `ContactDiscoveryAgent`.
- **Escalation:** renamed program (aliases drifted) → flag.
- **Failure modes:** data-science misclassified as core; missing newly-named programs.
- **Confidence:** weighted from keyword density + faculty alignment + explicit AI/ML language.
- **Idempotency:** keyed on `{university_id, cycle_id}`.

---

### 4.3 RequirementsExtractionAgent

- **Job:** typed extraction of admissions requirements.
- **Inputs:** program admissions URLs, PDFs.
- **Outputs:** `requirement_set` with fields: GPA floor, GRE policy, English tests policy, LoR count, SOP requirement + prompts, CV requirement, portfolio, prereqs, essay prompts. Each field has evidence.
- **Tools:** Firecrawl, PDF pipeline, specialized Zod-schema extractor.
- **Escalation:** "recommended" vs "required" ambiguity → flag.
- **Failure modes:** treating "recommended" as "required"; missing conditional clauses.
- **Confidence:** high only if ≥2 independent pages agree on a field.
- **Idempotency:** `{program_id, cycle_id}`.

---

### 4.4 FeeAndWaiverAgent

- **Job:** resolve fee amount + waiver workflow.
- **Outputs:** `fee_policy` with amount, currency, waiver availability, waiver workflow URL, waiver deadline, evidence.
- **Tools:** admissions fee page crawler, waiver page crawler, financial-aid search.
- **Escalation:** fee changed mid-cycle → surface diff to user.
- **Failure modes:** waiver rule hidden behind login; stale cached amount.
- **Confidence:** freshness-weighted (≤14 days before a user action).
- **Idempotency:** `{program_id, cycle_id}`.

---

### 4.5 FundingDiscoveryAgent

- **Job:** enumerate assistantship / fellowship / funding opportunities tied to a program, department, or lab.
- **Outputs:** `funding_opportunity[]` records with host type, title, evidence, contact candidate, application URL, deadline if known.
- **Tools:** department HR crawler, grad-school funding crawler, lab "join us" crawler, Handshake/internal job board parser, domain-scoped Google search.
- **Handoffs:** emits `funding.discovered` → `FundingClassificationAgent` (per opportunity).
- **Escalation:** opportunity mentioned historically with no current signal → flag uncertain.
- **Failure modes:** duplication across sources; treating historical postings as current.
- **Confidence:** per-source weighted.
- **Idempotency:** `{program_id_or_department_id, cycle_id}`.

---

### 4.6 FundingClassificationAgent

- **Job:** classify each opportunity into a funding class with explicit evidence.
- **Outputs:** `{ funding_class, stipend_amount, tuition_coverage, fte_pct, eligibility_flags, intl_eligible, confidence, evidence_id[] }`.
- **Tools:** taxonomy table (deterministic phrase matcher) + LLM fallback.
- **Escalation:** LLM fallback with low confidence → mark `unclear`.
- **Failure modes:** misreading "in-state waiver" as full tuition; treating "may include" as "includes."
- **Confidence:** deterministic match > LLM inference > guess (rejected).
- **Idempotency:** `{funding_opportunity_id, content_hash}`.

---

### 4.7 DeadlineAgent

- **Job:** extract deadlines per program + per opportunity.
- **Outputs:** `application_deadline` rows with type (`priority`, `final`, `funding_consideration`, `international`, `rolling`), date, time, tz, applicability, evidence.
- **Tools:** site crawler, specialized deadline extractor with two-source rule for close-in deadlines.
- **Escalation:** sole source + deadline within 30 days → prompt user to confirm.
- **Failure modes:** picking "final" when "funding-consideration" is the real one; missing priority deadlines.
- **Confidence:** requires ≥2 independent sources within 30 days of deadline.
- **Idempotency:** `{program_id, cycle_id, deadline_type}`.

---

### 4.8 PortalMapperAgent

- **Job:** fingerprint the admissions portal and bind the correct adapter.
- **Outputs:** `portal_binding` with vendor, auth model, account-creation URL, fee-gate hint, file-upload specs.
- **Tools:** DOM + URL fingerprints; adapter registry.
- **Escalation:** unknown portal → generic adapter + one-time user-confirmed field mapping.
- **Failure modes:** custom portal misfingerprinted as Slate.
- **Confidence:** ≥0.9 for known vendors; lower for generic.
- **Idempotency:** `{program_id}`.

---

### 4.9 ContactDiscoveryAgent

- **Job:** identify the humans relevant to a program / opportunity (PI, DGS, coordinator, HR contact, lab manager).
- **Outputs:** `contact[]` with role, email (if public), evidence, role-relevance score.
- **Tools:** department directory crawler, grad-school directory crawler, lab page crawler, Google Scholar.
- **Handoffs:** emits `contact.pending_enrichment` → `ProfileEnrichmentAgent`.
- **Escalation:** no contact found for a funding opportunity tagged `unclear` → prompt user.
- **Failure modes:** email obfuscation; wrong person with same name.
- **Confidence:** role-weighted + directory specificity.
- **Idempotency:** `{department_id_or_lab_id, role}`.

---

### 4.10 ProfileEnrichmentAgent

- **Job:** resolve a contact to a LinkedIn / Scholar / personal-site profile.
- **Outputs:** `linkedin_profile` and/or `professional_profile` records with verification signals and match confidence.
- **Tools:** approved provider (Proxycurl/PDL), Google Scholar via SerpAPI, personal-site detection.
- **Rules:** **LinkedIn not scraped directly.** Use provider or user-authenticated session only.
- **Escalation:** two viable candidates → keep distinct.
- **Failure modes:** name collisions; private profiles; out-of-date roles.
- **Confidence:** multi-signal; outreach threshold ≥0.85.
- **Idempotency:** `{contact_id, provider, version}`.

---

### 4.11 UserProfileIngestionAgent

- **Job:** run structured onboarding; parse documents; fill profile fields.
- **Inputs:** transcript upload, resume upload, onboarding answers.
- **Outputs:** draft `user_profile_revision`, `profile_source_document[]`, and a story-bank seed package for the next verification step.
- **Tools:** PDF parser, resume parser, local structured prompt runner, voice-to-text.
- **Current priority:** first implementation block.
- **Escalation:** any critical field blank → blocking prompt.
- **Failure modes:** transcript OCR errors; GPA scale confusion.
- **Confidence:** per-field; revision remains draft until the user verifies and attests.
- **Idempotency:** `{user_id, revision_id}`.

---

### 4.12 StoryBankBuilderAgent

- **Job:** produce ~30 verified vignettes from the onboarding interview + resume + projects.
- **Outputs:** `story[]` each with `{ title, summary, themes[], proof_points[], source_refs[], verified_by_user }`.
- **Tools:** conversational interviewer (voice + text), resume cross-reference.
- **Current priority:** first implementation block, immediately after profile ingestion.
- **Escalation:** story lacks concrete proof → request specific detail.
- **Failure modes:** stories unverifiable against profile; fabricated specifics.
- **Confidence:** binary (verified or not); stories default to unverified until the user confirms them.
- **Idempotency:** `{user_id, source_hash}`.

---

### 4.13 WritingAgent

- **Job:** draft SOP, PS, short answers, cover letters, outreach, and tailored resume/CV variants.
- **Inputs:** prompt, program evidence, opportunity evidence, contact context (if outreach), story bank, voice anchor.
- **Outputs:** `draft` + critic notes + fact-check report + style report.
- **Tools:** draft model (Opus), critic model (Sonnet, different prompt), fact-check deterministic mapper, style-check heuristics.
- **Current priority:** after onboarding-memory and discovery are stable.
- **Loop:** draft → critic → rewrite → fact-check → style-check.
- **Rules:** factually verifiable claims must map to story bank or profile; otherwise draft is rejected.
- **Escalation:** draft unable to pass fact-check after 2 rewrites → user input needed.
- **Failure modes:** generic tone; invented achievements; template leak across programs.
- **Confidence:** style score + originality score + fact-check pass.
- **Idempotency:** `{prompt_id, profile_revision_id, story_bank_hash, program_evidence_hash}`.

---

### 4.14 ApplicationExecutionAgent

- **Job:** drive portals; fill forms; save drafts; capture state.
- **Inputs:** application payload (profile slice, drafts, files), portal binding.
- **Outputs:** section-by-section state + Playwright trace URL + validation errors + submission preview.
- **Tools:** portal adapter (via the Playwright worker).
- **Current priority:** intentionally deferred until onboarding, discovery, writing, and checklist preparation are reliable locally.
- **Rules:**
  - Auto-fill: identity, education, tests, short demographics.
  - Prepare-only: essays, short answers, portfolio links, anything flagged `needs_user_review`.
  - **Never clicks submit.** Emits `submission.ready` → user approval → proxy click.
- **Escalation:** unresolvable validation error → pause with screenshot.
- **Failure modes:** portal drift; dropdown mismatches; file-format rejections.
- **Confidence:** per-field; aggregate reported in the submission preview.
- **Idempotency:** `{program_id, cycle_id, section_id}`.

---

### 4.15 RecommendationCoordinator

- **Job:** manage the recommender workflow (portal emails recommenders directly).
- **Outputs:** per-recommender status: `invited`, `accepted`, `submitted`, `overdue`.
- **Tools:** portal adapter, email parser (user-consented inbox integration).
- **Rules:** **never contact a recommender on the user's behalf** without a per-recommender user approval.
- **Escalation:** recommender overdue → drafts polite nudge (approval-gated).
- **Failure modes:** recommender email bounce; wrong address.
- **Confidence:** per-recommender status.
- **Idempotency:** `{application_id, recommender_id}`.

---

### 4.16 OutreachStrategyAgent

- **Job:** decide whether to draft outreach and to whom; draft the message.
- **Inputs:** contact, program, opportunity context, user preferences, policy flags (e.g., "do not email faculty").
- **Outputs:** outreach draft + rationale + evidence (paper/project cited) + recommended channel.
- **Rules:**
  - MVP: drafts only, sending disabled.
  - Policy filter rejects drafts during review season for admissions-committee roles.
  - One clear ask per message; ≤180 words.
  - Never flatters; never hyperbolizes.
- **Escalation:** contact below 0.85 confidence → do not draft.
- **Failure modes:** generic template; wrong person; stale role.
- **Confidence:** contact match × evidence specificity × timing fit.
- **Idempotency:** `{contact_id, program_id, context_hash}`.

---

### 4.17 ApprovalCheckpointAgent

- **Job:** construct approval items and pause workflows.
- **Inputs:** action type + payload + evidence + confidence + default decision.
- **Outputs:** `approval_request` row + in-app notification + email.
- **Rules:** emergency stop cancels all pending; quiet hours respected for non-critical.
- **Escalation:** approval not decided within SLA → escalate notification channel.
- **Idempotency:** `{workflow_run_id, checkpoint_id}`.

---

### 4.18 DeadlineMonitorAgent

- **Job:** schedule refreshes + escalations; surface urgency.
- **Outputs:** urgency-flagged program list; refresh jobs.
- **Rules:** 14/7/3/1-day escalations before any priority/funding deadline.
- **Idempotency:** `{program_id, deadline_id, horizon}`.

---

### 4.19 FollowUpAgent

- **Job:** post-submission status checks, decision tracking, polite follow-ups.
- **Inputs:** submitted application records; email inbox signals (user-consented).
- **Outputs:** status updates; draft follow-ups (approval-gated).
- **Rules:** never contacts external parties without approval.
- **Idempotency:** `{application_id, followup_type, horizon}`.

---

## 5. Tooling Catalog (shared across agents)

| Tool | Purpose | Used by |
|---|---|---|
| `search.web` (Tavily/Exa) | open web search | Discovery, Funding, Contacts |
| `search.scholar` (SerpAPI) | Google Scholar | Contacts, Program Qual |
| `crawl.page` (Firecrawl) | HTML→MD crawl | All crawlers |
| `crawl.pdf` (pdfplumber) | PDF→MD | Requirements, Funding |
| `extract.schema(zod)` | structured extraction via AI Gateway | Extraction agents |
| `classify.funding(taxonomy)` | deterministic phrase match | Funding Class |
| `enrich.linkedin` (Proxycurl) | approved LinkedIn data | Profile Enrichment |
| `vault.credential_ref` | vault reference (never raw) | Application Execution |
| `portal.adapter(<vendor>)` | portal driver | App Execution |
| `mail.draft` | compose email | Outreach, Follow-up |
| `mail.send` | send via Resend | (gated by approval only) |
| `notify.user` | in-app + email + SMS | Approval Agent |
| `llm.draft` | Opus model | Writing |
| `llm.critique` | Sonnet model (different prompt) | Writing |
| `llm.extract` | Sonnet model | Extraction |
| `llm.classify` | Haiku model | Classification |

Tool whitelists are enforced per agent in the contract.

---

## 6. Handoff Matrix

| Emitter | Event | Consumer(s) |
|---|---|---|
| UniversityDiscovery | `university.qualified` | ProgramQualification |
| ProgramQualification | `program.qualified` | Requirements, Fee, Funding, Portal, Contact |
| Funding | `funding.discovered` | FundingClassification |
| Contact | `contact.pending_enrichment` | ProfileEnrichment |
| Writing | `draft.ready` | ApprovalCheckpoint (for SOP/PS) |
| AppExecution | `section.complete` / `submission.ready` | ApprovalCheckpoint |
| Outreach | `outreach.draft_ready` | ApprovalCheckpoint (send disabled in MVP) |
| Recommendation | `recommender.invite_ready` | ApprovalCheckpoint (per recommender) |
| Any agent | `work.failed` | Coordinator |

---

## 7. Escalation Matrix

| Condition | Action |
|---|---|
| Evidence requirement not met | Reject output; do not persist. |
| Confidence < 0.5 on critical field (deadline/fee/funding_class) | Pause; request user confirmation. |
| Data-provider ToS flag raised | Halt that provider; surface in [risks.md](risks.md); notify user. |
| Portal adapter drift detected | Pause automation; require one user confirmation of field mapping. |
| Two viable contacts for a role | Keep distinct; do not bind. |
| Two conflicting deadlines | Store both; surface diff; do not pick silently. |
| Emergency stop triggered | Cancel all workflows; log out of portals; flush queued approvals. |

---

## 8. Anti-Hallucination Rules (System-Level)

- **No unsourced facts.** Extractor output without `quoted_source` fails Zod.
- **No cross-program leaks.** Writing agent's context per draft is isolated; prior drafts are not implicit context.
- **Different critic.** Critic uses a different model + different prompt than the drafter.
- **Deterministic post-check.** Every draft's verifiable claims are mapped to the story bank / profile; unmapped = reject.
- **No silent schema coercion.** If a field can't be parsed, it's `null` + `reason`, never a best-guess.
- **No LLM date parsing without a regex sanity check.**
- **No LLM currency parsing without a regex sanity check.**

---

## 9. Agent Failure Handling

- **Transient external errors** (429, 503, timeout): Inngest step retries with exponential backoff + jitter (max 5).
- **Permanent errors** (404, 401 after re-auth, schema violation): emit `work.failed`; Coordinator either retries with different tool or escalates to user.
- **LLM ambiguity**: drop confidence, mark `unclear`, proceed without the field.
- **Data-provider outages**: fall back to internal-only use (e.g., skip LinkedIn enrichment, keep directory contact).

---

## 10. When to Add a New Agent

Add a new agent when:

- A responsibility does not cleanly fit in any existing agent.
- Adding it to an existing agent would violate single-responsibility or inflate the tool whitelist.
- It has distinct inputs/outputs and its own failure modes.

Do **not** add a new agent when:

- The functionality is a helper function.
- The functionality is a variant of an existing agent's behavior (add a branch inside the agent instead).

Every new agent must:

1. Have a contract file.
2. Have an entry in this file.
3. Be emitted/consumed through Coordinator events, not direct calls.
4. Be registered with observability spans.

---

*Last updated: initial creation.*
