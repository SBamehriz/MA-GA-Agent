# schemas.md — Implementation-Ready Schema Design

> Drizzle/Postgres schema design derived from [data-model.md](data-model.md). Tables, enums, relationships, indexes, append-only rules, versioning, approval entities, audit requirements, credential invariants.
>
> Not final production code. Source of truth for entities and constraints is still [data-model.md](data-model.md); this file turns that model into implementation directions.
>
> Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Schema Conventions

- **Database:** local-first Postgres-compatible schema. Hosted Postgres remains optional; `pgvector` is only required once voice-anchor similarity is activated.
- **ORM:** Drizzle.
- **IDs:** UUIDv7 (`uuid` column, generated server-side via `uuidv7()` helper).
- **Timestamps:** `timestamptz`, default `now()`.
- **Enums:** Native Postgres enums. One enum per file under `packages/db/enums.ts`; additions are additive only.
- **Evidence:** Every interpreted-fact table has `evidence_id uuid[] NOT NULL` with a CHECK `array_length(evidence_id, 1) >= 1`.
- **Append-only tables** (see §4) never expose UPDATE/DELETE in Drizzle queries; they are INSERT-only at the application layer and enforced by Postgres roles.
- **Versioned tables** (see §5) use `valid_from` / `valid_to`; supersession creates a new row.
- **Soft delete** only for user-scoped content (profile revisions); external-world entities are not soft-deleted.
- **FK discipline:** within a cross-user entity, use real FKs. Evidence cross-table references (polymorphic `subject_type`/`subject_id`) are resolved in application code; no polymorphic FK in SQL.
- **Naming:** snake_case tables + columns; singular table names.

---

## 2. Enums

All enums are Postgres enums, narrow and versioned.

| Enum | Values |
|---|---|
| `source_type` | `admissions_page`, `department_page`, `pdf`, `lab_page`, `directory`, `scholar`, `linkedin`, `news`, `aggregator`, `user_attested` |
| `relevance_class` | `core`, `adjacent`, `tangential`, `rejected` |
| `degree_type` | `MS`, `MEng`, `MSE`, `MASc`, `MPS`, `MSCS`, `other` |
| `modality` | `in_person`, `online`, `hybrid` |
| `thesis_option` | `required`, `optional`, `none`, `unknown` |
| `cycle_state` | `open`, `closed`, `rolling` |
| `deadline_type` | `priority`, `final`, `funding_consideration`, `international`, `rolling` |
| `gre_policy` | `required`, `optional`, `waived`, `not_accepted`, `unknown` |
| `funding_host_type` | `grad_school`, `department`, `lab`, `external_unit` |
| `funding_class` | `full_tuition_plus_stipend`, `full_tuition_only`, `partial_tuition`, `stipend_only`, `fee_reduction_only`, `case_by_case`, `unclear` |
| `stipend_period` | `academic_year`, `calendar_year`, `per_semester`, `monthly`, `unknown` |
| `tuition_coverage` | `full`, `partial`, `none`, `unknown` |
| `portal_vendor` | `slate`, `collegenet`, `liaison_gradcas`, `applyweb`, `embark`, `custom_banner`, `custom_other`, `generic` |
| `auth_model` | `email_password`, `sso`, `oauth` |
| `role_tag` | `professor`, `pi`, `dgs`, `coordinator`, `hr`, `lab_manager`, `staff`, `other` |
| `application_status` | `queued`, `preparing`, `draft_saved`, `awaiting_user`, `submitted`, `confirmed`, `declined_by_user`, `skipped`, `error` |
| `artifact_kind` | `sop`, `ps`, `short_answer`, `cv`, `cover_letter` |
| `approval_action_type` | `submit_application`, `pay_fee`, `send_email`, `send_linkedin_msg`, `request_recommender`, `finalize_essay`, `attest_profile`, `create_account`, `approve_batch`, `resume_session_2fa`, `confirm_field_mapping`, `confirm_conflict`, `approve_outreach` |
| `approval_default_action` | `approve`, `edit`, `skip` |
| `approval_status` | `pending`, `approved`, `edited`, `skipped`, `expired` |
| `actor_type` | `system`, `user` |
| `action_outcome` | `success`, `failure`, `partial` |
| `idempotency_status` | `reserved`, `completed`, `failed` |
| `vault_provider` | `onepassword`, `bitwarden`, `user_session` |
| `profile_source_document_kind` | `resume`, `transcript`, `voice_sample`, `other` |
| `essay_tag` | `sop`, `ps`, `diversity`, `research`, `why_program` |
| `test_type` | `GRE`, `GRE_subject`, `TOEFL`, `IELTS`, `DET` |

