import type {
  FundingOpportunityRecord,
  GraduateProgramRecord,
  PersonRecord,
  PersonRoleRecord,
  ProfessionalProfileRecord,
  UniversityRecord
} from "../db/schema";
import type {
  WritingArtifact,
  WritingDocumentType,
  WritingReadiness
} from "../writing/types";

/**
 * Per data-model.md §5.8 a real `requirement_set` is evidence-backed and
 * versioned. That DB-level concept lands in a later block (Phase 4).
 *
 * For this preparation slice we model a REQUIREMENT as a deterministic
 * checklist contract for a program: what we need to have packaged to
 * consider the application "ready for user review" even before the
 * requirement_set table is built. Every requirement carries an explicit
 * origin so the user can see why the checklist asked for it.
 */
export type RequirementOrigin =
  | "program_default"
  | "funding_default"
  | "user_default"
  | "program_evidence";

/**
 * Generic "category" of deliverable. `document_draft` items are backed by
 * WritingArtifacts (SOP, PS, etc.). `user_supplied` items are files or
 * facts that must come from the user (transcripts, test scores). `external`
 * items are routed through external actors the system never drives in v1
 * (letters of recommendation via portal).
 */
export type RequirementCategory = "document_draft" | "user_supplied" | "external";

/**
 * Fixed set of deliverable keys for this slice. New kinds land only when a
 * real program surfaces one that the current checklist can't express —
 * avoid inventing kinds for one-off essays (use `short_answer` instead).
 */
export type RequirementKind =
  | "sop"
  | "personal_statement"
  | "short_answer"
  | "cover_letter"
  | "resume"
  | "cv"
  | "transcript"
  | "recommendation_letter"
  | "test_score_report"
  | "application_fee_or_waiver"
  | "writing_sample"
  | "portfolio"
  | "other_document";

export type ChecklistItemStatus =
  | "complete"
  | "ready_with_warnings"
  | "needs_user_input"
  | "missing"
  | "deferred";

export interface ChecklistItem {
  id: string;
  programId: string;
  kind: RequirementKind;
  category: RequirementCategory;
  label: string;
  required: boolean;
  origin: RequirementOrigin;
  status: ChecklistItemStatus;
  /** Notes the user should see: word-limit hits, unverified stories, etc. */
  notes: string[];
  /**
   * If this requirement is satisfied by a writing artifact we record the
   * request id (not just the text) so the approval queue can reference the
   * full grounding report rather than reprinting it.
   */
  writingRequestId: string | null;
  writingDocumentType: WritingDocumentType | null;
  writingReadiness: WritingReadiness | null;
}

export type PacketReadiness =
  | "ready_for_review"
  | "ready_with_warnings"
  | "needs_user_input"
  | "blocked";

export interface PacketReadinessSummary {
  status: PacketReadiness;
  readyItems: number;
  warningItems: number;
  missingItems: number;
  userInputItems: number;
  deferredItems: number;
  totalItems: number;
  blockers: string[];
  warnings: string[];
}

export interface PacketTargetContext {
  university: UniversityRecord;
  program: GraduateProgramRecord;
  funding: FundingOpportunityRecord | null;
  personRole: PersonRoleRecord | null;
  person: PersonRecord | null;
  professionalProfile: ProfessionalProfileRecord | null;
}

export interface ApplicationPacket {
  id: string;
  userId: string;
  revisionId: string;
  programId: string;
  universityId: string;
  fundingId: string | null;
  target: PacketTargetContext;
  documents: WritingArtifact[];
  checklist: ChecklistItem[];
  readiness: PacketReadinessSummary;
  generatedAt: string;
}

/**
 * Approval queue — see agents.md §4.17 + data-model.md §6.4. The concrete
 * v1 action types relevant at the preparation stage. Actions like
 * `submit_application`, `pay_fee`, and `send_email` are declared in
 * data-model.md §6.4 but are intentionally not emitted by this slice —
 * no side-effect is ever prepared here (CLAUDE.md §8 invariants 1–3).
 */
export type ApprovalActionType =
  | "approve_draft"
  | "edit_required"
  | "missing_input"
  | "ready_for_submission";

export type ApprovalStatus = "pending" | "approved" | "edited" | "skipped";

export type ApprovalDefaultAction = "approve" | "edit" | "skip";

export interface ApprovalGroundingSummary {
  verifiableClaims: number;
  supportedClaims: number;
  unsupportedClaims: number;
  passed: boolean;
  profileFieldKeys: string[];
  verifiedStoryIds: string[];
  programIds: string[];
  fundingIds: string[];
  personRoleIds: string[];
  professionalProfileIds: string[];
  voiceAnchorId: string | null;
}

export interface ApprovalEvidenceSummary {
  programEvidenceIds: string[];
  universityEvidenceIds: string[];
  fundingEvidenceIds: string[];
  personRoleEvidenceIds: string[];
  professionalProfileEvidenceIds: string[];
  /** Distinct quoted-source labels for at most ~5 evidence rows. */
  exampleQuotes: string[];
}

export interface ApprovalItem {
  id: string;
  actionType: ApprovalActionType;
  status: ApprovalStatus;
  defaultAction: ApprovalDefaultAction;
  userId: string;
  programId: string;
  universityId: string;
  fundingId: string | null;
  /** The associated WritingArtifact request id, if any. */
  artifactId: string | null;
  artifactKind: WritingDocumentType | null;
  reason: string;
  actionRequired: string;
  grounding: ApprovalGroundingSummary | null;
  evidence: ApprovalEvidenceSummary | null;
  checklistItemIds: string[];
  createdAt: string;
}

export interface ApplicationPrepInput {
  userId: string;
  revisionId: string;
  programIds?: string[];
}

export interface ApplicationPrepResult {
  cycleId: string;
  packets: ApplicationPacket[];
  approvalQueue: ApprovalItem[];
  totals: {
    packets: number;
    readyForReview: number;
    readyWithWarnings: number;
    needsUserInput: number;
    blocked: number;
  };
  queueTotals: Record<ApprovalActionType, number>;
  notes: string[];
  generatedAt: string;
}
