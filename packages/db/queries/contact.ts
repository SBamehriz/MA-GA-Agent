import { assertEvidenceBinding } from "../../evidence/validator";
import { dbClient } from "../client";
import type {
  ProfessionalProfileProvider,
  ProfessionalProfileType,
  RoleTag
} from "../enums";
import type {
  PersonRecord,
  PersonRoleRecord,
  ProfessionalProfileRecord
} from "../schema";

export interface UpsertPersonInput {
  canonicalName: string;
  nameAliases?: string[];
  preferredEmail?: string | null;
  emails?: string[];
  primaryOrgId?: string | null;
}

export interface UpsertPersonRoleInput {
  id: string;
  personId: string;
  universityId: string;
  departmentId?: string | null;
  programId?: string | null;
  roleTag: RoleTag;
  roleTitle: string;
  researchAreas?: string[];
  relevanceScore: number;
  startDate?: string | null;
  endDate?: string | null;
  evidenceIds: readonly string[];
}

export interface UpsertProfessionalProfileInput {
  id: string;
  personId: string;
  type: ProfessionalProfileType;
  url: string;
  provider: ProfessionalProfileProvider;
  confidence: number;
  verificationSignals?: string[];
  institutionMatch?: boolean;
  titleMatch?: boolean;
  researchAreaOverlap?: number;
  evidenceIds: readonly string[];
}

function findPersonByName(canonicalName: string): PersonRecord | null {
  const target = canonicalName.trim().toLowerCase();

  return (
    dbClient.list(
      "person",
      (row) => row.canonicalName.trim().toLowerCase() === target
    )[0] ?? null
  );
}

function findPersonRole(
  personId: string,
  universityId: string,
  departmentId: string | null,
  roleTag: RoleTag
): PersonRoleRecord | null {
  return (
    dbClient.list(
      "personRole",
      (row) =>
        row.personId === personId &&
        row.universityId === universityId &&
        (row.departmentId ?? null) === (departmentId ?? null) &&
        row.roleTag === roleTag
    )[0] ?? null
  );
}

function findProfessionalProfile(
  personId: string,
  url: string
): ProfessionalProfileRecord | null {
  const target = url.trim().toLowerCase();

  return (
    dbClient.list(
      "professionalProfile",
      (row) =>
        row.personId === personId && row.url.trim().toLowerCase() === target
    )[0] ?? null
  );
}

