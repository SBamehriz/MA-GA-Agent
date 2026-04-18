import { flattenClaims, renderSections, resetClaimIdCounter } from "./claims";
import { buildCoverLetterSections } from "./documents/cover-letter";
import { buildOutreachSections } from "./documents/outreach";
import { buildPersonalStatementSections } from "./documents/personal-statement";
import { buildResumeTailoringSections } from "./documents/resume-tailoring";
import { buildShortAnswerSections } from "./documents/short-answer";
import { buildSopSections } from "./documents/sop";
import type {
  DraftArtifact,
  Section,
  WritingDocumentRequest,
  WritingDocumentType,
  WritingProfileContext,
  WritingTargetContext
} from "./types";

/**
 * DraftingSubagent entry point.
 *
 * Per agents.md §4.13 + §10 decision defaults ("templated skeleton with
 * agentic personalization"), this drafter is deterministic: it dispatches
 * to a per-document-type template builder and returns a structured
 * DraftArtifact. The artifact carries both the rendered text AND the
 * structured Section/Claim tree so the grounding check can inspect refs
 * directly rather than re-parsing prose.
 */
export function buildDraftArtifact(
  request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): DraftArtifact {
  resetClaimIdCounter();

  const sections = buildSectionsForDocumentType(
    request.documentType,
    request,
    profile,
    target
  );
  const text = renderSections(sections);
  const claims = flattenClaims(sections);

  const verifiableClaimCount = claims.filter((claim) =>
    claim.kind !== "stylistic" && claim.kind !== "voice_stylistic"
  ).length;

  return {
    requestId: request.id,
    documentType: request.documentType,
    targetProgramId: target.program.id,
    targetUniversityId: target.university.id,
    targetFundingId: target.funding?.id ?? null,
    targetPersonRoleId: target.personRole?.id ?? null,
    title: buildTitle(request.documentType, target),
    sections,
    text,
    claimCount: claims.length,
    verifiableClaimCount,
    wordCount: countWords(text),
    generatedAt: new Date().toISOString()
  };
}

function buildSectionsForDocumentType(
  documentType: WritingDocumentType,
  request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): Section[] {
  switch (documentType) {
    case "sop":
      return buildSopSections(request, profile, target);
    case "short_answer":
      return buildShortAnswerSections(request, profile, target);
    case "cover_letter":
      return buildCoverLetterSections(request, profile, target);
    case "personal_statement":
      return buildPersonalStatementSections(request, profile, target);
    case "outreach_message":
      return buildOutreachSections(request, profile, target);
    case "resume_tailoring":
      return buildResumeTailoringSections(request, profile, target);
  }
}

function buildTitle(
  documentType: WritingDocumentType,
  target: WritingTargetContext
): string {
  const programLabel = `${target.program.title} @ ${target.university.canonicalName}`;
  switch (documentType) {
    case "sop":
      return `SOP — ${programLabel}`;
    case "personal_statement":
      return `Personal statement — ${programLabel}`;
    case "short_answer":
      return `Short answer — ${programLabel}`;
    case "cover_letter":
      return `Cover letter — ${target.funding?.title ?? programLabel}`;
    case "outreach_message":
      return `Outreach — ${
        target.person?.canonicalName ?? target.personRole?.roleTitle ?? programLabel
      }`;
    case "resume_tailoring":
      return `Resume tailoring — ${programLabel}`;
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}
