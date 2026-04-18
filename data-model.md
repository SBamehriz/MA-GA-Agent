# data-model.md — Data Model

> User profile + external-world entities + evidence ledger.
> Source: [BLUEPRINT.md §5, §6](BLUEPRINT.md). Owners: [agents.md](agents.md). Storage: [architecture.md](architecture.md) §4.13.

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Conventions

- **Local-first Postgres-compatible model.** Start with a local Postgres-shaped schema and Drizzle-friendly types; hosted Postgres remains an optional later deployment choice.
- **IDs are UUIDv7** (time-ordered, sortable, globally unique).
- **Timestamps** are `timestamptz`, UTC-stored.
- **Enums** are Postgres enums, narrow and versioned.
- **Soft deletes** only for user content (transcripts, profile). Research entities are hard-deleted on rediscovery rejection.
- **Naming:** snake_case tables and columns; singular table names.
- **Evidence is mandatory** for any interpreted fact. A write without `evidence_id[]` fails at the validator.
- **Volatility class** is stored per record class and drives freshness SLAs.
- **Provenance** (where the record came from) is stored separately from evidence (what supports a specific field).

---

## 2. Evidence & Provenance Model

### 2.1 `evidence` (append-only)

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| subject_type | text | `program`, `fee_policy`, `funding_opportunity`, `contact`, etc. |
| subject_id | uuidv7 | FK resolved by app code (no cross-table FK) |
| source_url | text | canonical URL |
| source_type | enum | `admissions_page`, `department_page`, `pdf`, `lab_page`, `directory`, `scholar`, `linkedin`, `news`, `aggregator`, `user_attested` |
| quoted_text | text | the actual snippet that supports the claim (required) |
| fetched_at | timestamptz | |
| content_hash | text | sha256 of normalized fetched content |
| crawler_id | text | which crawl run produced it |
| source_quality_score | numeric | 0–1 at ingestion |
| created_at | timestamptz | |

Append-only; never updated. Supersession handled by newer evidence rows pointing at the same subject.

### 2.2 `source_quality` (static)

| Column | Type | Notes |
|---|---|---|
| domain | text PK | e.g., `grad.uga.edu` |
| base_quality | numeric | 0–1; .edu > .gov > aggregator > blog |
| notes | text | |

### 2.3 `provenance` (optional per-entity)

Tracks how the record itself was created, not field-level support. Useful for debugging research runs.

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| subject_type | text | |
| subject_id | uuidv7 | |
| producer_agent | text | |
| producer_version | text | |
| run_id | uuidv7 | |
| created_at | timestamptz | |

---

## 3. Freshness SLAs

SLAs are enforced at query time. A record past SLA is **blocked from use** (UI, scoring, actions) until refreshed.

| Record class | Volatility | SLA (normal) | SLA (near action) |
|---|---|---|---|
| `fee_policy` | medium | 30 days | 14 days before user action |
| `application_deadline` | low far, high near | 60 days far | 14 days at ≤30d out; re-verify weekly at ≤14d |
| `funding_opportunity` | high | 30 days | 14 days before user action |
| `funding_classification` | medium | 30 days | tied to opportunity |
| `requirement_set` | low | 120 days | — |
| `contact` (existence) | medium | 90 days | — |
| `linkedin_profile` | medium | 120 days | 30 days before outreach |
| `portal_binding` | low | 180 days | — |
| `fee_waiver_policy` | medium | 30 days | 14 days before waiver window |

---

## 4. User Domain Model

### 4.1 `user`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| email | text UNIQUE nullable | optional local owner identifier; auth-provider binding can be added later |
| created_at / updated_at | timestamptz | |
| active_revision_id | uuidv7 FK | points to `user_profile_revision` |
| preferences_json | jsonb | merged preferences; see 4.4 |
| quiet_hours | jsonb | { start, end, tz } |

### 4.2 `user_profile_revision` (append-only)

