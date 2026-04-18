import { flattenClaims } from "./claims";
import type {
  CriticNote,
  CriticReport,
  Section,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingTargetContext
} from "./types";

export interface CriticInput {
  request: WritingDocumentRequest;
  sections: readonly Section[];
  profile: WritingProfileContext;
  target: WritingTargetContext;
  draftText: string;
}

/**
 * Deterministic critic pass. Per agents.md §4.13 the critic runs on a
 * *different* signal than the drafter; here the drafter is template-based
 * and the critic examines the emitted claim graph + body text for:
 *
 *   - at least one program-specific claim (factual_program),
 *   - at least one narrative citation (narrative → verified story),
 *   - at least one profile-field attestation citation (factual_profile),
 *   - voice anchor presence for "opening" slot,
 *   - cover_letter / outreach: a named recipient from person_role,
 *   - short_answer: word-limit respected,
 *   - no duplicate paragraphs (template leak sanity).
 *
 * Critic notes are `info | warn | block`. Only `block`-severity notes halt
 * readiness. `warn` is surfaced to the user.
 */
export function runCritic(input: CriticInput): CriticReport {
  const notes: CriticNote[] = [];
  const claims = flattenClaims(input.sections);

  const kindCounts = new Map<string, number>();
  for (const claim of claims) {
    kindCounts.set(claim.kind, (kindCounts.get(claim.kind) ?? 0) + 1);
  }

  const hasProgramClaim = (kindCounts.get("factual_program") ?? 0) > 0;
  const hasNarrativeClaim = (kindCounts.get("narrative") ?? 0) > 0;
  const hasProfileClaim = (kindCounts.get("factual_profile") ?? 0) > 0;
  const hasUniversityClaim = (kindCounts.get("factual_university") ?? 0) > 0;
  const hasVoiceClaim = (kindCounts.get("voice_stylistic") ?? 0) > 0;

  if (!hasProfileClaim) {
    notes.push({
      code: "missing_profile_anchor",
      severity: "block",
      message: "Draft contains no attested profile-field citation; cannot be grounded."
    });
  }

  if (!hasProgramClaim && input.request.documentType !== "resume_tailoring") {
    notes.push({
      code: "missing_program_specificity",
      severity: "block",
      message:
        "Draft contains no program-specific claim. agents.md §4.13 requires program fit be grounded in program evidence."
    });
  }

  if (!hasUniversityClaim && input.request.documentType !== "resume_tailoring") {
    notes.push({
      code: "missing_university_anchor",
      severity: "warn",
      message: "Draft contains no university-level claim; consider adding a university-scope marker."
    });
  }

  if (input.request.documentType === "sop" && !hasNarrativeClaim) {
    notes.push({
      code: "sop_missing_narrative",
      severity: "block",
      message:
        "SOP must cite at least one verified story as a narrative claim (agents.md §4.13, CLAUDE.md §8.11)."
    });
  }

  if (input.request.documentType === "cover_letter" && !hasNarrativeClaim) {
    notes.push({
      code: "cover_letter_missing_narrative",
      severity: "warn",
      message: "Cover letter has no narrative citation; tie it to at least one verified story if possible."
    });
  }

  if (!hasVoiceClaim && input.request.documentType !== "resume_tailoring") {
    notes.push({
      code: "missing_voice_anchor_line",
      severity: "warn",
      message: "Draft has no voice-anchor-grounded opening; output may drift toward generic tone."
    });
  }

  if (
    input.request.documentType === "cover_letter" ||
    input.request.documentType === "outreach_message"
  ) {
    if (!input.target.personRole) {
      notes.push({
        code: "missing_recipient",
        severity: "block",
        message:
          "Cover letter / outreach requires a named recipient (person_role) with evidence; none supplied."
      });
    }
  }

  if (input.request.documentType === "short_answer" && input.request.wordLimit) {
    const wordCount = countWords(input.draftText);
    if (wordCount > input.request.wordLimit) {
      notes.push({
        code: "short_answer_word_limit_exceeded",
        severity: "block",
        message: `Short-answer word count ${wordCount} exceeds declared limit ${input.request.wordLimit}.`
      });
    }
  }

  const paragraphTexts = new Map<string, number>();
  for (const section of input.sections) {
    for (const paragraph of section.paragraphs) {
      const text = paragraph.claims
        .map((claim) => claim.text)
        .join(" ")
        .trim()
        .toLowerCase();
      if (text.length < 40) {
        continue;
      }
      paragraphTexts.set(text, (paragraphTexts.get(text) ?? 0) + 1);
    }
  }
  for (const [text, count] of paragraphTexts) {
    if (count > 1) {
      notes.push({
        code: "duplicate_paragraph",
        severity: "warn",
        message: `A paragraph appears ${count} times (first 40 chars: "${text.slice(0, 40)}…"); risks template leak.`
      });
    }
  }

  const hasBlockers = notes.some((note) => note.severity === "block");
  return { notes, hasBlockers };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}
