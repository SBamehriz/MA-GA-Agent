import type {
  ApplicationStatus,
  ApprovalRequestStatus,
  ApprovalResolutionDecision
} from "../db/enums";
import type {
  ApplicationArtifactRecord,
  ApplicationRecord,
  ApprovalRequestRecord
} from "../db/schema";

/**
 * User-initiated decision on a single approval request.
 *
 * The agent never writes these on the user's behalf; every resolution must
 * flow through this module so we have a single audit surface and a single
 * path that also updates the related applicationArtifact / application
 * rows. CLAUDE.md §8 invariants 1–3 + agents.md §4.17.
 */
export interface ApprovalResolutionInput {
  approvalRequestId: string;
  decision: ApprovalResolutionDecision;
  decisionNote?: string | null;
  /**
   * Free-form hint recorded alongside the decision so we can distinguish
   * CLI / harness / future UI actors in the audit log. Not a trust signal;
   * the user is the sole actor for now.
   */
  decisionActorHint?: string | null;
}

export interface ApprovalResolutionResult {
  approvalRequest: ApprovalRequestRecord;
  application: ApplicationRecord;
  artifact: ApplicationArtifactRecord | null;
  previousApplicationStatus: ApplicationStatus;
  newApprovalStatus: ApprovalRequestStatus;
  applicationStatusChanged: boolean;
  pendingApprovalsAfter: number;
}

export class ApprovalResolutionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApprovalResolutionError";
    this.code = code;
  }
}
