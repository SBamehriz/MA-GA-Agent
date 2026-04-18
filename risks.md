# risks.md — Risk Matrix & Runbooks

> Every material risk, how it happens, severity, detection, mitigation, fallback, alerting, and (where useful) a runbook.
> Source: [BLUEPRINT.md §12, §13](BLUEPRINT.md). Approval surfaces: [agents.md](agents.md). Data guards: [data-model.md](data-model.md).

Read [CLAUDE.md](CLAUDE.md) before editing.

---

## 1. Severity Scale

| Level | Meaning |
|---|---|
| **Critical** | User trust is destroyed or irreversible harm is possible. Pagerduty-level. |
| **High** | Wrong-decision risk that the user might act on. Escalate immediately in-app. |
| **Medium** | Fixable inconvenience or eroding quality over time. Surface in dashboard. |
| **Low** | Annoyance, cosmetic, or operational inefficiency. Log. |

---

## 2. Risk Matrix

### R1 — Hallucinated program details

- **How it happens:** LLM fills gaps when source doesn't explicitly state something.
- **Severity:** High.
- **Detection:** Zod schema requires `quoted_source`; evidence validator rejects at write.
- **Mitigation:** All extraction is evidence-required; LLM output without `quoted_source` is rejected before DB write.
- **Fallback:** Mark field `null` with `reason`; queue a follow-up crawl or a user inquiry.
- **Alerting:** Per-field rejection rate tracked; alert if > 5%/day.
- **Runbook:** Re-run extraction with stricter prompt; if systemic, tighten Zod; if LLM consistently invents, drop temperature and switch to specialized prompt.

---

### R2 — Wrong deadline extraction

- **How it happens:** Picking "final" when "funding-consideration" is the real one; last-cycle date cached; timezone missing.
- **Severity:** High (missing deadline = irreversible).
- **Detection:** Two-source rule required for deadlines within 30 days; validator flags solo-source.
- **Mitigation:** DeadlineAgent stores all candidate deadlines; weekly re-verify within 14 days of deadline; tz defaulted to institution's local with explicit flag.
- **Fallback:** If conflicting candidates remain, surface both to user; block auto-progression.
- **Alerting:** In-app + email 14/7/3/1 days before any deadline.
- **Runbook:** If a deadline moves, create new `application_deadline` row (valid_from), mark old one (valid_to); re-verify downstream applications.

---

### R3 — Outdated fee information

- **How it happens:** Page updated; cache served.
- **Severity:** Medium.
- **Detection:** Freshness SLA 30 days (14 days near action); re-fetch on action.
- **Mitigation:** Fee re-verified immediately before any approval item referencing it.
- **Fallback:** If discrepancy at action time, show diff to user; do not proceed on stale value.
- **Alerting:** In-app; email if > $50 delta.
- **Runbook:** Store old fee as superseded; evidence append; user notified.

---

### R4 — Wrong funding interpretation

- **How it happens:** Ambiguous language ("supports qualified students"); soft phrasing.
- **Severity:** High.
- **Detection:** FundingClassificationAgent uses taxonomy-first; LLM fallback only at lower confidence; classes `unclear` and `case_by_case` exist specifically for ambiguity.
- **Mitigation:** Never silently promote `unclear` to `full_*`. Require explicit phrase match for full-tuition claims.
- **Fallback:** Mark `unclear`; queue a contact-discovery follow-up to confirm via outreach (user-approved).
- **Alerting:** In-app badge on every `unclear` funding row.
- **Runbook:** If audit shows systemic over-classification, adjust taxonomy and re-run classification on affected rows.

---

### R5 — False "full tuition" assumption

- **How it happens:** "In-state tuition waiver" misread as full waiver for an international student; "may include tuition" treated as does.
- **Severity:** Critical.
- **Detection:** Phrase-match taxonomy explicitly requires language like "full tuition" and does not accept "may," "typical," "often."
- **Mitigation:** Classifier refuses to output `full_tuition_plus_stipend` or `full_tuition_only` without a matching phrase.
- **Fallback:** Always fall back to `partial_tuition` or `unclear` when language is soft.
- **Alerting:** User prompted to confirm any full-tuition classification before acting.
- **Runbook:** On mis-classification, downgrade every similar row in the affected domain; document phrase in taxonomy deny list.

---

### R6 — Wrong person identified

