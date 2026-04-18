import {
  buildApplicationPacket,
  emptyQueueTotals,
  tallyQueue,
  type ApplicationPacket,
  type ApplicationPrepResult,
  type ApprovalActionType,
  type ApprovalItem,
  type ChecklistItem
} from "../application";
import { buildApprovalQueue } from "../application/approval-queue";
import { dbClient } from "../db/client";
import type {
  ApplicationArtifactKind,
  ApplicationArtifactStatus,
  ApplicationStatus
} from "../db/enums";
import {
  applicationArtifactQueries,
  applicationQueries
} from "../db/queries/application";
import { approvalQueries } from "../db/queries/approval";
import type {
  ApplicationArtifactRecord,
  ApplicationRecord,
  ApprovalRequestRecord,
  JsonObject,
  JsonValue
} from "../db/schema";
import type { WritingArtifact, WritingReadiness } from "../writing/types";

import {
  createWorkflowEvent,
  workflowEvents,
  type ApprovalActionTypeName,
  type PacketReadinessName,
  type WorkflowEvent
} from "./events";

export interface LocalApplicationPrepInput {
  userId: string;
  revisionId: string;
  writingArtifacts: readonly WritingArtifact[];
  programIds?: readonly string[];
  userPreferences?: {
    includeCoverLetter?: boolean;
    includePersonalStatement?: boolean;
    includePortfolio?: boolean;
  };
}

export interface LocalApplicationPrepResult extends ApplicationPrepResult {
  emittedEvents: WorkflowEvent[];
  persisted: {
    applications: ApplicationRecord[];
    artifacts: ApplicationArtifactRecord[];
    approvalRequests: ApprovalRequestRecord[];
  };
}

function nowIso(): string {
  return dbClient.now();
}

function programIdsFromArtifacts(
  writingArtifacts: readonly WritingArtifact[]
): string[] {
  const ids = new Set<string>();
  for (const artifact of writingArtifacts) {
    ids.add(artifact.draft.targetProgramId);
  }
  return [...ids];
}

function projectQueueTotals(
  items: readonly ApprovalItem[]
): Record<ApprovalActionTypeName, number> {
  return tallyQueue(items) as Record<ApprovalActionTypeName, number>;
}

function mapWritingReadinessToArtifactStatus(
  readiness: WritingReadiness
): ApplicationArtifactStatus {
  switch (readiness) {
    case "ready":
      return "ready";
    case "needs_user_input":
    case "missing_inputs":
      return "needs_user_input";
    case "grounding_failed":
      return "grounding_failed";
    case "style_failed":
      return "style_failed";
  }
}

function mapWritingDocumentTypeToArtifactKind(
  documentType: WritingArtifact["request"]["documentType"]
): ApplicationArtifactKind {
  switch (documentType) {
    case "sop":
      return "sop";
    case "personal_statement":
      return "personal_statement";
    case "short_answer":
      return "short_answer";
    case "cover_letter":
      return "cover_letter";
    case "outreach_message":
      return "outreach_message";
    case "resume_tailoring":
      return "resume_tailoring";
  }
}

/**
 * Derive the persisted application.status from the in-memory packet +
 * pending approval count. We intentionally keep the mapping conservative —
 * anything with outstanding work is `awaiting_user`. `ready_for_user_submission`
 * is only reachable by the resume logic after approvals are all resolved.
 */
function deriveInitialApplicationStatus(
  packet: ApplicationPacket
): ApplicationStatus {
  if (packet.checklist.length === 0) {
    return "preparing";
  }
  return "awaiting_user";
}

function checklistItemToJson(item: ChecklistItem): JsonObject {
  return {
    id: item.id,
    programId: item.programId,
    kind: item.kind,
    category: item.category,
    label: item.label,
    required: item.required,
    origin: item.origin,
    status: item.status,
    notes: [...item.notes],
    writingRequestId: item.writingRequestId,
    writingDocumentType: item.writingDocumentType,
    writingReadiness: item.writingReadiness
  };
}

function readinessSummaryToJson(packet: ApplicationPacket): JsonObject {
  return {
    status: packet.readiness.status,
    readyItems: packet.readiness.readyItems,
    warningItems: packet.readiness.warningItems,
    missingItems: packet.readiness.missingItems,
    userInputItems: packet.readiness.userInputItems,
    deferredItems: packet.readiness.deferredItems,
    totalItems: packet.readiness.totalItems,
    blockers: [...packet.readiness.blockers],
    warnings: [...packet.readiness.warnings]
  };
}