---

## 3. Core Tables

### 3.1 `user`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `uuidv7()` |
| `email` | `text` | UNIQUE, nullable for purely local runs |
| `active_revision_id` | `uuid` | FK → `user_profile_revision.id`, nullable until first revision |
| `preferences_json` | `jsonb` | NOT NULL default `{}` |
| `quiet_hours` | `jsonb` | NOT NULL default `{ "start": "22:00", "end": "08:00", "tz": "America/Chicago" }` |
| `created_at` / `updated_at` | `timestamptz` | defaults |

**Rule (MVP single-tenant):** application-level check limits `user` row count to 1. No auth provider is required for the first local block. No raw credentials in `preferences_json` (see §9).

---

### 3.2 `user_profile_revision` (append-only)

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `user.id` |
| `created_at` | `timestamptz` | default `now()` |
| `attested_at` | `timestamptz` | nullable; set when user attests |
| `superseded_by` | `uuid` | FK → `user_profile_revision.id`, nullable |

No UPDATE except `attested_at` (one-time) and `superseded_by` (one-time). Enforced via trigger.

Child tables (all scoped by `revision_id`, all INSERT-only after revision attested):

- `profile_identity`
- `profile_visa_status`
- `profile_academic_history`
- `profile_transcript_courses`
- `profile_project`
- `profile_experience`
- `profile_skills`
- `profile_publications`
- `profile_awards`
- `profile_tests`
- `profile_portfolio`
- `profile_recommender`
- `profile_source_document`

Field shape per [data-model.md §4.2](data-model.md). Each child table has `(revision_id, ord)` sort key.

---

### 3.2a `profile_source_document`

Tracks the user-owned materials ingested during onboarding before any writing or application prep occurs.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK |
| `revision_id` | `uuid` | FK → `user_profile_revision.id` |
| `kind` | `profile_source_document_kind` | NOT NULL |
| `label` | `text` | NOT NULL |
| `storage_ref` | `text` | NOT NULL |
| `media_type` | `text` | NOT NULL |
| `content_hash` | `text` | NOT NULL |
| `extracted_text` | `text` | nullable |
| `metadata_json` | `jsonb` | NOT NULL default `'{}'::jsonb` |
| `created_at` | `timestamptz` | default `now()` |

Indexes:
- `(revision_id, kind, created_at DESC)`
- `(content_hash)`

---

### 3.3 `story`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK |
| `revision_id` | `uuid` | FK → `user_profile_revision.id` |
| `title` | `text` | NOT NULL |
| `summary` | `text` | NOT NULL |
| `proof_points` | `text[]` | NOT NULL, `array_length >= 1` |
| `themes` | `text[]` | NOT NULL |
| `source_refs` | `text[]` | ids of profile fields and/or `profile_source_document` rows referenced |
| `verified_by_user` | `boolean` | NOT NULL default `false` |

**Invariant:** writing artifacts cannot reference a `story` where `verified_by_user = false`. Enforced in `packages/writing/fact-check.ts` and reinforced by a DB VIEW that exposes only verified stories to the writing layer.

---

### 3.4 `voice_anchor`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK |
| `sample_text` | `text` | NOT NULL |
| `embedding` | `vector(1536)` | nullable until style similarity is enabled |
| `model_name` | `text` | nullable; embedding model identifier when present (pinned per [risks.md R25](risks.md)) |
| `created_at` | `timestamptz` | |