A new revision is created on any material profile change. Applications reference the revision used at submission.

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| user_id | FK | |
| created_at | timestamptz | |
| attested_at | timestamptz | NULL until user attests |
| superseded_by | FK nullable | next revision id |

Child tables (each scoped to revision_id):

#### `profile_identity`
- legal_name, preferred_name, dob, gender (optional), nationality, countries_of_citizenship[], mailing_address_json, phone, emergency_contact_json.

#### `profile_visa_status`
- current_status, prior_us_study, intended_visa_type, transfer_considerations.

#### `profile_academic_history`
- institution, degree, major, minor, gpa, gpa_scale, dates, honors, rank_if_known.

#### `profile_transcript_courses`
- institution_id, course_code, course_title, grade, credits, semester, relevance_tags[].

#### `profile_project`
- title, role, summary, outcome, tech_used[], url_refs[], start_date, end_date, themes[] (for story bank).

#### `profile_experience`
- employer, role, start, end, description, accomplishments[], themes[].

#### `profile_skills`
- category (language / framework / tool), name, years, proficiency.

#### `profile_publications`
- title, venue, authorship (first/co/other), year, url, doi.

#### `profile_awards`
- name, granting_body, year, prestige_note.

#### `profile_tests`
- test_type (GRE/GRE_subject/TOEFL/IELTS/DET), score_json, date, expiry_date, institution_codes_sent_to[].

#### `profile_portfolio`
- url, type (github/personal/portfolio), relevance_note.

#### `profile_recommender`
- name, title, institution, email, relationship, years_known, strength_note, preferred_channel, consent_status.

#### `profile_preferences` (logical — stored in `user.preferences_json`)
- target_countries[], target_states[], tuition_cap, willing_to_pay_fee_max_total, willing_to_pay_fee_per_app, funding_priority_order[], modality_preferences[], thesis_option, pi_named[], research_themes[], approval_batching, outreach_tone, do_not_contact[], writing_voice_sample, phrases_to_avoid[], data_sharing_allowlist[], credential_handling_mode.

#### `profile_source_document`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| user_id | FK | |
| revision_id | FK | |
| kind | enum | `resume`, `transcript`, `voice_sample`, `other` |
| label | text | user-facing label |
| storage_ref | text | local file path, content ref, or future blob handle |
| media_type | text | MIME or coarse file type |
| content_hash | text | dedupe / replay support |
| extracted_text | text nullable | normalized text used during onboarding |
| metadata_json | jsonb | parse metadata, file stats, parser hints |
| created_at | timestamptz | |

#### `story`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| user_id | FK | |
| revision_id | FK | |
| title | text | |
| summary | text | |
| proof_points | text[] | concrete details |
| themes | text[] | e.g., `ownership`, `debugging-under-pressure` |
| source_refs | text[] | profile field ids and/or `profile_source_document` ids this story draws from |
| verified_by_user | bool | REQUIRED `true` before any writing use |

#### `voice_anchor`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| user_id | FK | |
| sample_text | text | 3–5 paragraphs of the user's own writing |
| embedding | vector(1536) nullable | populated when style-similarity checks are enabled |
| model_name | text nullable | embedding model identifier when `embedding` is present |

#### `vault_reference` (no raw credentials, ever)

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| user_id | FK | |
| portal_id | text | |
| provider | enum | `onepassword`, `bitwarden`, `user_session` |
| reference_key | text | opaque handle to the vault entry |

---

## 5. External World Model

### 5.1 `university`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| canonical_name | text | |
| aliases | text[] | |
| ipeds_id | text nullable | |
| country | text | |
| state | text | |
| tier_tag | text | e.g., `R1`, `R2`, `SLAC`, `curated_seed` |
| primary_domain | text | for crawl-scoping |
| created_at / last_verified_at | timestamptz | |

### 5.2 `school_or_college`

- id, university_id, name (e.g., "College of Engineering").