function writingSectionsToJson(artifact: WritingArtifact): JsonValue[] {
  return artifact.draft.sections.map((section) => ({
    id: section.id,
    title: section.title,
    paragraphs: section.paragraphs.map((paragraph) => ({
      id: paragraph.id,
      heading: paragraph.heading,
      claims: paragraph.claims.map((claim) => ({
        id: claim.id,
        kind: claim.kind,
        text: claim.text,
        slotTag: claim.slotTag,
        refs: claim.refs.map((ref) => ({ type: ref.type, id: ref.id }))
      }))
    }))
  }));
}

function groundingToJson(artifact: WritingArtifact): JsonObject {
  return {
    passed: artifact.grounding.passed,
    verifiableClaims: artifact.grounding.verifiableClaims,
    supportedClaims: artifact.grounding.supportedClaims,
    stylisticClaims: artifact.grounding.stylisticClaims,
    refsByType: artifact.grounding.refsByType as unknown as JsonValue,
    unsupportedClaims: artifact.grounding.unsupportedClaims.map((claim) => ({
      claimId: claim.claimId,
      slotTag: claim.slotTag,
      kind: claim.kind,
      text: claim.text,
      reason: claim.reason
    }))
  };
}

function styleToJson(artifact: WritingArtifact): JsonObject {
  return {
    voiceAnchorId: artifact.style.voiceAnchorId,
    meanSentenceLength: artifact.style.meanSentenceLength,
    voiceAnchorMeanSentenceLength:
      artifact.style.voiceAnchorMeanSentenceLength,
    sentenceLengthDelta: artifact.style.sentenceLengthDelta,
    firstPersonRatio: artifact.style.firstPersonRatio,
    bannedPhraseHits: artifact.style.bannedPhraseHits.map((hit) => ({
      phrase: hit.phrase,
      count: hit.count
    })),
    passed: artifact.style.passed,
    notes: [...artifact.style.notes]
  };
}

function criticToJson(artifact: WritingArtifact): JsonObject {
  return {
    hasBlockers: artifact.critic.hasBlockers,
    notes: artifact.critic.notes.map((note) => ({
      code: note.code,
      severity: note.severity,
      message: note.message,
      slotTag: note.slotTag ?? null
    }))
  };
}

function usageSummaryToJson(artifact: WritingArtifact): JsonObject {
  return {
    profileFieldKeys: [...artifact.usageSummary.profileFieldKeys],
    verifiedStoryIds: [...artifact.usageSummary.verifiedStoryIds],
    programIds: [...artifact.usageSummary.programIds],
    fundingIds: [...artifact.usageSummary.fundingIds],
    personRoleIds: [...artifact.usageSummary.personRoleIds],
    universityIds: [...artifact.usageSummary.universityIds],
    professionalProfileIds: [...artifact.usageSummary.professionalProfileIds],
    voiceAnchorId: artifact.usageSummary.voiceAnchorId
  };
}

function approvalGroundingToJson(
  approval: ApprovalItem
): JsonObject | null {
  if (!approval.grounding) return null;
  return {
    verifiableClaims: approval.grounding.verifiableClaims,
    supportedClaims: approval.grounding.supportedClaims,
    unsupportedClaims: approval.grounding.unsupportedClaims,
    passed: approval.grounding.passed,
    profileFieldKeys: [...approval.grounding.profileFieldKeys],
    verifiedStoryIds: [...approval.grounding.verifiedStoryIds],
    programIds: [...approval.grounding.programIds],
    fundingIds: [...approval.grounding.fundingIds],
    personRoleIds: [...approval.grounding.personRoleIds],
    professionalProfileIds: [...approval.grounding.professionalProfileIds],
    voiceAnchorId: approval.grounding.voiceAnchorId
  };
}

function approvalEvidenceToJson(approval: ApprovalItem): JsonObject | null {
  if (!approval.evidence) return null;
  return {
    programEvidenceIds: [...approval.evidence.programEvidenceIds],
    universityEvidenceIds: [...approval.evidence.universityEvidenceIds],
    fundingEvidenceIds: [...approval.evidence.fundingEvidenceIds],
    personRoleEvidenceIds: [...approval.evidence.personRoleEvidenceIds],
    professionalProfileEvidenceIds: [
      ...approval.evidence.professionalProfileEvidenceIds
    ],
    exampleQuotes: [...approval.evidence.exampleQuotes]
  };
}

function approvalPayloadToJson(
  approval: ApprovalItem,
  packet: ApplicationPacket
): JsonObject {
  return {
    memoryItemId: approval.id,
    programId: approval.programId,
    universityId: approval.universityId,
    fundingId: approval.fundingId,
    artifactKind: approval.artifactKind,
    packetId: packet.id,
    defaultAction: approval.defaultAction
  };
}