Index: HNSW on `embedding` per [data-model.md §9](data-model.md) when embeddings are enabled.

---

### 3.5 `vault_reference`

**Never stores raw credentials.** Only opaque handles.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK |
| `portal_id` | `text` | |
| `provider` | `vault_provider` | |
| `reference_key` | `text` | opaque |

**Invariant:** column-level CHECK disallows anything resembling a password pattern in `reference_key`. Log redaction library scrubs by key name.

---

## 4. Append-Only Tables

These tables are INSERT-only at the application layer and enforced by:

1. Drizzle query wrappers that expose `.insert()` only.
2. Postgres role with `SELECT, INSERT` but no `UPDATE, DELETE` for the application user.
3. A trigger that raises on any non-INSERT.

| Table | Purpose |
|---|---|
| `evidence` | Every interpreted fact's supporting snippet. |
| `action_log` | Every external-facing action. |
| `evidence_events` | (Optional) supersession markers for facts. |
| `extraction_attempt` | One row per extractor invocation (success or failure). |
| `idempotency_ledger` | Reservations and outcomes for side-effect keys (`status` column updates allowed via a whitelisted function only). |

---

### 4.1 `evidence`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `subject_type` | `text` | NOT NULL |
| `subject_id` | `uuid` | NOT NULL |
| `source_url` | `text` | NOT NULL |
| `source_type` | `source_type` | NOT NULL |
| `quoted_text` | `text` | NOT NULL, CHECK `length(quoted_text) > 0` |
| `fetched_at` | `timestamptz` | NOT NULL |
| `content_hash` | `text` | NOT NULL |
| `crawler_id` | `text` | NOT NULL |
| `source_quality_score` | `numeric(3,2)` | NOT NULL CHECK between 0 and 1 |
| `created_at` | `timestamptz` | default `now()` |

Indexes:
- `(subject_type, subject_id)`
- `(content_hash)`
- `(fetched_at DESC)`

---

### 4.2 `action_log`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `actor` | `actor_type` | NOT NULL |
| `user_id` | `uuid` | FK nullable (null for system-wide actions) |
| `action_type` | `text` | NOT NULL |
| `target_ref` | `jsonb` | NOT NULL |
| `payload_hash` | `text` | NOT NULL |
| `idempotency_key` | `text` | UNIQUE NOT NULL |
| `outcome` | `action_outcome` | NOT NULL |
| `outcome_detail` | `jsonb` | |
| `created_at` | `timestamptz` | |

Retention: 365 days for user-scoped rows (see [data-model.md §12](data-model.md)); external-entity rows kept.

Indexes:
- `(user_id, created_at DESC)`
- `(idempotency_key)` UNIQUE

---

### 4.3 `extraction_attempt`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `agent_name` | `text` | NOT NULL |
| `agent_version` | `text` | NOT NULL |
| `subject_type` | `text` | NOT NULL |
| `subject_id` | `uuid` | |
| `input_hash` | `text` | NOT NULL |
| `model` | `text` | NOT NULL |
| `tokens_in` / `tokens_out` | `int` | |
| `latency_ms` | `int` | |
| `outcome` | `action_outcome` | NOT NULL |
| `error_class` | `text` | nullable |
| `created_at` | `timestamptz` | |

Used for per-agent regression and cost tracking.

---

### 4.4 `idempotency_ledger`

| Column | Type | Constraints |
|---|---|---|
| `key` | `text` | PK |
| `action_type` | `text` | NOT NULL |
| `user_id` | `uuid` | FK nullable |
| `status` | `idempotency_status` | NOT NULL |
| `result_ref` | `jsonb` | |
| `created_at` | `timestamptz` | |
| `completed_at` | `timestamptz` | nullable |

Key formula: `sha256(user_id + action_type + target_id + payload_hash)` per [architecture.md §8.1](architecture.md).

