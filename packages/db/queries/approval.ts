import { dbClient } from "../client";
import type {
  ApprovalRequestActionType,
  ApprovalRequestDefaultAction,
  ApprovalRequestStatus
} from "../enums";
import type { ApprovalRequestRecord, JsonObject } from "../schema";

export interface CreateApprovalRequestInput {
  id?: string;
  userId: string;
  applicationId: string;
  artifactId: string | null;
  prepCycleId: string;
  actionType: ApprovalRequestActionType;
  status?: ApprovalRequestStatus;
  defaultAction: ApprovalRequestDefaultAction;
  reason: string;
  actionRequired: string;
  groundingJson: JsonObject | null;
  evidenceJson: JsonObject | null;
  payloadJson: JsonObject;
  checklistItemIds: string[];
  blockingSiblings?: string[];
}

export interface ResolveApprovalRequestPatch {
  status: ApprovalRequestStatus;
  decisionNote?: string | null;
  decisionActorHint?: string | null;
  decidedAt?: string;
}

function nowIso(): string {
  return dbClient.now();
}

export const approvalQueries = {
  create(input: CreateApprovalRequestInput): ApprovalRequestRecord {
    const id = input.id ?? dbClient.createId("approval");
    const now = nowIso();
    const row: ApprovalRequestRecord = {
      id,
      userId: input.userId,
      applicationId: input.applicationId,
      artifactId: input.artifactId,
      prepCycleId: input.prepCycleId,
      actionType: input.actionType,
      status: input.status ?? "pending",
      defaultAction: input.defaultAction,
      reason: input.reason,
      actionRequired: input.actionRequired,
      groundingJson: input.groundingJson,
      evidenceJson: input.evidenceJson,
      payloadJson: input.payloadJson,
      checklistItemIds: [...input.checklistItemIds],
      decidedByUserAt: null,
      decisionNote: null,
      decisionActorHint: null,
      blockingSiblings: input.blockingSiblings
        ? [...input.blockingSiblings]
        : [],
      createdAt: now,
      updatedAt: now
    };
    return dbClient.insert("approvalRequest", row);
  },

  get(id: string): ApprovalRequestRecord | null {
    return dbClient.get("approvalRequest", id);
  },

  list(
    predicate?: (row: ApprovalRequestRecord) => boolean
  ): ApprovalRequestRecord[] {
    return dbClient.list("approvalRequest", predicate);
  },

  listPendingForUser(userId: string): ApprovalRequestRecord[] {
    return dbClient.list(
      "approvalRequest",
      (row) => row.userId === userId && row.status === "pending"
    );
  },

  listForApplication(applicationId: string): ApprovalRequestRecord[] {
    return dbClient.list(
      "approvalRequest",
      (row) => row.applicationId === applicationId
    );
  },

  listPendingForApplication(applicationId: string): ApprovalRequestRecord[] {
    return dbClient.list(
      "approvalRequest",
      (row) =>
        row.applicationId === applicationId && row.status === "pending"
    );
  },

  setBlockingSiblings(
    id: string,
    blockingSiblings: readonly string[]
  ): ApprovalRequestRecord {
    return dbClient.update("approvalRequest", id, (current) => ({
      ...current,
      blockingSiblings: [...blockingSiblings],
      updatedAt: nowIso()
    }));
  },

  /**
   * Idempotent resolution write — the caller is responsible for validating
   * that the transition is legal. Allowed statuses: pending -> {approved,
   * edited, rejected, skipped, expired}.
   */
  resolve(
    id: string,
    patch: ResolveApprovalRequestPatch
  ): ApprovalRequestRecord {
    const decidedAt = patch.decidedAt ?? nowIso();
    return dbClient.update("approvalRequest", id, (current) => {
      if (current.status !== "pending" && patch.status !== "pending") {
        throw new Error(
          `approvalRequest ${id} already resolved with status ${current.status}; cannot overwrite.`
        );
      }
      return {
        ...current,
        status: patch.status,
        decidedByUserAt: decidedAt,
        decisionNote:
          patch.decisionNote === undefined
            ? current.decisionNote
            : patch.decisionNote,
        decisionActorHint:
          patch.decisionActorHint === undefined
            ? current.decisionActorHint
            : patch.decisionActorHint,
        updatedAt: decidedAt
      };
    });
  }
} as const;