function persistPacket(
  packet: ApplicationPacket,
  approvalItems: readonly ApprovalItem[],
  cycleId: string
): {
  application: ApplicationRecord;
  artifacts: ApplicationArtifactRecord[];
  approvalRequests: ApprovalRequestRecord[];
} {
  const application = applicationQueries.create({
    userId: packet.userId,
    revisionId: packet.revisionId,
    programId: packet.programId,
    universityId: packet.universityId,
    fundingId: packet.fundingId,
    personRoleId: packet.target.personRole?.id ?? null,
    professionalProfileId: packet.target.professionalProfile?.id ?? null,
    status: deriveInitialApplicationStatus(packet),
    prepCycleId: cycleId,
    readinessJson: readinessSummaryToJson(packet),
    checklistJson: packet.checklist.map((item) => checklistItemToJson(item)),
    blockers: [...packet.readiness.blockers],
    warnings: [...packet.readiness.warnings]
  });

  const writingRequestIdToArtifactId = new Map<string, string>();
  const artifacts: ApplicationArtifactRecord[] = [];
  for (const writingArtifact of packet.documents) {
    const record = applicationArtifactQueries.create({
      applicationId: application.id,
      userId: packet.userId,
      kind: mapWritingDocumentTypeToArtifactKind(
        writingArtifact.request.documentType
      ),
      status: mapWritingReadinessToArtifactStatus(writingArtifact.readiness),
      title: writingArtifact.draft.title,
      contentText: writingArtifact.draft.text,
      wordCount: writingArtifact.draft.wordCount,
      writingRequestId: writingArtifact.request.id,
      writingSectionsJson: writingSectionsToJson(writingArtifact),
      groundingJson: groundingToJson(writingArtifact),
      styleJson: styleToJson(writingArtifact),
      criticJson: criticToJson(writingArtifact),
      usageSummaryJson: usageSummaryToJson(writingArtifact),
      rejectionReasons: [...writingArtifact.rejectionReasons]
    });
    writingRequestIdToArtifactId.set(writingArtifact.request.id, record.id);
    applicationQueries.attachArtifact(application.id, record.id);
    artifacts.push(record);
  }

  const approvalRequests: ApprovalRequestRecord[] = [];
  const createdIdsByMemoryId = new Map<string, string>();

  for (const approval of approvalItems) {
    const persistedArtifactId = approval.artifactId
      ? writingRequestIdToArtifactId.get(approval.artifactId) ?? null
      : null;

    const record = approvalQueries.create({
      userId: approval.userId,
      applicationId: application.id,
      artifactId: persistedArtifactId,
      prepCycleId: cycleId,
      actionType: approval.actionType,
      defaultAction: approval.defaultAction,
      reason: approval.reason,
      actionRequired: approval.actionRequired,
      groundingJson: approvalGroundingToJson(approval),
      evidenceJson: approvalEvidenceToJson(approval),
      payloadJson: approvalPayloadToJson(approval, packet),
      checklistItemIds: [...approval.checklistItemIds]
    });
    createdIdsByMemoryId.set(approval.id, record.id);
    applicationQueries.attachApprovalRequest(application.id, record.id);
    approvalRequests.push(record);
  }

  // `ready_for_submission` blocks on every other pending approval for the
  // same application; we record that explicitly so the resolver can refuse
  // to resolve it early (see packages/approval/resolver.ts).
  const readyForSubmission = approvalRequests.find(
    (row) => row.actionType === "ready_for_submission"
  );
  if (readyForSubmission) {
    const blocking = approvalRequests
      .filter((row) => row.id !== readyForSubmission.id)
      .map((row) => row.id);
    if (blocking.length > 0) {
      approvalQueries.setBlockingSiblings(readyForSubmission.id, blocking);
    }
  }

  return { application, artifacts, approvalRequests };
}

/**
 * Manager workflow for the ApplicationPreparation + ApprovalQueue slice.
 *
 *   application.prep.started
 *     → per program:
 *         application.prep.packet.assembled
 *         application.prep.checklist.evaluated
 *         application.prep.approval.enqueued
 *   application.prep.complete
 *
 * This slice NEVER: submits, pays, or sends anything. Everything goes into
 * the persistent approval queue and waits for the user (CLAUDE.md §8
 * invariants 1–3, agents.md §4.17).
 */
