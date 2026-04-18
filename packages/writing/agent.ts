import { runCritic } from "./critic";
import { buildDraftArtifact } from "./drafter";
import { runGroundingCheck } from "./grounding";
import { flattenClaims } from "./claims";
import { runStyleCheck } from "./style";
import type {
  CriticReport,
  DraftArtifact,
  GroundingReport,
  StyleReport,
  WritingArtifact,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingReadiness,
  WritingTargetContext
} from "./types";

export interface WritingAgentRunInput {
  request: WritingDocumentRequest;
  profile: WritingProfileContext;
  target: WritingTargetContext;
}

/**
 * WritingAgent (orchestrator).
 *
 * Implements the draft → critic → grounding → style loop from agents.md §4.13.
 *
 * The drafter is deterministic (templates), the critic is deterministic (claim
 * graph + body text heuristics), the fact-check is deterministic (ref
 * resolution against DB + evidence bindings), and the style check is
 * deterministic (signals vs voice anchor). An LLM pass can be layered on top
 * in a later block; for the first implementation we ship only what we can
 * explain row-by-row.
 */
export function runWritingAgent(input: WritingAgentRunInput): WritingArtifact {
  const draft = buildDraftArtifact(input.request, input.profile, input.target);

  const critic = runCritic({
    request: input.request,
    sections: draft.sections,
    profile: input.profile,
    target: input.target,
    draftText: draft.text
  });

  const grounding = runGroundingCheck({
    sections: draft.sections,
    profile: input.profile,
    target: input.target
  });

  const style = runStyleCheck(draft.text, input.profile);

  const readiness = deriveReadiness(critic, grounding, style);
  const rejectionReasons = collectRejectionReasons(critic, grounding, style);
  const usageSummary = summarizeUsage(draft, input.profile);

  return {
    request: input.request,
    draft,
    critic,
    grounding,
    style,
    readiness,
    rejectionReasons,
    usageSummary
  };
}

function deriveReadiness(
  critic: CriticReport,
  grounding: GroundingReport,
  style: StyleReport
): WritingReadiness {
  if (!grounding.passed) {
    return "grounding_failed";
  }
  if (critic.hasBlockers) {
    return "needs_user_input";
  }
  if (!style.passed) {
    return "style_failed";
  }
  return "ready";
}

function collectRejectionReasons(
  critic: CriticReport,
  grounding: GroundingReport,
  style: StyleReport
): string[] {
  const reasons: string[] = [];

  for (const unsupported of grounding.unsupportedClaims) {
    reasons.push(
      `[grounding] claim ${unsupported.claimId} (${unsupported.slotTag}) unsupported: ${unsupported.reason}`
    );
  }

  for (const note of critic.notes) {
    if (note.severity === "block") {
      reasons.push(`[critic:${note.code}] ${note.message}`);
    }
  }

  if (!style.passed) {
    for (const note of style.notes) {
      reasons.push(`[style] ${note}`);
    }
  }

  return reasons;
}

function summarizeUsage(
  draft: DraftArtifact,
  profile: WritingProfileContext
): WritingArtifact["usageSummary"] {
  const claims = flattenClaims(draft.sections);

  const profileFieldIds = new Set<string>();
  const verifiedStoryIds = new Set<string>();
  const programIds = new Set<string>();
  const fundingIds = new Set<string>();
  const personRoleIds = new Set<string>();
  const universityIds = new Set<string>();
  const professionalProfileIds = new Set<string>();

  for (const claim of claims) {
    for (const ref of claim.refs) {
      switch (ref.type) {
        case "profile_field":
          profileFieldIds.add(ref.id);
          break;
        case "story":
          verifiedStoryIds.add(ref.id);
          break;
        case "program":
          programIds.add(ref.id);
          break;
        case "funding":
          fundingIds.add(ref.id);
          break;
        case "person_role":
          personRoleIds.add(ref.id);
          break;
        case "university":
          universityIds.add(ref.id);
          break;
        case "professional_profile":
          professionalProfileIds.add(ref.id);
          break;
        default:
          break;
      }
    }
  }

  const profileFieldKeys: string[] = [];
  for (const fieldId of profileFieldIds) {
    const field = profile.attestedFields.get(fieldId);
    if (field) {
      profileFieldKeys.push(field.fieldKey);
    }
  }

  return {
    profileFieldKeys: profileFieldKeys.sort(),
    verifiedStoryIds: [...verifiedStoryIds].sort(),
    programIds: [...programIds].sort(),
    fundingIds: [...fundingIds].sort(),
    personRoleIds: [...personRoleIds].sort(),
    universityIds: [...universityIds].sort(),
    professionalProfileIds: [...professionalProfileIds].sort(),
    voiceAnchorId: profile.voiceAnchor.id
  };
}