### 5.3 `department`

- id, school_id (or university_id if flat), name, website, admissions_url, staff_directory_url.

### 5.4 `graduate_program`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| department_id | FK | |
| title | text | |
| aliases | text[] | |
| degree_type | enum | `MS`, `MEng`, `MSE`, `MASc`, `MPS`, `MSCS`, `other` |
| modality | enum | `in_person`, `online`, `hybrid` |
| credit_count | int nullable | |
| thesis_option | enum | `required`, `optional`, `none`, `unknown` |
| concentration | text nullable | |
| curriculum_url | text | |
| relevance_class | enum | `core`, `adjacent`, `tangential`, `rejected` |
| active | bool | |
| last_verified_at | timestamptz | |

### 5.5 `admissions_cycle`

- id, program_id, term (e.g., `Fall 2026`), state (`open`/`closed`/`rolling`).

### 5.6 `application_deadline` (versioned)

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| cycle_id | FK | |
| type | enum | `priority`, `final`, `funding_consideration`, `international`, `rolling` |
| deadline_date | date | |
| deadline_time | time nullable | |
| tz | text | |
| applicability | jsonb | e.g., `{ intl: true, funding: true }` |
| valid_from | timestamptz | |
| valid_to | timestamptz nullable | |
| evidence_id | uuid[] | required |

### 5.7 `fee_policy` (versioned)

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| program_id | FK | |
| amount | numeric | |
| currency | text | |
| waiver_available | bool | |
| waiver_workflow_url | text nullable | |
| waiver_deadline | date nullable | |
| waiver_rules | jsonb | |
| valid_from / valid_to | timestamptz | |
| evidence_id | uuid[] | required |

### 5.8 `requirement_set`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| program_id | FK | |
| gpa_floor | numeric nullable | |
| gre_policy | enum | `required`, `optional`, `waived`, `not_accepted`, `unknown` |
| english_policy | jsonb | `{ toefl_min, ielts_min, det_min, waivers[] }` |
| lor_count | int | |
| sop_required | bool | |
| cv_required | bool | |
| portfolio_required | bool | |
| writing_sample_required | bool | |
| prereqs | text[] | |
| valid_from / valid_to | timestamptz | |
| evidence_id | uuid[] | required |

### 5.9 `essay_prompt`

- id, requirement_set_id, text, word_limit, tag (`sop`, `ps`, `diversity`, `research`, `why_program`), evidence_id[].

### 5.10 `funding_opportunity`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| host_type | enum | `grad_school`, `department`, `lab`, `external_unit` |
| host_id | uuidv7 | resolved to graduate_program / department / lab id |
| title | text | |
| description | text | |
| funding_class | enum | (see §5.11) |
| stipend_amount | numeric nullable | |
| stipend_period | enum | `academic_year`, `calendar_year`, `per_semester`, `monthly`, `unknown` |
| tuition_coverage | enum | `full`, `partial`, `none`, `unknown` |
| fte_pct | numeric nullable | |
| eligibility | jsonb | |
| intl_eligible | bool nullable | |
| application_url | text nullable | |
| deadline_date | date nullable | |
| primary_contact_id | FK nullable | |
| valid_from / valid_to / last_verified_at | timestamptz | |
| evidence_id | uuid[] | required |

### 5.11 `funding_class` enum

- `full_tuition_plus_stipend`
- `full_tuition_only`
- `partial_tuition`
- `stipend_only`
- `fee_reduction_only`
- `case_by_case`
- `unclear`

### 5.12 `portal_binding`

| Column | Type | Notes |
|---|---|---|
| program_id | FK PK | |
| vendor | enum | `slate`, `collegenet`, `liaison_gradcas`, `applyweb`, `embark`, `custom_banner`, `custom_other`, `generic` |
| application_url | text | |
| auth_model | enum | `email_password`, `sso`, `oauth` |
| account_creation_url | text nullable | |
| fee_gate_selector_hint | text nullable | |
| upload_specs | jsonb | |
| last_verified_at | timestamptz | |

