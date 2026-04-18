import { dbClient } from "../db/client";

/**
 * Validates that a write into an external-world entity carries at least one
 * evidence row resolving to a real, subject-matching evidence record.
 *
 * Per CLAUDE.md §8 invariant 4 ("no unsourced facts") and
 * schemas.md §8.1 ("every evidence_id in the array must resolve to a real
 * evidence row with subject_type matching the table and subject_id matching
 * the row id").
 */
export interface EvidenceBinding {
  subjectType: string;
  subjectId: string;
  evidenceIds: readonly string[];
}

export class MissingEvidenceError extends Error {
  public readonly subjectType: string;
  public readonly subjectId: string;
  public readonly detail: string;

  constructor(subjectType: string, subjectId: string, detail: string) {
    super(
      `Evidence requirement violated for ${subjectType}:${subjectId} — ${detail}`
    );
    this.name = "MissingEvidenceError";
    this.subjectType = subjectType;
    this.subjectId = subjectId;
    this.detail = detail;
  }
}

export function assertEvidenceBinding(binding: EvidenceBinding): void {
  if (binding.evidenceIds.length === 0) {
    throw new MissingEvidenceError(
      binding.subjectType,
      binding.subjectId,
      "evidenceIds[] is empty."
    );
  }

  for (const evidenceId of binding.evidenceIds) {
    const row = dbClient.get("evidence", evidenceId);

    if (!row) {
      throw new MissingEvidenceError(
        binding.subjectType,
        binding.subjectId,
        `evidence ${evidenceId} does not exist.`
      );
    }

    if (row.subjectType !== binding.subjectType) {
      throw new MissingEvidenceError(
        binding.subjectType,
        binding.subjectId,
        `evidence ${evidenceId} has subjectType "${row.subjectType}", expected "${binding.subjectType}".`
      );
    }

    if (row.subjectId !== binding.subjectId) {
      throw new MissingEvidenceError(
        binding.subjectType,
        binding.subjectId,
        `evidence ${evidenceId} has subjectId "${row.subjectId}", expected "${binding.subjectId}".`
      );
    }
  }
}

export interface AuditMissingEvidenceReport {
  subjectType: string;
  subjectId: string;
  title: string;
  reason: string;
}

export interface EvidenceAuditInput {
  subjectType: string;
  subjectId: string;
  title: string;
  evidenceIds: readonly string[];
}

/**
 * Non-throwing variant: returns a list of violations instead of raising.
 * Useful for the IntegrationAuditSubagent step so we can surface every
 * offender rather than bailing on the first one.
 */
export function auditEvidenceBindings(
  entries: readonly EvidenceAuditInput[]
): AuditMissingEvidenceReport[] {
  const violations: AuditMissingEvidenceReport[] = [];

  for (const entry of entries) {
    try {
      assertEvidenceBinding({
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        evidenceIds: entry.evidenceIds
      });
    } catch (error) {
      if (error instanceof MissingEvidenceError) {
        violations.push({
          subjectType: entry.subjectType,
          subjectId: entry.subjectId,
          title: entry.title,
          reason: error.detail
        });
      } else {
        throw error;
      }
    }
  }

  return violations;
}
