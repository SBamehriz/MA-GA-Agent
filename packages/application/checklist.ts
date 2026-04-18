import type { SourceDocumentRecord } from "../db/schema";
import type {
  WritingArtifact,
  WritingDocumentType,
  WritingProfileContext
} from "../writing/types";

import type {
  ChecklistItem,
  ChecklistItemStatus,
  PacketReadiness,
  PacketReadinessSummary,
  PacketTargetContext,
  RequirementCategory,
  RequirementKind,
  RequirementOrigin
} from "./types";

/**
 * ChecklistSubagent.
 *
 * Produces a deterministic required/completed/missing checklist for a
 * program. Real program-level `requirement_set` tables (data-model.md §5.8)
 * are a later block — for this slice we derive requirements from:
 *
 *   1. a core default set every Master's application needs,
 *   2. the attached funding opportunity (if any) — assistantship roles
 *      typically add a cover letter + recommendation set,
 *   3. what writing artifacts the user has actually produced so far.
 *
 * The checklist is the single source of truth for packet readiness; the
 * approval queue only acts on items already on the checklist.
 */
export interface ChecklistInput {
  target: PacketTargetContext;
  profile: WritingProfileContext;
  writingArtifacts: readonly WritingArtifact[];
  sourceDocuments: readonly SourceDocumentRecord[];
  userPreferences?: {
    includeCoverLetter?: boolean;
    includePersonalStatement?: boolean;
    includePortfolio?: boolean;
  };
}

interface RequirementSpec {
  kind: RequirementKind;
  category: RequirementCategory;
  label: string;
  required: boolean;
  origin: RequirementOrigin;
  /** When a writing artifact type satisfies this requirement. */
  writingDocumentType?: WritingDocumentType;
}

function createId(programId: string, kind: RequirementKind): string {
  return `checklist_${programId}__${kind}`;
}

function baseRequirementSpecs(
  input: ChecklistInput
): RequirementSpec[] {
  const specs: RequirementSpec[] = [
    {
      kind: "sop",
      category: "document_draft",
      label: "Statement of Purpose",
      required: true,
      origin: "program_default",
      writingDocumentType: "sop"
    },
    {
      kind: "resume",
      category: "document_draft",
      label: "Resume / CV (tailored)",
      required: true,
      origin: "program_default",
      writingDocumentType: "resume_tailoring"
    },
    {
      kind: "transcript",
      category: "user_supplied",
      label: "Undergraduate transcript",
      required: true,
      origin: "program_default"
    },
    {
      kind: "recommendation_letter",
      category: "external",
      label: "Letters of recommendation (typically 3)",
      required: true,
      origin: "program_default"
    },
    {
      kind: "test_score_report",
      category: "user_supplied",
      label: "Test score report (TOEFL/IELTS or GRE if required)",
      required: false,
      origin: "program_default"
    },
    {
      kind: "application_fee_or_waiver",
      category: "user_supplied",
      label: "Application fee or fee waiver",
      required: true,
      origin: "program_default"
    }
  ];

  if (input.userPreferences?.includePersonalStatement ?? true) {
    specs.push({
      kind: "personal_statement",
      category: "document_draft",
      label: "Personal statement (optional essay)",
      required: false,
      origin: "user_default",
      writingDocumentType: "personal_statement"
    });
  }

  if (input.target.funding) {
    specs.push({
      kind: "cover_letter",
      category: "document_draft",
      label: `Cover letter for ${input.target.funding.title}`,
      required: true,
      origin: "funding_default",
      writingDocumentType: "cover_letter"
    });
  } else if (input.userPreferences?.includeCoverLetter) {
    specs.push({
      kind: "cover_letter",
      category: "document_draft",
      label: "Cover letter",
      required: false,
      origin: "user_default",
      writingDocumentType: "cover_letter"
    });
  }

  if (input.userPreferences?.includePortfolio) {
    specs.push({
      kind: "portfolio",
      category: "user_supplied",
      label: "Portfolio / project repository",
      required: false,
      origin: "user_default"
    });
  }

  return specs;
}

function pickArtifactForSpec(
  spec: RequirementSpec,
  input: ChecklistInput
): WritingArtifact | null {
  if (!spec.writingDocumentType) return null;
  const candidates = input.writingArtifacts.filter(
    (artifact) =>
      artifact.request.documentType === spec.writingDocumentType &&
      artifact.draft.targetProgramId === input.target.program.id
  );

  if (candidates.length === 0) return null;

  const ready = candidates.find((artifact) => artifact.readiness === "ready");
  if (ready) return ready;

  const withWarnings = candidates.find(
    (artifact) =>
      artifact.readiness === "style_failed" ||
      artifact.readiness === "needs_user_input"
  );
  if (withWarnings) return withWarnings;

  return candidates[0] ?? null;
}

function statusForArtifact(artifact: WritingArtifact): ChecklistItemStatus {
  switch (artifact.readiness) {
    case "ready":
      return "complete";
    case "style_failed":
    case "needs_user_input":
      return "ready_with_warnings";
    case "grounding_failed":
    case "missing_inputs":
      return "missing";
  }
}

function notesForArtifact(artifact: WritingArtifact): string[] {
  const notes: string[] = [];

  if (artifact.grounding.unsupportedClaims.length > 0) {
    notes.push(
      `${artifact.grounding.unsupportedClaims.length} unsupported claim(s) — grounding failed.`
    );
  }
  for (const critic of artifact.critic.notes) {
    if (critic.severity === "block") {
      notes.push(`critic blocker: ${critic.code} — ${critic.message}`);
    } else if (critic.severity === "warn") {
      notes.push(`critic warn: ${critic.code} — ${critic.message}`);
    }
  }
  if (!artifact.style.passed) {
    notes.push(`style check failed: ${artifact.style.notes.join("; ")}`);
  }

  return notes;
}

