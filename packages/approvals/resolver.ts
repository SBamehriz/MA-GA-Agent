import { dbClient } from "../db/client";
import type {
  ApplicationArtifactStatus,
  ApplicationStatus,
  ApprovalRequestActionType,
  ApprovalRequestStatus,
  ApprovalResolutionDecision
} from "../db/enums";
import {
  applicationArtifactQueries,
  applicationQueries
} from "../db/queries/application";
import { approvalQueries } from "../db/queries/approval";
import type {
  ApplicationArtifactRecord,
  ApplicationRecord,
  ApprovalRequestRecord
} from "../db/schema";
import {
  createWorkflowEvent,
  workflowEvents,
  type ApplicationStatusName,
  type ApprovalActionTypeName,
  type ApprovalRequestStatusName,
  type ApprovalResolutionDecisionName,
  type WorkflowEvent
} from "../workflows/events";

import {
  ApprovalResolutionError,
  type ApprovalResolutionInput,
  type ApprovalResolutionResult
} from "./types";

/**
 * ApprovalResolutionSubagent.
 *
 * Single entry point for transitioning a persisted approvalRequest from
 * `pending` → `approved | edited | rejected | skipped`. Updates the
 * related applicationArtifact + application rows deterministically and
 * emits the workflow events the resume logic listens for.
 *
 * Rules enforced here:
 *   1. A ready_for_submission approval cannot be resolved until all other
 *      pending approvals on the same application are resolved.
 *   2. Only the user can resolve; this function does not accept agent-like
 *      impersonation.
 *   3. No external side-effect is performed. The `approve` decision on a
 *      `ready_for_submission` item only unblocks the user's own manual
 *      submission flow.
 */

export type ApprovalResolutionEvents = Array<WorkflowEvent>;

function validateDecision(
  row: ApprovalRequestRecord,
  decision: ApprovalResolutionDecision
): ApprovalRequestStatus {
  if (row.status !== "pending") {
    throw new ApprovalResolutionError(
      "already_resolved",
      `approvalRequest ${row.id} is already ${row.status}.`
    );
  }

  switch (decision) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "request_edit":
      return "edited";
    case "skip":
      return "skipped";
  }
}

function enforceBlockingSiblings(row: ApprovalRequestRecord): void {
  if (row.actionType !== "ready_for_submission") return;
  const blockers = row.blockingSiblings ?? [];
  if (blockers.length === 0) return;

  for (const blockerId of blockers) {
    const blocker = approvalQueries.get(blockerId);
    if (!blocker) continue;
    if (blocker.status === "pending") {
      throw new ApprovalResolutionError(
        "blocked_by_siblings",
        `ready_for_submission ${row.id} cannot be resolved while ${blockerId} is still pending.`
      );
    }
  }
}

function applyArtifactSideEffects(
  approval: ApprovalRequestRecord,
  decision: ApprovalResolutionDecision
): ApplicationArtifactRecord | null {
  if (!approval.artifactId) return null;
  const artifact = applicationArtifactQueries.get(approval.artifactId);
  if (!artifact) return null;

  const now = dbClient.now();
  let nextStatus: ApplicationArtifactStatus = artifact.status;
  const patch: {
    approvedByUserAt?: string | null;
    rejectionReasons?: string[];
  } = {};

  switch (approval.actionType) {
    case "approve_draft":
      if (decision === "approve") {
        nextStatus = "approved";
        patch.approvedByUserAt = now;
      } else if (decision === "request_edit") {
        nextStatus = "needs_user_input";
      } else if (decision === "reject") {
        nextStatus = "grounding_failed";
        patch.rejectionReasons = [
          ...artifact.rejectionReasons,
          approval.decisionNote
            ? `user_rejected: ${approval.decisionNote}`
            : "user_rejected"
        ];
      }
      break;
    case "edit_required":
      if (decision === "approve") {
        // User waived warnings and approved in place.
        nextStatus = "approved";
        patch.approvedByUserAt = now;
      } else if (decision === "request_edit") {
        nextStatus = "needs_user_input";
      } else if (decision === "reject") {
        nextStatus = "grounding_failed";
        patch.rejectionReasons = [
          ...artifact.rejectionReasons,
          approval.decisionNote
            ? `user_rejected: ${approval.decisionNote}`
            : "user_rejected"
        ];
      }
      break;
    case "missing_input":
    case "ready_for_submission":
      return artifact;
  }

  return applicationArtifactQueries.setStatus(artifact.id, nextStatus, patch);
}

function derivedApplicationStatus(
  application: ApplicationRecord
): ApplicationStatus {
  const requests = approvalQueries.listForApplication(application.id);
  const pending = requests.filter((row) => row.status === "pending");

  if (application.status === "cancelled" || application.status === "user_submitted") {
    return application.status;
  }

  if (requests.length === 0) {
    return "preparing";
  }

  const readyForSubmission = requests.find(
    (row) => row.actionType === "ready_for_submission"
  );
  const allOthersResolved = requests
    .filter((row) => row.id !== readyForSubmission?.id)
    .every((row) => row.status !== "pending");

  if (
    readyForSubmission &&
    readyForSubmission.status === "approved" &&
    allOthersResolved
  ) {
    return "ready_for_user_submission";
  }

  if (pending.length > 0) {
    return "awaiting_user";
  }

  if (readyForSubmission && readyForSubmission.status !== "approved") {
    return "awaiting_user";
  }

  if (allOthersResolved) {
    return "awaiting_user";
  }

  return application.status;
}