- **How it happens:** Name collision in a department; stale faculty page; outdated role.
- **Severity:** High.
- **Detection:** Multi-signal match requires ≥2 independent signals (institution + title, or name + dept + research area).
- **Mitigation:** Candidates kept distinct until disambiguated; binding threshold enforced.
- **Fallback:** Keep contact at 0.65 for internal use only; do not bind for outreach.
- **Alerting:** Contact-explorer surfaces confidence + unresolved ambiguity.
- **Runbook:** If wrong-person binding found, revoke the binding, move signals to candidate table, trigger re-discovery.

---

### R7 — Wrong LinkedIn matched

- **How it happens:** Private profiles, stale roles, common names.
- **Severity:** Medium (internal) / High (outreach).
- **Detection:** Outreach requires confidence ≥ 0.85; internal use ≥ 0.65.
- **Mitigation:** Provider-only enrichment; user-confirmed binding before outreach.
- **Fallback:** Fall back to faculty page only; do not use LinkedIn details.
- **Alerting:** User sees confidence next to every LinkedIn match.
- **Runbook:** If mismatch found, delete binding, add user-provided correction, re-enrich.

---

### R8 — Bad outreach judgment (timing or role)

- **How it happens:** Emailing admissions committee during review season; emailing DGS for a web-answered question; flattering email to PI who said "please do not email."
- **Severity:** High (can hurt admission).
- **Detection:** OutreachStrategyAgent applies policy filter (season, role, do-not-contact).
- **Mitigation:** Drafts rejected if policy flag hits; season calendar maintained.
- **Fallback:** Internal note; no draft.
- **Alerting:** In-app explanation for why no draft was generated.
- **Runbook:** If policy misses a case, add rule; re-run filter.

---

### R9 — Generic or weak essays

- **How it happens:** Template leak; overfitting to prompt; no specific program detail; cliché bingo.
- **Severity:** High.
- **Detection:** Style-check (voice anchor similarity, cliché scan, originality).
- **Mitigation:** Per-program personalization budget (≥2 program-specific details grounded in evidence).
- **Fallback:** Rewrite once; if still below threshold, user input requested.
- **Alerting:** Style-check scores shown inline in review UI.
- **Runbook:** Augment cliché list; raise voice-anchor threshold; review specific prompt.

---

### R10 — Accidental false claims in writing

- **How it happens:** Writing agent introduces a fact not in the story bank or profile.
- **Severity:** Critical.
- **Detection:** Deterministic fact-check maps every verifiable claim to story bank / profile; unmapped = reject.
- **Mitigation:** Fact-check blocks before user review.
- **Fallback:** Rewrite with the tagged claim removed; if unable, prompt user.
- **Alerting:** Every fact-check rejection logged; persistent patterns reviewed.
- **Runbook:** Strengthen drafter prompt to require claim-level citation; audit story bank coverage.

---

### R11 — Duplicate applications

- **How it happens:** Re-running workflows without idempotency; portal account-creation attempted twice.
- **Severity:** Medium.
- **Detection:** Idempotency ledger; `application` uniqueness on `(user_id, program_id, cycle_id)`.
- **Mitigation:** Idempotency keys on every external side-effect; DB constraint.
- **Fallback:** Merge application state; never issue a second create attempt against the same portal for the same cycle.
- **Alerting:** Log any idempotency collision.
- **Runbook:** Audit duplicate attempts; resume from last checkpoint.

---

### R12 — Broken browser flows / portal changes

- **How it happens:** Portal vendor redesigns; selectors drift.
- **Severity:** Medium.
- **Detection:** Drift detection via DOM hash diff vs last good run; weekly golden-set regression.
- **Mitigation:** Portal adapter isolation; one-time user-confirmed field mapping refresh on drift.
- **Fallback:** Pause automation; notify user; optionally handoff to manual session.
- **Alerting:** In-app + email on drift detection.
- **Runbook:** Rebuild adapter field mapping with LLM-assisted pass; verify on golden set; unpause.

---

### R13 — Anti-bot blocks / CAPTCHAs

- **How it happens:** Crawl too aggressive; missing residential IPs; captcha on login.
- **Severity:** Medium.
- **Detection:** 429/403 spikes; captcha page detected by adapter.
- **Mitigation:** Per-domain rate limits; sticky sessions; residential IPs via Browserbase where ToS allows; captcha vendor only where permitted.
- **Fallback:** Pause; ping user for manual unblock; queue resume.
- **Alerting:** In-app on first captcha encounter per session.
- **Runbook:** Lower concurrency on affected domain; rotate session carefully; document in per-portal runbook.

---