function userSuppliedStatus(
  spec: RequirementSpec,
  input: ChecklistInput
): ChecklistItemStatus {
  if (spec.kind === "transcript") {
    const transcript = input.sourceDocuments.find(
      (doc) => doc.kind === "transcript"
    );
    return transcript ? "complete" : "missing";
  }
  if (spec.kind === "resume" || spec.kind === "cv") {
    const resume = input.sourceDocuments.find((doc) => doc.kind === "resume");
    return resume ? "ready_with_warnings" : "needs_user_input";
  }
  return "needs_user_input";
}

function externalStatus(spec: RequirementSpec): ChecklistItemStatus {
  if (spec.kind === "recommendation_letter") {
    return "deferred";
  }
  return "deferred";
}

function buildChecklistItem(
  spec: RequirementSpec,
  input: ChecklistInput
): ChecklistItem {
  const programId = input.target.program.id;

  if (spec.category === "document_draft") {
    const artifact = pickArtifactForSpec(spec, input);
    if (artifact) {
      return {
        id: createId(programId, spec.kind),
        programId,
        kind: spec.kind,
        category: spec.category,
        label: spec.label,
        required: spec.required,
        origin: spec.origin,
        status: statusForArtifact(artifact),
        notes: notesForArtifact(artifact),
        writingRequestId: artifact.request.id,
        writingDocumentType: artifact.request.documentType,
        writingReadiness: artifact.readiness
      };
    }
    return {
      id: createId(programId, spec.kind),
      programId,
      kind: spec.kind,
      category: spec.category,
      label: spec.label,
      required: spec.required,
      origin: spec.origin,
      status: "missing",
      notes: [
        `No ${spec.writingDocumentType ?? spec.kind} artifact generated for ${programId}.`
      ],
      writingRequestId: null,
      writingDocumentType: spec.writingDocumentType ?? null,
      writingReadiness: null
    };
  }

  if (spec.category === "user_supplied") {
    const status = userSuppliedStatus(spec, input);
    const notes: string[] = [];
    if (status === "needs_user_input") {
      notes.push(`No ${spec.kind} registered on profile revision.`);
    }
    if (status === "ready_with_warnings") {
      notes.push(
        "Source resume present; program tailoring artifact supersedes it for submission."
      );
    }
    return {
      id: createId(programId, spec.kind),
      programId,
      kind: spec.kind,
      category: spec.category,
      label: spec.label,
      required: spec.required,
      origin: spec.origin,
      status,
      notes,
      writingRequestId: null,
      writingDocumentType: null,
      writingReadiness: null
    };
  }

  return {
    id: createId(programId, spec.kind),
    programId,
    kind: spec.kind,
    category: spec.category,
    label: spec.label,
    required: spec.required,
    origin: spec.origin,
    status: externalStatus(spec),
    notes: [
      "Handled outside the system (portal invites recommender; system never contacts on user's behalf)."
    ],
    writingRequestId: null,
    writingDocumentType: null,
    writingReadiness: null
  };
}

export function buildChecklist(input: ChecklistInput): ChecklistItem[] {
  return baseRequirementSpecs(input).map((spec) =>
    buildChecklistItem(spec, input)
  );
}

/**
 * Packet-level readiness rollup. A single missing required item makes the
 * packet `blocked`. Warnings propagate up to `ready_with_warnings`. Only a
 * checklist with every required item in `complete` (or `deferred` for
 * recommendations) graduates to `ready_for_review`.
 */
export function summarizeReadiness(
  checklist: readonly ChecklistItem[]
): PacketReadinessSummary {
  let readyItems = 0;
  let warningItems = 0;
  let missingItems = 0;
  let userInputItems = 0;
  let deferredItems = 0;

  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const item of checklist) {
    switch (item.status) {
      case "complete":
        readyItems += 1;
        break;
      case "ready_with_warnings":
        warningItems += 1;
        break;
      case "missing":
        missingItems += 1;
        if (item.required) {
          blockers.push(`missing required ${item.kind}: ${item.label}`);
        }
        break;
      case "needs_user_input":
        userInputItems += 1;
        if (item.required) {
          blockers.push(`needs user input for required ${item.kind}: ${item.label}`);
        }
        break;
      case "deferred":
        deferredItems += 1;
        break;
    }

    for (const note of item.notes) {
      if (item.status === "ready_with_warnings") {
        warnings.push(`[${item.kind}] ${note}`);
      }
    }
  }

  const status: PacketReadiness = deriveStatus({
    blockers,
    warningItems,
    userInputItems,
    missingItems
  });

  return {
    status,
    readyItems,
    warningItems,
    missingItems,
    userInputItems,
    deferredItems,
    totalItems: checklist.length,
    blockers,
    warnings
  };
}

function deriveStatus(input: {
  blockers: readonly string[];
  warningItems: number;
  userInputItems: number;
  missingItems: number;
}): PacketReadiness {
  if (input.blockers.length > 0) {
    return "blocked";
  }
  if (input.userInputItems > 0) {
    return "needs_user_input";
  }
  if (input.warningItems > 0) {
    return "ready_with_warnings";
  }
  return "ready_for_review";
}
