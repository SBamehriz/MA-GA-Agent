import { createHash } from "node:crypto";

import { dbClient } from "../db/client";
import type { EvidenceSourceType } from "../db/enums";
import { evidenceQueries } from "../db/queries/evidence";
import type { EvidenceRecord, JsonObject } from "../db/schema";

/**
 * URL-anchored evidence for external-world entities (university, program,
 * funding opportunity, person, person_role, professional_profile).
 *
 * CLAUDE.md §5.3 / §8.4: every stored fact carries evidence; evidence must
 * carry a URL, a quoted snippet, and a source type. This helper is the single
 * write path for external evidence — agents that skip it violate the rule.
 */
export interface CreateExternalSourceEvidenceInput {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  quotedText: string;
  subjectType: string;
  subjectId: string;
  sourceQualityScore?: number;
  fetchedAt?: string | null;
  crawlerId?: string | null;
  extra?: JsonObject;
}

const ALLOWED_EXTERNAL_SOURCE_TYPES: readonly EvidenceSourceType[] = [
  "admissions_page",
  "department_page",
  "lab_page",
  "directory",
  "scholar",
  "linkedin_profile",
  "aggregator",
  "news",
  "pdf",
  "user_attested"
];

function contentHashOf(quotedText: string, sourceUrl: string): string {
  return createHash("sha256")
    .update(`${sourceUrl}\n---\n${quotedText}`)
    .digest("hex");
}

function assertAllowedSourceType(sourceType: EvidenceSourceType): void {
  if (!ALLOWED_EXTERNAL_SOURCE_TYPES.includes(sourceType)) {
    throw new Error(
      `External evidence source_type "${sourceType}" is not in the approved list: ${ALLOWED_EXTERNAL_SOURCE_TYPES.join(", ")}`
    );
  }
}

function assertUrl(sourceUrl: string): void {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    throw new Error(
      `External evidence requires a valid http(s) source_url, got "${sourceUrl}".`
    );
  }
}

/**
 * Create a single URL-backed evidence row for an external-world subject.
 * Idempotent via the evidence dedupe key (subject + sourceType + quotedText).
 */
export function createExternalSourceEvidence(
  input: CreateExternalSourceEvidenceInput
): EvidenceRecord {
  assertAllowedSourceType(input.sourceType);
  assertUrl(input.sourceUrl);

  if (!input.quotedText?.trim()) {
    throw new Error(
      `External evidence for ${input.subjectType}:${input.subjectId} requires non-empty quoted_text.`
    );
  }

  const metadata: JsonObject = {
    ...(input.extra ?? {}),
    source_url: input.sourceUrl,
    content_hash: contentHashOf(input.quotedText, input.sourceUrl),
    crawler_id: input.crawlerId ?? "local_seed",
    source_quality_score: input.sourceQualityScore ?? 0.8,
    fetched_at: input.fetchedAt ?? dbClient.now()
  };

  return evidenceQueries.create({
    quotedText: input.quotedText,
    sourceLabel: input.sourceLabel,
    sourceRef: input.sourceUrl,
    sourceType: input.sourceType,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    metadata
  });
}

/**
 * Create one or more evidence rows for the same subject in one call.
 * Returns the resulting evidence ids for use in `evidenceIds` columns.
 */
export function createExternalSourceEvidenceBatch(
  inputs: readonly CreateExternalSourceEvidenceInput[]
): string[] {
  return inputs.map((input) => createExternalSourceEvidence(input).id);
}
