import { dbClient } from "../client";
import type {
  ApplicationArtifactKind,
  ApplicationArtifactStatus,
  ApplicationStatus
} from "../enums";
import type {
  ApplicationArtifactRecord,
  ApplicationRecord,
  JsonObject,
  JsonValue
} from "../schema";

/**
 * Application + artifact persistence helpers.
 *
 * These are thin wrappers on dbClient so the application-prep writer, the
 * approval resolver, and the future resume workflow all go through one
 * place. We keep no implicit cascading: approval-request state is managed
 * by approvalQueries (see ./approval.ts) and the caller is responsible for
 * ordering.
 */

export interface CreateApplicationInput {
  id?: string;
  userId: string;
  revisionId: string;
  programId: string;
  universityId: string;
  fundingId: string | null;
  personRoleId: string | null;
  professionalProfileId: string | null;
  status: ApplicationStatus;
  prepCycleId: string;
  readinessJson: JsonObject;
  checklistJson: JsonValue[];
  blockers: string[];
  warnings: string[];
  artifactIds?: string[];
  approvalRequestIds?: string[];
}

export interface CreateApplicationArtifactInput {
  id?: string;
  applicationId: string;
  userId: string;
  kind: ApplicationArtifactKind;
  status: ApplicationArtifactStatus;
  title: string;
  contentText: string;
  wordCount: number;
  draftVersion?: number;
  writingRequestId: string | null;
  writingSectionsJson: JsonValue[];
  groundingJson: JsonObject;
  styleJson: JsonObject;
  criticJson: JsonObject;
  usageSummaryJson: JsonObject;
  rejectionReasons: string[];
}

function nowIso(): string {
  return dbClient.now();
}

export const applicationQueries = {
  create(input: CreateApplicationInput): ApplicationRecord {
    const id = input.id ?? dbClient.createId("application");
    const now = nowIso();
    const row: ApplicationRecord = {
      id,
      userId: input.userId,
      revisionId: input.revisionId,
      programId: input.programId,
      universityId: input.universityId,
      fundingId: input.fundingId,
      personRoleId: input.personRoleId,
      professionalProfileId: input.professionalProfileId,
      status: input.status,
      prepCycleId: input.prepCycleId,
      readinessJson: input.readinessJson,
      checklistJson: input.checklistJson,
      blockers: [...input.blockers],
      warnings: [...input.warnings],
      artifactIds: input.artifactIds ? [...input.artifactIds] : [],
      approvalRequestIds: input.approvalRequestIds
        ? [...input.approvalRequestIds]
        : [],
      submittedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now
    };
    return dbClient.insert("application", row);
  },

  get(id: string): ApplicationRecord | null {
    return dbClient.get("application", id);
  },

  list(predicate?: (row: ApplicationRecord) => boolean): ApplicationRecord[] {
    return dbClient.list("application", predicate);
  },

  listForUser(userId: string): ApplicationRecord[] {
    return dbClient.list("application", (row) => row.userId === userId);
  },

  listForPrepCycle(prepCycleId: string): ApplicationRecord[] {
    return dbClient.list(
      "application",
      (row) => row.prepCycleId === prepCycleId
    );
  },

  setStatus(
    id: string,
    status: ApplicationStatus,
    patch?: {
      blockers?: string[];
      warnings?: string[];
      readinessJson?: JsonObject;
      checklistJson?: JsonValue[];
      submittedAt?: string | null;
      cancelledAt?: string | null;
    }
  ): ApplicationRecord {
    return dbClient.update("application", id, (current) => ({
      ...current,
      status,
      blockers: patch?.blockers ?? current.blockers,
      warnings: patch?.warnings ?? current.warnings,
      readinessJson: patch?.readinessJson ?? current.readinessJson,
      checklistJson: patch?.checklistJson ?? current.checklistJson,
      submittedAt:
        patch?.submittedAt === undefined
          ? current.submittedAt
          : patch.submittedAt,
      cancelledAt:
        patch?.cancelledAt === undefined
          ? current.cancelledAt
          : patch.cancelledAt,
      updatedAt: nowIso()
    }));
  },

  attachArtifact(applicationId: string, artifactId: string): ApplicationRecord {
    return dbClient.update("application", applicationId, (current) => {
      if (current.artifactIds.includes(artifactId)) return current;
      return {
        ...current,
        artifactIds: [...current.artifactIds, artifactId],
        updatedAt: nowIso()
      };
    });
  },

  attachApprovalRequest(
    applicationId: string,
    approvalRequestId: string
  ): ApplicationRecord {
    return dbClient.update("application", applicationId, (current) => {
      if (current.approvalRequestIds.includes(approvalRequestId)) return current;
      return {
        ...current,
        approvalRequestIds: [...current.approvalRequestIds, approvalRequestId],
        updatedAt: nowIso()
      };
    });
  }
} as const;

export const applicationArtifactQueries = {
  create(input: CreateApplicationArtifactInput): ApplicationArtifactRecord {
    const id = input.id ?? dbClient.createId("appArtifact");
    const now = nowIso();
    const row: ApplicationArtifactRecord = {
      id,
      applicationId: input.applicationId,
      userId: input.userId,
      kind: input.kind,
      status: input.status,
      title: input.title,
      contentText: input.contentText,
      wordCount: input.wordCount,
      draftVersion: input.draftVersion ?? 1,
      writingRequestId: input.writingRequestId,
      writingSectionsJson: input.writingSectionsJson,
      groundingJson: input.groundingJson,
      styleJson: input.styleJson,
      criticJson: input.criticJson,
      usageSummaryJson: input.usageSummaryJson,
      rejectionReasons: [...input.rejectionReasons],
      approvedByUserAt: null,
      supersededBy: null,
      createdAt: now,
      updatedAt: now
    };
    return dbClient.insert("applicationArtifact", row);
  },

  get(id: string): ApplicationArtifactRecord | null {
    return dbClient.get("applicationArtifact", id);
  },

  listForApplication(applicationId: string): ApplicationArtifactRecord[] {
    return dbClient.list(
      "applicationArtifact",
      (row) => row.applicationId === applicationId
    );
  },

  listForWritingRequest(
    writingRequestId: string
  ): ApplicationArtifactRecord[] {
    return dbClient.list(
      "applicationArtifact",
      (row) => row.writingRequestId === writingRequestId
    );
  },

  setStatus(
    id: string,
    status: ApplicationArtifactStatus,
    patch?: {
      approvedByUserAt?: string | null;
      supersededBy?: string | null;
      rejectionReasons?: string[];
    }
  ): ApplicationArtifactRecord {
    return dbClient.update("applicationArtifact", id, (current) => ({
      ...current,
      status,
      approvedByUserAt:
        patch?.approvedByUserAt === undefined
          ? current.approvedByUserAt
          : patch.approvedByUserAt,
      supersededBy:
        patch?.supersededBy === undefined
          ? current.supersededBy
          : patch.supersededBy,
      rejectionReasons:
        patch?.rejectionReasons === undefined
          ? current.rejectionReasons
          : [...patch.rejectionReasons],
      updatedAt: nowIso()
    }));
  }
} as const;