export async function runLocalApplicationPrep(
  input: LocalApplicationPrepInput
): Promise<LocalApplicationPrepResult> {
  const cycleId = `app_prep_cycle_${Date.now().toString(36)}_${Math.floor(
    Math.random() * 1_000_000
  )
    .toString(36)
    .padStart(4, "0")}`;

  const emittedEvents: WorkflowEvent[] = [];
  const packets: ApplicationPacket[] = [];
  const approvalQueue: ApprovalItem[] = [];
  const notes: string[] = [];

  const persistedApplications: ApplicationRecord[] = [];
  const persistedArtifacts: ApplicationArtifactRecord[] = [];
  const persistedApprovals: ApprovalRequestRecord[] = [];

  const programIds =
    input.programIds && input.programIds.length > 0
      ? [...input.programIds]
      : programIdsFromArtifacts(input.writingArtifacts);

  emittedEvents.push(
    createWorkflowEvent(workflowEvents.applicationPrepStarted, {
      cycleId,
      userId: input.userId,
      revisionId: input.revisionId,
      startedAt: nowIso(),
      programCount: programIds.length,
      artifactCount: input.writingArtifacts.length
    })
  );

  const totals = {
    packets: 0,
    readyForReview: 0,
    readyWithWarnings: 0,
    needsUserInput: 0,
    blocked: 0
  };

  for (const programId of programIds) {
    try {
      const packet = buildApplicationPacket({
        userId: input.userId,
        revisionId: input.revisionId,
        programId,
        writingArtifacts: input.writingArtifacts,
        userPreferences: input.userPreferences ?? {}
      });
      packets.push(packet);
      totals.packets += 1;

      switch (packet.readiness.status) {
        case "ready_for_review":
          totals.readyForReview += 1;
          break;
        case "ready_with_warnings":
          totals.readyWithWarnings += 1;
          break;
        case "needs_user_input":
          totals.needsUserInput += 1;
          break;
        case "blocked":
          totals.blocked += 1;
          break;
      }

      emittedEvents.push(
        createWorkflowEvent(workflowEvents.applicationPacketAssembled, {
          cycleId,
          packetId: packet.id,
          programId: packet.programId,
          universityId: packet.universityId,
          fundingId: packet.fundingId,
          documentCount: packet.documents.length,
          readiness: packet.readiness.status as PacketReadinessName,
          assembledAt: nowIso()
        })
      );

      emittedEvents.push(
        createWorkflowEvent(workflowEvents.applicationChecklistEvaluated, {
          cycleId,
          packetId: packet.id,
          programId: packet.programId,
          evaluatedAt: nowIso(),
          totalItems: packet.readiness.totalItems,
          readyItems: packet.readiness.readyItems,
          warningItems: packet.readiness.warningItems,
          missingItems: packet.readiness.missingItems,
          userInputItems: packet.readiness.userInputItems,
          deferredItems: packet.readiness.deferredItems,
          readiness: packet.readiness.status as PacketReadinessName
        })
      );

      const queueItems = buildApprovalQueue({ packet });
      approvalQueue.push(...queueItems);

      const persisted = persistPacket(packet, queueItems, cycleId);
      persistedApplications.push(persisted.application);
      persistedArtifacts.push(...persisted.artifacts);
      persistedApprovals.push(...persisted.approvalRequests);

      emittedEvents.push(
        createWorkflowEvent(workflowEvents.applicationApprovalEnqueued, {
          cycleId,
          packetId: packet.id,
          programId: packet.programId,
          enqueuedAt: nowIso(),
          approvalCount: queueItems.length,
          queueTotals: projectQueueTotals(queueItems)
        })
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      notes.push(`[skip] program ${programId}: ${reason}`);
    }
  }

  const queueTotals: Record<ApprovalActionType, number> =
    approvalQueue.length > 0 ? tallyQueue(approvalQueue) : emptyQueueTotals();

  emittedEvents.push(
    createWorkflowEvent(workflowEvents.applicationPrepComplete, {
      cycleId,
      userId: input.userId,
      revisionId: input.revisionId,
      completedAt: nowIso(),
      totalPackets: totals.packets,
      readyForReview: totals.readyForReview,
      readyWithWarnings: totals.readyWithWarnings,
      needsUserInput: totals.needsUserInput,
      blocked: totals.blocked,
      totalApprovalItems: approvalQueue.length,
      queueTotals: queueTotals as Record<ApprovalActionTypeName, number>
    })
  );

  return {
    cycleId,
    emittedEvents,
    packets,
    approvalQueue,
    totals,
    queueTotals,
    notes,
    generatedAt: nowIso(),
    persisted: {
      applications: persistedApplications,
      artifacts: persistedArtifacts,
      approvalRequests: persistedApprovals
    }
  };
}