---

## 5. Versioned Tables

Use `valid_from` / `valid_to`; supersession creates a new row with `valid_from = now()`; old row gets `valid_to = now()`.

| Table | Versioned fields of interest |
|---|---|
| `application_deadline` | `deadline_date`, `deadline_time`, `tz`, `applicability` |
| `fee_policy` | `amount`, `waiver_available`, waiver fields |
| `requirement_set` | all |
| `funding_opportunity` | `funding_class`, `stipend_amount`, `tuition_coverage`, `deadline_date` |
| `essay_prompt` | `text`, `word_limit` |
| `portal_binding` | `application_url`, `vendor` |

Application queries default to `WHERE valid_to IS NULL`. Applications reference the specific version row used at submission time (stored as FK in `application_artifact` / `application_section_state`).

Index pattern per versioned table: partial index on `(program_id) WHERE valid_to IS NULL`.

---

## 6. External-World Tables

### 6.1 `university`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `canonical_name` | `text` | NOT NULL |
| `aliases` | `text[]` | NOT NULL default `{}` |
| `ipeds_id` | `text` | nullable |
| `country` | `text` | NOT NULL |
| `state` | `text` | nullable |
| `tier_tag` | `text` | nullable |
| `primary_domain` | `text` | NOT NULL |
| `created_at` / `last_verified_at` | `timestamptz` | |

Unique: `(canonical_name)`. Indexes: `(primary_domain)`, `(country, state)`.

### 6.2 `school_or_college`

| Column | Type |
|---|---|
| `id`, `university_id (FK)`, `name` | — |

### 6.3 `department`

| Column | Type |
|---|---|
| `id`, `school_id`, `university_id`, `name`, `website`, `admissions_url`, `staff_directory_url` | — |

### 6.4 `graduate_program`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `department_id` | `uuid` | FK |
| `title` | `text` | NOT NULL |
| `aliases` | `text[]` | |
| `degree_type` | `degree_type` | |
| `modality` | `modality` | |
| `credit_count` | `int` | nullable |
| `thesis_option` | `thesis_option` | |
| `concentration` | `text` | nullable |
| `curriculum_url` | `text` | |
| `relevance_class` | `relevance_class` | |
| `active` | `boolean` | default `true` |
| `last_verified_at` | `timestamptz` | |
| `evidence_id` | `uuid[]` | NOT NULL, CHECK length ≥1 |

Index: `(department_id, relevance_class, active)`.

### 6.5 `admissions_cycle`

| Column | Type |
|---|---|
| `id`, `program_id`, `term`, `state (cycle_state)` | — |

### 6.6 `application_deadline`

Per [data-model.md §5.6](data-model.md). Evidence required. Index `(cycle_id, type, deadline_date)` partial on `valid_to IS NULL`.

### 6.7 `fee_policy`

Per [data-model.md §5.7](data-model.md). `amount` CHECK between 0 and 10000 (USD-equivalent plausibility) per [data-model.md §10](data-model.md).

### 6.8 `requirement_set`, `essay_prompt`

Per [data-model.md §5.8–5.9](data-model.md). `gpa_floor` CHECK between 0 and 5.0 (scale-agnostic floor).

### 6.9 `funding_opportunity`

Per [data-model.md §5.10](data-model.md). Hard rule: `funding_class IN ('full_tuition_plus_stipend','full_tuition_only')` requires at least one evidence row where `quoted_text` matches an approved phrase (enforced at application layer via taxonomy matcher in `packages/classifiers/funding-taxonomy.ts`).

### 6.10 `portal_binding`

Per [data-model.md §5.12](data-model.md). One row per program.

### 6.11 `professor`, `graduate_director`, `department_coordinator`, `hiring_contact`, `lab`

All point to a `person` via role tables.

### 6.12 `person` and `person_role`

`person` is canonical; `person_role` records the org/role association with `start_date` / `end_date` and `evidence_id`. Person merges tracked via `merged_into`.