### R14 — Incorrect recommendation handling

- **How it happens:** Wrong recommender email; premature invite; overdue not followed up.
- **Severity:** High.
- **Detection:** Per-recommender approval required; per-application status machine.
- **Mitigation:** Never contact recommender without per-recommender approval; emails parsed to track status; overdue drafted (approval-gated) as polite nudge.
- **Fallback:** If bounce, prompt user for corrected address.
- **Alerting:** Overdue surfaced at T+14 days.
- **Runbook:** If wrong recommender invited via portal, instruct user to contact admissions for correction; system cannot recall invites.

---

### R15 — Privacy risk (PII leaked to third party)

- **How it happens:** LLM prompt includes private data sent to an unapproved provider; logs leak PII.
- **Severity:** Critical.
- **Detection:** Data-flow allowlist enforced at agent boundary; log redaction; provider response inspection.
- **Mitigation:** All model calls via Vercel AI Gateway (zero-data-retention); per-provider allowlist; log redaction library.
- **Fallback:** Halt offending path; notify user; delete outbound copies where provider supports.
- **Alerting:** Immediate Sentry + email.
- **Runbook:** Rotate any exposed secrets; document incident; notify user; revise allowlist.

---

### R16 — Credential storage risk

- **How it happens:** A dev writes a password to a field; a log captures a login payload; vault reference is leaked.
- **Severity:** Critical.
- **Detection:** DB schema disallows credential columns; log redaction; code review rules.
- **Mitigation:** **No raw credentials anywhere.** Vault integration (1Password / Bitwarden) or user-only sessions.
- **Fallback:** Break-glass rotation across all referenced portals.
- **Alerting:** Immediate.
- **Runbook:** User rotates via vault; system invalidates sessions; audit action_log for misuse.

---

### R17 — Legal / ToS concerns

- **How it happens:** Automated login against a portal that forbids automation; scraping a provider that forbids scraping.
- **Severity:** High.
- **Detection:** Per-domain policy table; provider ToS review.
- **Mitigation:** Approved providers only; user-authenticated sessions for portals that require it; never directly scrape LinkedIn.
- **Fallback:** Manual handoff.
- **Alerting:** Policy review on any new domain.
- **Runbook:** If ToS complaint received, halt automation against that domain; document; review.

---

### R18 — User trust erosion via silent failures

- **How it happens:** Errors swallowed; uncertainty hidden; automation proceeds on stale data.
- **Severity:** High.
- **Detection:** "We don't know" UX required; freshness SLA blocks stale action.
- **Mitigation:** Every approval item shows confidence + evidence + reason; stale records blocked at query.
- **Fallback:** Ask user before assuming.
- **Alerting:** Trust-signal metrics (user survey, override rate).
- **Runbook:** On low-trust signals, reduce automation level by default; increase transparency UX.

---

### R19 — Over-automation (auto-submit regression)

- **How it happens:** A developer connects a submit path; a test bypasses the gate.
- **Severity:** Critical.
- **Detection:** Code review rule; `submit` method does not exist on adapter interface; integration test asserts no external submission in dev.
- **Mitigation:** Interface-level guarantee; proxy-click UX; CI lint rule forbidding `submit` calls outside the approval resolution path.
- **Fallback:** None — must be caught pre-merge.
- **Alerting:** Any attempted auto-submit → Sentry critical.
- **Runbook:** Revert PR; audit; write regression test.

---

### R20 — Stale data acted on

- **How it happens:** Freshness SLA not enforced at action time.
- **Severity:** High.
- **Detection:** Query-layer SLA enforcement; action-time re-verify.
- **Mitigation:** Stale records return `stale` in query; action layer blocks.
- **Fallback:** Trigger refresh; if refresh fails within a window, pause action.
- **Alerting:** Per-record stale-at-action counter.
- **Runbook:** On stale incident, re-verify immediately; review SLA config for that record class.

---

### R21 — Emergency stop not reversible

- **How it happens:** User hits stop; system does not clean state properly on resume.
- **Severity:** Medium.
- **Detection:** Integration tests for stop/resume.
- **Mitigation:** Inngest cancellation API; session logout across portals; flushed approval queue.
- **Fallback:** Manual admin re-enable step documented.
- **Alerting:** Emergency stop event logged.
- **Runbook:** On resume, re-run research sweeps where needed; never silently resume in-flight portal actions.

---

### R22 — Outreach send path activated in MVP

