import { dbClient } from "../db/client";
import { assertEvidenceBinding, MissingEvidenceError } from "../evidence/validator";

import { claimKindExpectsRefType, flattenClaims, isVerifiableClaim } from "./claims";
import type {
  Claim,
  ClaimGroundingEntry,
  ClaimRef,
  ClaimRefType,
  GroundingReport,
  Section,
  UnsupportedClaim,
  WritingProfileContext,
  WritingTargetContext
} from "./types";

export interface GroundingInput {
  sections: readonly Section[];
  profile: WritingProfileContext;
  target: WritingTargetContext;
}

/**
 * Deterministic fact-check loop for a drafted document.
 *
 * Per agents.md §4.13 + CLAUDE.md §8 invariant 11: every verifiable claim
 * must map to:
 *   - an attested profile_field on the active revision, OR
 *   - a user-verified story, OR
 *   - a source_document on the active revision, OR
 *   - an evidence-backed external row (program / funding / person_role /
 *     professional_profile / university).
 *
 * Unsupported claims are *rejected*, not silently accepted. The caller
 * decides whether the document is `ready` or `grounding_failed`.
 */
export function runGroundingCheck(input: GroundingInput): GroundingReport {
  const claims = flattenClaims(input.sections);
  const unsupported: UnsupportedClaim[] = [];
  const entries: ClaimGroundingEntry[] = [];
  const refsByType: Partial<Record<ClaimRefType, number>> = {};

  let supported = 0;
  let verifiable = 0;
  let stylistic = 0;

  for (const claim of claims) {
    if (!isVerifiableClaim(claim)) {
      stylistic += 1;

      if (claim.kind === "voice_stylistic") {
        const result = resolveClaim(claim, input);
        entries.push(result.entry);
        for (const refType of result.entry.refs.map((r) => r.type)) {
          refsByType[refType] = (refsByType[refType] ?? 0) + 1;
        }
        if (!result.entry.supported) {
          unsupported.push({
            claimId: claim.id,
            slotTag: claim.slotTag,
            kind: claim.kind,
            text: claim.text,
            reason: result.reason ?? "voice-stylistic claim lacks voice_anchor ref"
          });
        }
      } else {
        entries.push({
          claimId: claim.id,
          slotTag: claim.slotTag,
          kind: claim.kind,
          refs: claim.refs,
          resolvedRefs: [],
          supported: true
        });
      }
      continue;
    }

    verifiable += 1;
    const result = resolveClaim(claim, input);
    entries.push(result.entry);

    for (const refType of result.entry.refs.map((r) => r.type)) {
      refsByType[refType] = (refsByType[refType] ?? 0) + 1;
    }

    if (result.entry.supported) {
      supported += 1;
    } else {
      unsupported.push({
        claimId: claim.id,
        slotTag: claim.slotTag,
        kind: claim.kind,
        text: claim.text,
        reason: result.reason ?? "unsupported"
      });
    }
  }

  return {
    supportedClaims: supported,
    unsupportedClaims: unsupported,
    verifiableClaims: verifiable,
    stylisticClaims: stylistic,
    refsByType,
    entries,
    passed: unsupported.length === 0
  };
}

interface ResolvedClaimResult {
  entry: ClaimGroundingEntry;
  reason?: string;
}

function resolveClaim(claim: Claim, input: GroundingInput): ResolvedClaimResult {
  const allowedRefTypes = new Set<ClaimRefType>(claimKindExpectsRefType(claim.kind));
  const resolvedRefs: ClaimGroundingEntry["resolvedRefs"] = [];
  const failureReasons: string[] = [];

  if (claim.refs.length === 0) {
    return {
      entry: {
        claimId: claim.id,
        slotTag: claim.slotTag,
        kind: claim.kind,
        refs: [],
        resolvedRefs: [],
        supported: false
      },
      reason: `claim.kind=${claim.kind} requires at least one ref (${[...allowedRefTypes].join(", ")})`
    };
  }

  for (const ref of claim.refs) {
    if (!allowedRefTypes.has(ref.type)) {
      failureReasons.push(
        `ref ${ref.type}:${ref.id} is not allowed for kind=${claim.kind}`
      );
      continue;
    }

    const resolution = resolveRef(ref, input);
    if (!resolution.ok) {
      failureReasons.push(resolution.reason);
      continue;
    }

    resolvedRefs.push({
      type: ref.type,
      id: ref.id,
      resolved: true,
      note: resolution.note
    });
  }

  const supported =
    resolvedRefs.length > 0 && failureReasons.length === 0;

  const entry = {
    claimId: claim.id,
    slotTag: claim.slotTag,
    kind: claim.kind,
    refs: claim.refs,
    resolvedRefs,
    supported
  };

  if (supported) {
    return { entry };
  }

  return {
    entry,
    reason: failureReasons.join("; ") || "no resolved refs"
  };
}

