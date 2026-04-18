import { applicationQueries } from "../db/queries/application";
import { approvalQueries } from "../db/queries/approval";
import type { ApplicationRecord, ApprovalRequestRecord } from "../db/schema";
import { dbClient } from "../db/client";
import {
  createWorkflowEvent,
  workflowEvents,
  type ApplicationStatusName,
  type WorkflowEvent
} from "../workflows/events";

/**
 * WorkflowResumeSubagent.
 *
 * A read-heavy module that re-derives the up-to-date progression state of
 * an application strictly from persisted rows, so the workflow can be
 * paused, restarted, or shared between processes without losing track of
 * where the user stands.
 *
 * Emits `application.resumed` each time `resumeApplication` is called so
 * the local harness can surface the effect of a restart or a batch of
 * decisions.
 */

export interface ResumeSnapshot {
  application: ApplicationRecord;
  pendingApprovals: ApprovalRequestRecord[];
  resolvedApprovals: ApprovalRequestRecord[];
  readyForSubmission: ApprovalRequestRecord | null;
  status: ApplicationRecord["status"];
  blockedByApprovalIds: string[];
  isReadyForSubmission: boolean;
}

export function snapshotApplication(applicationId: string): ResumeSnapshot {
  const application = applicationQueries.get(applicationId);
  if (!application) {
    throw new Error(`application ${applicationId} not found.`);
  }

  const all = approvalQueries.listForApplication(applicationId);
  const pending = all.filter((row) => row.status === "pending");
  const resolved = all.filter((row) => row.status !== "pending");
  const readyForSubmission =
    all.find((row) => row.actionType === "ready_for_submission") ?? null;

  const blockedByApprovalIds = readyForSubmission
    ? (readyForSubmission.blockingSiblings ?? []).filter((id) => {
        const sibling = approvalQueries.get(id);
        return sibling?.status === "pending";
      })
    : [];

  const isReadyForSubmission =
    application.status === "ready_for_user_submission" ||
    (readyForSubmission?.status === "approved" &&
      pending.every((row) => row.id === readyForSubmission.id));

  return {
    application,
    pendingApprovals: pending,
    resolvedApprovals: resolved,
    readyForSubmission,
    status: application.status,
    blockedByApprovalIds,
    isReadyForSubmission
  };
}

export interface ResumeApplicationResult {
  snapshot: ResumeSnapshot;
  events: WorkflowEvent[];
}

export function resumeApplication(applicationId: string): ResumeApplicationResult {
  const snapshot = snapshotApplication(applicationId);
  const now = dbClient.now();
  const events: WorkflowEvent[] = [];

  events.push(
    createWorkflowEvent(workflowEvents.applicationResumed, {
      applicationId: snapshot.application.id,
      userId: snapshot.application.userId,
      programId: snapshot.application.programId,
      resumedAt: now,
      pendingApprovals: snapshot.pendingApprovals.length,
      resolvedApprovals: snapshot.resolvedApprovals.length,
      status: snapshot.status as ApplicationStatusName
    })
  );

  return { snapshot, events };
}

export function resumeAllForUser(userId: string): ResumeApplicationResult[] {
  const applications = applicationQueries.listForUser(userId);
  return applications.map((row) => resumeApplication(row.id));
}