### 6.13 `linkedin_profile`, `professional_profile`

Confidence columns required. No direct LinkedIn scraping — `linkedin_profile.id` populated only from approved provider data.

### 6.14 `field_candidate`

For unresolved multi-source disagreements.

| Column | Type |
|---|---|
| `id`, `subject_type`, `subject_id`, `field_name`, `candidate_value (jsonb)`, `evidence_id[]`, `score`, `chosen (bool nullable)` | — |

Rule: critical fields (`deadline_date`, `fee_amount`, `funding_class`, `tuition_coverage`) are never chosen automatically if the top two candidates are within 0.1 score. An approval row is created instead.

---

## 7. Application Runtime Tables

### 7.1 `application`

Per [data-model.md §6.1](data-model.md). UNIQUE `(user_id, program_id, cycle_id)` to prevent duplicates (R11).

### 7.2 `application_section_state`

Per-section status + DOM snapshot reference.

### 7.3 `application_artifact`

Per [data-model.md §6.3](data-model.md). `content_ref` points to a local file path or later storage handle; `draft_version` increments; `approved_by_user_at` set only by an approval resolution.

### 7.4 `approval_request`

Per [data-model.md §6.4](data-model.md). Status transitions enforced by function:

```
pending → (approved | edited | skipped | expired)
```

Once terminal, no transitions. Trigger enforces.

### 7.5 `action_log`, `idempotency_ledger`

See §4.

---

## 8. Evidence & Provenance (detailed)

### 8.1 Evidence-attachment invariants

For every interpreted-fact table (`graduate_program`, `fee_policy`, `application_deadline`, `requirement_set`, `essay_prompt`, `funding_opportunity`, `portal_binding`, `professor`, `lab`, `person_role`):

```
CHECK (array_length(evidence_id, 1) >= 1)
```

Plus an application-layer invariant (in `packages/evidence/validator.ts`): every `evidence_id` in the array must resolve to a real `evidence` row with `subject_type` matching the table and `subject_id` matching the row id.

### 8.2 `source_quality` (static reference table)

| Column | Type |
|---|---|
| `domain (PK)`, `base_quality (numeric)`, `notes (text)` | — |

Seeded with:
- `.edu` → 0.9
- `.gov` → 0.9
- Approved aggregators → 0.7
- `linkedin.com` (provider-sourced) → 0.6
- `news`, `blog` → 0.4

### 8.3 `provenance` (optional)

Per [data-model.md §2.3](data-model.md). Used for debugging which agent run produced a record.

---

## 9. Credential & Secret Invariants

**Hard rules (enforced at multiple layers):**

1. No column named `password`, `secret`, `credential`, `session_cookie`, `access_token`, `bearer_token`, or similar in any table. CI lint rule forbids such column names in schema diffs.
2. `vault_reference.reference_key` is the only credential-adjacent field and holds opaque handles only.
3. Log redaction library scrubs any JSON key matching `/password|secret|token|cookie|bearer|api[_-]?key/i` before Axiom ingestion.
4. Sentry `beforeSend` hook strips the same keys and truncates large payloads.
5. Environment variables containing secrets are never logged or echoed; `packages/shared/env.ts` does not expose secret names in error messages.

---

## 10. Indexes

### 10.1 Required

| Index | Purpose |
|---|---|
| `graduate_program (department_id, relevance_class, active)` | list query |
| `application_deadline (cycle_id, type, deadline_date) WHERE valid_to IS NULL` | active deadlines |
| `fee_policy (program_id) WHERE valid_to IS NULL` | active fee |
| `funding_opportunity (host_id) WHERE valid_to IS NULL` | active opportunities |
| `evidence (subject_type, subject_id)` | evidence lookup |
| `evidence (content_hash)` | dedupe |
| `action_log (user_id, created_at DESC)` | audit |
| `action_log (idempotency_key)` UNIQUE | duplicate protection |
| `approval_request (user_id, status, created_at DESC)` | queue |
| `idempotency_ledger (key)` UNIQUE PK | side-effect dedupe |
| `voice_anchor.embedding` HNSW | style-check |
| `university (primary_domain)` | crawler scoping |
| `university (country, state)` | filters |