- **How it happens:** A feature flag flipped prematurely.
- **Severity:** Critical.
- **Detection:** Send path physically absent from v1 build; env flag check.
- **Mitigation:** Compile-time exclusion of the send function in v1.
- **Fallback:** None — exclusion is the mitigation.
- **Alerting:** Any attempt to invoke send in v1 throws hard error to Sentry.
- **Runbook:** Revert to MVP build; audit reasons; re-ship.

---

### R23 — Letter of recommendation lost / mishandled

- **How it happens:** Portal emails recommender with wrong link; recommender uploads but portal fails to record.
- **Severity:** High.
- **Detection:** Status machine tracks `invited` → `accepted` → `submitted`.
- **Mitigation:** System does not store letters; portal handles upload; status is polled only if portal supports.
- **Fallback:** If status not reached in time, user prompted to contact admissions.
- **Alerting:** Overdue at T+14.
- **Runbook:** User contacts recommender and admissions directly; system cannot intervene.

---

### R24 — Fee page not detected

- **How it happens:** Portal redesigns the checkout step.
- **Severity:** Critical (user could pay unexpectedly if proxy-click misreads).
- **Detection:** Fee-page fingerprint per portal; generic fallback scans for currency + submit button combo.
- **Mitigation:** Multiple fingerprint signals; conservative "any currency+confirm UI halts" rule.
- **Fallback:** If any ambiguity, halt and require user approval.
- **Alerting:** Immediate.
- **Runbook:** Review per-portal fingerprint; add signals; regression test.

---

### R25 — Embedding / similarity drift in voice anchor

- **How it happens:** Embedding model upgrade shifts similarity scores.
- **Severity:** Low.
- **Detection:** Drift-test on voice-anchor corpus after model change.
- **Mitigation:** Pin embedding model for voice anchor; re-embed on intentional upgrades.
- **Fallback:** Re-capture voice anchor if necessary.
- **Alerting:** Internal-only.
- **Runbook:** Re-embed, recompute thresholds, confirm essays still pass.

---

## 3. Risk → Control Mapping

| Risk ID | Primary control | Secondary control |
|---|---|---|
| R1, R10 | Evidence-required extraction / fact-check | Zod schema + rules validator |
| R2 | Two-source rule + weekly re-verify | Candidate storage + user confirmation |
| R3, R20 | Freshness SLA enforcement | Re-verify at action time |
| R4, R5 | Taxonomy-first classification | Phrase deny list for full-tuition |
| R6, R7 | Multi-signal match threshold | Candidate retention |
| R8 | Outreach policy filter | Season/role calendar |
| R9 | Style-check + voice anchor | Cliché scan, originality score |
| R11 | Idempotency ledger | DB uniqueness |
| R12, R24 | Drift detection + fingerprints | Weekly regression + fee-page guard |
| R13 | Per-domain rate limits + residential IPs | Captcha vendor (where allowed) |
| R14, R23 | Per-recommender approval + status machine | User fallback prompts |
| R15 | Data-flow allowlist | Log redaction |
| R16 | Vault integration | Code review rule |
| R17 | Per-domain policy + provider approval | Legal review checkpoint |
| R18 | Loud-uncertainty UX | Trust metrics |
| R19, R22 | Interface-level absence of `submit` / `send` | CI lint rule |
| R21 | Inngest cancellation + session logout | Integration tests |
| R25 | Pinned embedding model | Re-embed process |

---

## 4. Alert Routing

| Severity | Channel |
|---|---|
| Critical | Sentry → PagerDuty (or equivalent); in-app banner; email + SMS to user |
| High | Sentry; in-app notification; email |
| Medium | Axiom; in-app notification |
| Low | Axiom; log only |

---

## 5. Incident Response Template

When any Critical or High incident fires:

1. Acknowledge in the on-call channel within 15 min.
2. Halt affected workflow(s) via Inngest cancellation.
3. Snapshot evidence + action_log rows relevant to the incident.
4. Notify user if user-visible data is implicated.
5. Patch mitigation or add a new control.
6. Post-mortem within 72h; update this file if a new risk is discovered.

---

## 6. What This File Must Stay In Sync With

- [agents.md](agents.md) — any new agent's failure modes must be added here.
- [data-model.md](data-model.md) — any new field with a volatility class must appear in Freshness SLA controls.
- [architecture.md](architecture.md) — any new external dependency must map to a ToS / privacy / credential risk.
- [mvp.md](mvp.md) — Quality Gates must reference the specific controls documented here.

---

*Last updated: initial creation.*
