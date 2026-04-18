import { assertEvidenceBinding } from "../../evidence/validator";
import { dbClient } from "../client";
import type {
  DepartmentRecord,
  UniversityRecord
} from "../schema";

export interface UpsertUniversityInput {
  id: string;
  canonicalName: string;
  aliases?: string[];
  country: string;
  state?: string | null;
  tierTag?: string | null;
  primaryDomain: string;
  ipedsId?: string | null;
  evidenceIds: readonly string[];
}

export interface UpsertDepartmentInput {
  id: string;
  universityId: string;
  name: string;
  website?: string | null;
  admissionsUrl?: string | null;
  staffDirectoryUrl?: string | null;
  evidenceIds: readonly string[];
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function findUniversityByDomain(domain: string): UniversityRecord | null {
  const normalized = normalizeDomain(domain);

  return (
    dbClient.list("university", (row) => row.primaryDomain === normalized)[0] ??
    null
  );
}

function findDepartmentByName(
  universityId: string,
  name: string
): DepartmentRecord | null {
  const target = name.trim().toLowerCase();

  return (
    dbClient.list(
      "department",
      (row) =>
        row.universityId === universityId &&
        row.name.trim().toLowerCase() === target
    )[0] ?? null
  );
}

/**
 * Pre-allocate a university id for the given domain. Returns the existing id
 * if one is on file, or mints a fresh uuidv7 without persisting a row yet.
 * Used by agents that must create evidence against the final subject_id
 * *before* the upsert.
 */
function allocateUniversityId(primaryDomain: string): {
  id: string;
  isNew: boolean;
} {
  const existing = findUniversityByDomain(primaryDomain);

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  return { id: dbClient.createId("university"), isNew: true };
}

function allocateDepartmentId(
  universityId: string,
  name: string
): { id: string; isNew: boolean } {
  const existing = findDepartmentByName(universityId, name);

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  return { id: dbClient.createId("department"), isNew: true };
}

export const universityQueries = {
  allocateId(primaryDomain: string): { id: string; isNew: boolean } {
    return allocateUniversityId(primaryDomain);
  },

  allocateDepartmentId(
    universityId: string,
    name: string
  ): { id: string; isNew: boolean } {
    return allocateDepartmentId(universityId, name);
  },

  upsert(input: UpsertUniversityInput): UniversityRecord {
    if (input.evidenceIds.length === 0) {
      throw new Error(
        `University "${input.canonicalName}" must be created with at least one evidence row.`
      );
    }

    const primaryDomain = normalizeDomain(input.primaryDomain);
    const existing = findUniversityByDomain(primaryDomain);
    const now = dbClient.now();

    if (existing) {
      const mergedEvidence = Array.from(
        new Set([...existing.evidenceIds, ...input.evidenceIds])
      );
      const updated = dbClient.update("university", existing.id, (row) => ({
        ...row,
        aliases: Array.from(new Set([...row.aliases, ...(input.aliases ?? [])])),
        canonicalName: input.canonicalName || row.canonicalName,
        state: input.state ?? row.state,
        tierTag: input.tierTag ?? row.tierTag,
        ipedsId: input.ipedsId ?? row.ipedsId,
        lastVerifiedAt: now,
        evidenceIds: mergedEvidence,
        updatedAt: now
      }));

      assertEvidenceBinding({
        subjectType: "university",
        subjectId: updated.id,
        evidenceIds: updated.evidenceIds
      });

      return updated;
    }

    const record: UniversityRecord = {
      id: input.id,
      canonicalName: input.canonicalName,
      aliases: input.aliases ?? [],
      country: input.country,
      state: input.state ?? null,
      tierTag: input.tierTag ?? null,
      primaryDomain,
      ipedsId: input.ipedsId ?? null,
      lastVerifiedAt: now,
      evidenceIds: [...input.evidenceIds],
      createdAt: now,
      updatedAt: now
    };

    assertEvidenceBinding({
      subjectType: "university",
      subjectId: input.id,
      evidenceIds: record.evidenceIds
    });

    return dbClient.insert("university", record);
  },

  upsertDepartment(input: UpsertDepartmentInput): DepartmentRecord {
    if (input.evidenceIds.length === 0) {
      throw new Error(
        `Department "${input.name}" must be created with at least one evidence row.`
      );
    }

    const existing = findDepartmentByName(input.universityId, input.name);
    const now = dbClient.now();

    if (existing) {
      const mergedEvidence = Array.from(
        new Set([...existing.evidenceIds, ...input.evidenceIds])
      );
      const updated = dbClient.update("department", existing.id, (row) => ({
        ...row,
        website: input.website ?? row.website,
        admissionsUrl: input.admissionsUrl ?? row.admissionsUrl,
        staffDirectoryUrl: input.staffDirectoryUrl ?? row.staffDirectoryUrl,
        lastVerifiedAt: now,
        evidenceIds: mergedEvidence,
        updatedAt: now
      }));

      assertEvidenceBinding({
        subjectType: "department",
        subjectId: updated.id,
        evidenceIds: updated.evidenceIds
      });

      return updated;
    }

    const record: DepartmentRecord = {
      id: input.id,
      universityId: input.universityId,
      name: input.name,
      website: input.website ?? null,
      admissionsUrl: input.admissionsUrl ?? null,
      staffDirectoryUrl: input.staffDirectoryUrl ?? null,
      lastVerifiedAt: now,
      evidenceIds: [...input.evidenceIds],
      createdAt: now,
      updatedAt: now
    };

    assertEvidenceBinding({
      subjectType: "department",
      subjectId: input.id,
      evidenceIds: record.evidenceIds
    });

    return dbClient.insert("department", record);
  },

  listAll(): UniversityRecord[] {
    return dbClient.list("university");
  },

  listDepartments(universityId: string): DepartmentRecord[] {
    return dbClient.list(
      "department",
      (row) => row.universityId === universityId
    );
  }
} as const;