### 10.2 Considered

- Trigram index on `person.canonical_name` for fuzzy person matching.
- GIN on `profile_preferences` JSON keys if preference queries become hot (deferred).

---

## 11. Freshness SLAs (query-time enforcement)

Implemented in `packages/db/freshness.ts`:

```
isStale(record, recordClass): boolean
```

Query wrappers return `{ record, stale: true }` when past SLA. Action-layer refuses to proceed on stale critical records. SLAs per [data-model.md §3](data-model.md).

Tables tagged with their `volatility_class`:

| Table | Class | SLA (normal) | SLA (near action) |
|---|---|---|---|
| `fee_policy` | medium | 30 d | 14 d |
| `application_deadline` | low far / high near | 60 d | 14 d at ≤30d; weekly ≤14d |
| `funding_opportunity` | high | 30 d | 14 d |
| `funding_classification` | medium | 30 d | tied to opportunity |
| `requirement_set` | low | 120 d | — |
| `person_role` (existence) | medium | 90 d | — |
| `linkedin_profile` | medium | 120 d | 30 d before outreach |
| `portal_binding` | low | 180 d | — |

---

## 12. Audit Requirements

- **Action log:** every external side-effect (submit_application, pay_fee, send_email, send_linkedin_msg, request_recommender, create_account, approve_batch) inserts exactly one `action_log` row with the idempotency key.
- **Approval audit:** every `approval_request` decision produces a corresponding `action_log` entry with `actor = 'user'` and the decision stored in `outcome_detail`.
- **Profile versioning:** applications reference the `profile_revision_id` in effect at submission; deleting a revision is disallowed if any application references it.
- **Evidence versioning:** `evidence` rows are never deleted; supersession is additive.

---

## 13. Data Export & Deletion

- **Export:** `scripts/export-user.ts` produces a JSON bundle: `{ user, profile_revisions, stories, applications, artifacts, approvals, action_log }` plus signed Blob URLs.
- **Delete:** cascades user-scoped rows; external-world entities untouched; `action_log` trimmed to last 90 days on delete request (retain audit for 365 days otherwise).
- **Correction:** `profile_correction_note` append-only table stores user-attached notes without mutating historic revisions.

---

## 14. Migration Discipline

- Drizzle migrations in `packages/db/migrations/`.
- No hand-edited prod SQL.
- Enum additions are additive; enum values are never removed (deprecated ones marked in code comments and stop being produced by agents).
- Rename: alias table for one cycle before drop.
- Risky migrations run on a Neon branch first; promoted after validation.

---

## 15. Open Questions

- Should `profile_preferences` be a first-class table instead of `user.preferences_json`? **Safe default for MVP:** keep as JSON; migrate to table in Phase 6 if we hit query patterns that need indexing on sub-fields.
- Should `evidence_events` be a separate append-only table or derived from `evidence.fetched_at`? **Safe default:** derive for MVP; materialize if we need fast "what changed for this subject" queries.
- Should `person` be split by organization scope to reduce cross-department collisions? **Safe default:** keep canonical `person` + `person_role`; revisit if merges proliferate.
- Should we keep `field_candidate` pre- or post-resolution? **Safe default:** keep both (pre with `chosen = null`, post with `chosen = true`) for auditability.

## Missing Inputs

- Clerk user ID ↔ internal `user.id` mapping strategy. **Safe default:** store Clerk `sub` in `user.clerk_sub` UNIQUE column; internal id remains authoritative inside the schema.
- Whether Neon branching will back every PR preview's DB. **Safe default:** yes for PRs that touch migrations; dev branch shared otherwise.
- Exact embedding model for `voice_anchor`. **Safe default:** one pinned model configured in env; changes trigger re-embedding workflow.

---

*Last updated: initial creation.*