export const contactQueries = {
  allocatePersonRoleId(
    personId: string,
    universityId: string,
    departmentId: string | null,
    roleTag: RoleTag
  ): { id: string; isNew: boolean } {
    const existing = findPersonRole(
      personId,
      universityId,
      departmentId,
      roleTag
    );

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    return { id: dbClient.createId("personRole"), isNew: true };
  },

  allocateProfessionalProfileId(
    personId: string,
    url: string
  ): { id: string; isNew: boolean } {
    const existing = findProfessionalProfile(personId, url);

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    return { id: dbClient.createId("profile"), isNew: true };
  },

  upsertPerson(input: UpsertPersonInput): PersonRecord {
    const existing = findPersonByName(input.canonicalName);
    const now = dbClient.now();

    if (existing) {
      return dbClient.update("person", existing.id, (row) => ({
        ...row,
        canonicalName: input.canonicalName,
        nameAliases: Array.from(
          new Set([...row.nameAliases, ...(input.nameAliases ?? [])])
        ),
        preferredEmail: input.preferredEmail ?? row.preferredEmail,
        emails: Array.from(new Set([...row.emails, ...(input.emails ?? [])])),
        primaryOrgId: input.primaryOrgId ?? row.primaryOrgId,
        updatedAt: now
      }));
    }

    const id = dbClient.createId("person");
    const record: PersonRecord = {
      id,
      canonicalName: input.canonicalName,
      nameAliases: input.nameAliases ?? [],
      preferredEmail: input.preferredEmail ?? null,
      emails: input.emails ?? [],
      primaryOrgId: input.primaryOrgId ?? null,
      mergedInto: null,
      createdAt: now,
      updatedAt: now
    };

    return dbClient.insert("person", record);
  },

  upsertPersonRole(input: UpsertPersonRoleInput): PersonRoleRecord {
    if (input.evidenceIds.length === 0) {
      throw new Error(
        `PersonRole for person "${input.personId}" must carry at least one evidence row.`
      );
    }

    const now = dbClient.now();
    const existing = findPersonRole(
      input.personId,
      input.universityId,
      input.departmentId ?? null,
      input.roleTag
    );

    if (existing) {
      const mergedEvidence = Array.from(
        new Set([...existing.evidenceIds, ...input.evidenceIds])
      );
      const updated = dbClient.update("personRole", existing.id, (row) => ({
        ...row,
        programId: input.programId ?? row.programId,
        roleTitle: input.roleTitle,
        researchAreas: Array.from(
          new Set([...row.researchAreas, ...(input.researchAreas ?? [])])
        ),
        relevanceScore: input.relevanceScore,
        startDate: input.startDate ?? row.startDate,
        endDate: input.endDate ?? row.endDate,
        evidenceIds: mergedEvidence,
        updatedAt: now
      }));

      assertEvidenceBinding({
        subjectType: "person_role",
        subjectId: updated.id,
        evidenceIds: updated.evidenceIds
      });

      return updated;
    }

    const record: PersonRoleRecord = {
      id: input.id,
      personId: input.personId,
      universityId: input.universityId,
      departmentId: input.departmentId ?? null,
      programId: input.programId ?? null,
      roleTag: input.roleTag,
      roleTitle: input.roleTitle,
      researchAreas: input.researchAreas ?? [],
      relevanceScore: input.relevanceScore,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      evidenceIds: [...input.evidenceIds],
      createdAt: now,
      updatedAt: now
    };

    assertEvidenceBinding({
      subjectType: "person_role",
      subjectId: input.id,
      evidenceIds: record.evidenceIds
    });

    return dbClient.insert("personRole", record);
  },

  upsertProfessionalProfile(
    input: UpsertProfessionalProfileInput
  ): ProfessionalProfileRecord {
    if (input.evidenceIds.length === 0) {
      throw new Error(
        `Professional profile for person "${input.personId}" must carry at least one evidence row.`
      );
    }

    if (input.type === "linkedin" && input.provider === "directory") {
      throw new Error(
        `LinkedIn profile for person "${input.personId}" cannot be sourced from "directory" — provider must be user_attested or approved_provider_stub (CLAUDE.md §8.10).`
      );
    }

    const now = dbClient.now();
    const existing = findProfessionalProfile(input.personId, input.url);

    if (existing) {
      const mergedEvidence = Array.from(
        new Set([...existing.evidenceIds, ...input.evidenceIds])
      );
      const updated = dbClient.update(
        "professionalProfile",
        existing.id,
        (row) => ({
          ...row,
          type: input.type,
          provider: input.provider,
          confidence: input.confidence,
          verificationSignals: input.verificationSignals ?? row.verificationSignals,
          institutionMatch: input.institutionMatch ?? row.institutionMatch,
          titleMatch: input.titleMatch ?? row.titleMatch,
          researchAreaOverlap:
            input.researchAreaOverlap ?? row.researchAreaOverlap,
          lastVerifiedAt: now,
          evidenceIds: mergedEvidence,
          updatedAt: now
        })
      );

      assertEvidenceBinding({
        subjectType: "professional_profile",
        subjectId: updated.id,
        evidenceIds: updated.evidenceIds
      });

      return updated;
    }

    const record: ProfessionalProfileRecord = {
      id: input.id,
      personId: input.personId,
      type: input.type,
      url: input.url,
      provider: input.provider,
      confidence: input.confidence,
      verificationSignals: input.verificationSignals ?? [],
      institutionMatch: input.institutionMatch ?? false,
      titleMatch: input.titleMatch ?? false,
      researchAreaOverlap: input.researchAreaOverlap ?? 0,
      lastVerifiedAt: now,
      evidenceIds: [...input.evidenceIds],
      createdAt: now,
      updatedAt: now
    };

    assertEvidenceBinding({
      subjectType: "professional_profile",
      subjectId: input.id,
      evidenceIds: record.evidenceIds
    });

    return dbClient.insert("professionalProfile", record);
  },

  listRolesForUniversity(universityId: string): PersonRoleRecord[] {
    return dbClient.list(
      "personRole",
      (row) => row.universityId === universityId
    );
  },

  listRolesForProgram(programId: string): PersonRoleRecord[] {
    return dbClient.list(
      "personRole",
      (row) => row.programId === programId
    );
  },

  listProfilesForPerson(personId: string): ProfessionalProfileRecord[] {
    return dbClient.list(
      "professionalProfile",
      (row) => row.personId === personId
    );
  },

  listAllPersons(): PersonRecord[] {
    return dbClient.list("person");
  }
} as const;