function maybeTransitionApplication(
  application: ApplicationRecord
): {
  application: ApplicationRecord;
  changed: boolean;
  previous: ApplicationStatus;
} {
  const previous = application.status;
  const target = derivedApplicationStatus(application);
  if (target === previous) {
    return { application, changed: false, previous };
  }

  const updated = applicationQueries.setStatus(application.id, target);
  return { application: updated, changed: true, previous };
}

/**
 * Resolve a single approval request. Returns the updated rows plus a list
 * of workflow events the caller should forward to observers / loggers.
 */
export function resolveApproval(input: ApprovalResolutionInput): {
  result: ApprovalResolutionResult;
  events: ApprovalResolutionEvents;
} {
  const approval = approvalQueries.get(input.approvalRequestId);
  if (!approval) {
    throw new ApprovalResolutionError(
      "missing_approval",
      `approvalRequest ${input.approvalRequestId} not found.`
    );
  }

  const newStatus = validateDecision(approval, input.decision);
  enforceBlockingSiblings(approval);

  const application = applicationQueries.get(approval.applicationId);
  if (!application) {
    throw new ApprovalResolutionError(
      "missing_application",
      `application ${approval.applicationId} referenced by approval ${approval.id} not found.`
    );
  }

  const decidedAt = dbClient.now();
  const resolved = approvalQueries.resolve(approval.id, {
    status: newStatus,
    decisionNote: input.decisionNote ?? null,
    decisionActorHint: input.decisionActorHint ?? "local_harness",
    decidedAt
  });

  const artifact = applyArtifactSideEffects(resolved, input.decision);

  const transition = maybeTransitionApplication(application);
  const pendingAfter = approvalQueries
    .listForApplication(application.id)
    .filter((row) => row.status === "pending").length;

  const events: ApprovalResolutionEvents = [];
  events.push(
    createWorkflowEvent(workflowEvents.approvalDecided, {
      approvalRequestId: resolved.id,
      applicationId: application.id,
      userId: application.userId,
      actionType: resolved.actionType as ApprovalActionTypeName,
      decision: input.decision as ApprovalResolutionDecisionName,
      newStatus: resolved.status as ApprovalRequestStatusName,
      decidedAt,
      artifactId: resolved.artifactId,
      checklistItemIds: [...resolved.checklistItemIds],
      decisionNote: resolved.decisionNote
    })
  );

  if (transition.changed) {
    events.push(
      createWorkflowEvent(workflowEvents.applicationStatusChanged, {
        applicationId: transition.application.id,
        userId: transition.application.userId,
        programId: transition.application.programId,
        fromStatus: transition.previous as ApplicationStatusName,
        toStatus: transition.application.status as ApplicationStatusName,
        changedAt: decidedAt,
        pendingApprovals: pendingAfter,
        blockers: [...transition.application.blockers]
      })
    );
  }

  return {
    result: {
      approvalRequest: resolved,
      application: transition.application,
      artifact,
      previousApplicationStatus: transition.previous,
      newApprovalStatus: resolved.status,
      applicationStatusChanged: transition.changed,
      pendingApprovalsAfter: pendingAfter
    },
    events
  };
}

/**
 * Convenience: list the next-actionable approval requests for a user,
 * honoring the ready_for_submission blocking rule so the CLI/harness can
 * show them in priority order.
 */
export interface ActionableApprovalView {
  request: ApprovalRequestRecord;
  readyToResolve: boolean;
  blockedByCount: number;
}

export function listActionableApprovals(
  userId: string
): ActionableApprovalView[] {
  const pending = approvalQueries.listPendingForUser(userId);
  return pending.map((row) => {
    const blockers = row.blockingSiblings ?? [];
    const stillBlocking = blockers.filter((id) => {
      const sibling = approvalQueries.get(id);
      return sibling?.status === "pending";
    });
    return {
      request: row,
      readyToResolve: stillBlocking.length === 0,
      blockedByCount: stillBlocking.length
    };
  });
}

export function countPendingForApplication(applicationId: string): number {
  return approvalQueries.listPendingForApplication(applicationId).length;
}

export function summarizeApprovalStatuses(
  applicationId: string
): Record<ApprovalRequestStatus, number> &
  Record<ApprovalRequestActionType, number> {
  const statusCounts: Record<ApprovalRequestStatus, number> = {
    pending: 0,
    approved: 0,
    edited: 0,
    rejected: 0,
    skipped: 0,
    expired: 0
  };
  const actionCounts: Record<ApprovalRequestActionType, number> = {
    approve_draft: 0,
    edit_required: 0,
    missing_input: 0,
    ready_for_submission: 0
  };
  for (const row of approvalQueries.listForApplication(applicationId)) {
    statusCounts[row.status] += 1;
    actionCounts[row.actionType] += 1;
  }
  return { ...statusCounts, ...actionCounts };
}