### 5.13 `professor`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| department_id | FK | |
| name | text | |
| title | text | |
| research_areas | text[] | |
| faculty_page_url | text | |
| scholar_url | text nullable | |
| personal_url | text nullable | |
| active | bool | |
| evidence_id | uuid[] | |

### 5.14 `graduate_director`, `department_coordinator`, `hiring_contact`

All point to a `person` (see 5.17) with role metadata.

### 5.15 `lab`

- id, department_id, pi_person_id, name, url, join_page_url, active, evidence_id[].

### 5.16 `person_role` (history table)

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| person_id | FK | |
| org_type | enum | `university`, `department`, `lab`, `external_unit` |
| org_id | uuidv7 | |
| role | text | free-text with preferred tags |
| role_tag | enum | `professor`, `pi`, `dgs`, `coordinator`, `hr`, `lab_manager`, `staff`, `other` |
| start_date / end_date | date nullable | |
| evidence_id | uuid[] | |

### 5.17 `person`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| canonical_name | text | |
| name_aliases | text[] | |
| preferred_email | text nullable | |
| emails | text[] | |
| primary_org_id | uuidv7 nullable | |
| merged_into | uuidv7 nullable | for person-merge bookkeeping |

### 5.18 `linkedin_profile`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| person_id | FK | |
| url | text | |
| headline | text nullable | |
| institution_match | bool | |
| title_match | bool | |
| photo_match | bool nullable | |
| research_area_overlap | numeric | |
| confidence | numeric | 0–1; ≥0.85 required for outreach binding |
| last_verified_at | timestamptz | |

### 5.19 `professional_profile`

- id, person_id, type (`scholar`, `personal`, `github`, `orcid`), url, verification_signals[], confidence.

### 5.20 `field_candidate`

For ambiguous interpretations where sources disagree.

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| subject_type | text | |
| subject_id | uuidv7 | |
| field_name | text | |
| candidate_value | jsonb | |
| evidence_id | uuid[] | |
| score | numeric | source_quality × freshness |
| chosen | bool | NULL until resolution |

---

## 6. Application Runtime Model

### 6.1 `application`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| user_id | FK | |
| program_id | FK | |
| cycle_id | FK | |
| profile_revision_id | FK | snapshot at submission time |
| status | enum | `queued`, `preparing`, `draft_saved`, `awaiting_user`, `submitted`, `confirmed`, `declined_by_user`, `skipped`, `error` |
| portal_binding | FK | |
| submission_preview_url | text nullable | |
| submitted_at | timestamptz nullable | |
| fee_paid | bool | |
| fee_waived | bool | |

### 6.2 `application_section_state`

- application_id, section_key, section_status, dom_snapshot_ref, validation_errors_json, updated_at.

### 6.3 `application_artifact`

- application_id, kind (`sop`, `ps`, `short_answer`, `cv`, `cover_letter`), content_ref (Blob), draft_version, approved_by_user_at nullable.

### 6.4 `approval_request`

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| user_id | FK | |
| action_type | enum | `submit_application`, `pay_fee`, `send_email`, `send_linkedin_msg`, `request_recommender`, `finalize_essay`, `attest_profile`, `create_account`, `approve_batch`, `resume_session_2fa`, `confirm_field_mapping`, `confirm_conflict`, `approve_outreach` |
| target_ref | jsonb | |
| payload | jsonb | |
| evidence_summary | jsonb | |
| confidence | numeric | |
| default_action | enum | `approve`, `edit`, `skip` |
| status | enum | `pending`, `approved`, `edited`, `skipped`, `expired` |
| decided_by_user_at | timestamptz nullable | |

### 6.5 `action_log` (append-only)

Every external-facing action.