type RefResolution = { ok: true; note: string } | { ok: false; reason: string };

function resolveRef(ref: ClaimRef, input: GroundingInput): RefResolution {
  switch (ref.type) {
    case "profile_field": {
      const field = input.profile.attestedFields.get(ref.id);
      if (!field) {
        return {
          ok: false,
          reason: `profile_field ${ref.id} is not attested on revision ${input.profile.revisionId}`
        };
      }
      return { ok: true, note: `attested profile_field.${field.fieldKey}` };
    }
    case "story": {
      const story = input.profile.verifiedStories.find((row) => row.id === ref.id);
      if (!story) {
        return {
          ok: false,
          reason: `story ${ref.id} is not user-verified on revision ${input.profile.revisionId}`
        };
      }
      return { ok: true, note: `verified story "${story.title}"` };
    }
    case "voice_anchor": {
      if (input.profile.voiceAnchor.id !== ref.id) {
        return {
          ok: false,
          reason: `voice_anchor ${ref.id} does not match active voice anchor ${input.profile.voiceAnchor.id}`
        };
      }
      if (!input.profile.voiceAnchor.verifiedAt) {
        return {
          ok: false,
          reason: `voice_anchor ${ref.id} is not ready (verifiedAt is null)`
        };
      }
      return { ok: true, note: "ready voice anchor" };
    }
    case "source_document": {
      const doc = input.profile.sourceDocuments.find((row) => row.id === ref.id);
      if (!doc) {
        return {
          ok: false,
          reason: `source_document ${ref.id} not attached to revision ${input.profile.revisionId}`
        };
      }
      return { ok: true, note: `source_document ${doc.kind}:${doc.label}` };
    }
    case "program": {
      if (input.target.program.id !== ref.id) {
        return {
          ok: false,
          reason: `program ${ref.id} is not the target program ${input.target.program.id}`
        };
      }
      return assertExternalEvidence("graduate_program", input.target.program.id, input.target.program.evidenceIds);
    }
    case "funding": {
      if (!input.target.funding || input.target.funding.id !== ref.id) {
        return {
          ok: false,
          reason: `funding ${ref.id} is not the target funding opportunity`
        };
      }
      return assertExternalEvidence("funding_opportunity", input.target.funding.id, input.target.funding.evidenceIds);
    }
    case "person_role": {
      if (!input.target.personRole || input.target.personRole.id !== ref.id) {
        return {
          ok: false,
          reason: `person_role ${ref.id} is not the target contact role`
        };
      }
      return assertExternalEvidence("person_role", input.target.personRole.id, input.target.personRole.evidenceIds);
    }
    case "professional_profile": {
      if (
        !input.target.professionalProfile ||
        input.target.professionalProfile.id !== ref.id
      ) {
        return {
          ok: false,
          reason: `professional_profile ${ref.id} is not the target contact profile`
        };
      }
      return assertExternalEvidence(
        "professional_profile",
        input.target.professionalProfile.id,
        input.target.professionalProfile.evidenceIds
      );
    }
    case "person": {
      if (!input.target.person || input.target.person.id !== ref.id) {
        return {
          ok: false,
          reason: `person ${ref.id} is not the target person`
        };
      }
      return { ok: true, note: `person ${input.target.person.canonicalName}` };
    }
    case "university": {
      if (input.target.university.id !== ref.id) {
        return {
          ok: false,
          reason: `university ${ref.id} is not the target university`
        };
      }
      return assertExternalEvidence("university", input.target.university.id, input.target.university.evidenceIds);
    }
  }
}

function assertExternalEvidence(
  subjectType: string,
  subjectId: string,
  evidenceIds: readonly string[]
): RefResolution {
  try {
    assertEvidenceBinding({ subjectType, subjectId, evidenceIds });
    const exampleEvidence = evidenceIds[0]
      ? dbClient.get("evidence", evidenceIds[0])
      : null;
    const label = exampleEvidence
      ? `${subjectType} evidence ${exampleEvidence.sourceType}:${exampleEvidence.sourceLabel}`
      : `${subjectType} evidence`;
    return { ok: true, note: label };
  } catch (error) {
    if (error instanceof MissingEvidenceError) {
      return { ok: false, reason: error.detail };
    }
    throw error;
  }
}