| Column | Type | Notes |
|---|---|---|
| id | uuidv7 PK | |
| actor | enum | `system`, `user` |
| action_type | text | |
| target_ref | jsonb | |
| payload_hash | text | |
| idempotency_key | text UNIQUE | |
| outcome | enum | `success`, `failure`, `partial` |
| outcome_detail | jsonb | |
| created_at | timestamptz | |

### 6.6 `idempotency_ledger`

| Column | Type | Notes |
|---|---|---|
| key | text PK | `sha256(user_id + action + target + payload_hash)` |
| status | enum | `reserved`, `completed`, `failed` |
| result_ref | jsonb nullable | |
| created_at / completed_at | timestamptz | |

---

## 7. Conflict Resolution

- Every disagreeing interpretation is stored as a `field_candidate`.
- Winner is `score = source_quality × freshness_weight`.
- If the top two candidates are within a configurable threshold (e.g., 0.1) → state = `conflict`; an approval item is created.
- Never silently pick on critical fields (deadline, fee, funding_class, tuition_coverage).

---

## 8. Versioning

- Interpreted records (`fee_policy`, `application_deadline`, `requirement_set`, `funding_opportunity`) use `valid_from`/`valid_to`.
- Superseding a record creates a new row; the old row's `valid_to` is set.
- Applications reference the specific version used, so history is preserved even after interpretations change.
- `user_profile_revision` is similarly append-only.

---

## 9. Indexing & Performance

Key indexes:

- `program (department_id, relevance_class, active)`
- `application_deadline (cycle_id, type, deadline_date)` (partial on valid_to IS NULL)
- `fee_policy (program_id)` (partial on valid_to IS NULL)
- `funding_opportunity (host_id, valid_to IS NULL)`
- `evidence (subject_type, subject_id)`
- `action_log (user_id, created_at DESC)`
- `idempotency_ledger (key)` UNIQUE
- `approval_request (user_id, status, created_at DESC)`
- pgvector index on `voice_anchor.embedding` (HNSW)

---

## 10. Validators

Enforced at write time (Drizzle + application layer):

- **Evidence required** on any interpreted field. Rejected otherwise.
- **Quoted text non-empty** in `evidence` rows.
- **Date sanity** — `deadline_date` is in the future at write time for active cycles (warns otherwise).
- **Currency sanity** — `fee_policy.amount` within a plausibility band (0–10,000 USD equivalent).
- **Enum integrity** — text fields that should be enum-classified must resolve before write.
- **FK dignity** — no orphan evidence rows (subject must exist).
- **Story verification gate** — unverified stories cannot be referenced by artifact generation.

---

## 11. Migration & Evolution

- Drizzle migrations; no hand-SQL in prod.
- Entity renames require alias tables maintained for one cycle.
- Dropping a field requires a two-step deprecate → remove across at least two deploys.
- Neon DB branching used for risky migrations; validated before prod promote.

---

## 12. Data Export & Deletion

- **Export:** on request, emit a JSON bundle of the user's profile revisions, stories, applications, artifacts, and approval history. Blob assets included via signed URLs.
- **Delete:** cascade-delete user scope; evidence rows about external-world entities are not deleted (no user PII); action_log rows retained 365 days for audit then pruned.
- **Right to correction:** users can attach correction notes to any profile field; corrections propagate to new revisions, not retroactively.

---

## 13. Data-Sharing Allowlist

Defined in user preferences; enforced at agent boundary.

| Provider | Data class | Default |
|---|---|---|
| Vercel AI Gateway | Prompts containing profile slice | Allowed (no retention) |
| Proxycurl / PDL | Public person identifiers only | Opt-in |
| SerpAPI | Public queries only | Allowed |
| Resend | Email drafts at send time | Allowed |
| Sentry | Error payloads | Redact PII |
| Axiom | Logs | Redact PII |

Violations (a provider receiving disallowed data) trip an immediate halt and surface in [risks.md](risks.md) §privacy.

---

*Last updated: initial creation.*
