import { assertEvidenceBinding } from "../../evidence/validator";
import { dbClient } from "../client";
import type {
  DegreeType,
  ProgramModality,
  RelevanceClass,
  ThesisOption
} from "../enums";
import type { GraduateProgramRecord } from "../schema";

export interface UpsertGraduateProgramInput {
  id: string;
  universityId: string;
  departmentId: string;
  title: string;
  aliases?: string[];
  degreeType: DegreeType;
  modality: ProgramModality;
  concentration?: string | null;
  curriculumUrl?: string | null;
  admissionsUrl?: string | null;
  thesisOption: ThesisOption;
  relevanceClass: RelevanceClass;
  keywordHits: string[];
  fitScore: number;
  active?: boolean;
  evidenceIds: readonly string[];
}

function findProgramByTitle(
  departmentId: string,
  title: string
): GraduateProgramRecord | null {
  const target = title.trim().toLowerCase();

  return (
    dbClient.list(
      "graduateProgram",
      (row) =>
        row.departmentId === departmentId &&
        row.title.trim().toLowerCase() === target
    )[0] ?? null
  );
}

export const programQueries = {
  allocateId(
    departmentId: string,
    title: string
  ): { id: string; isNew: boolean } {
    const existing = findProgramByTitle(departmentId, title);

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    return { id: dbClient.createId("program"), isNew: true };
  },

  upsert(input: UpsertGraduateProgramInput): GraduateProgramRecord {
    if (input.evidenceIds.length === 0) {
      throw new Error(
        `Program "${input.title}" must be created with at least one evidence row.`
      );
    }

    const existing = findProgramByTitle(input.departmentId, input.title);
    const now = dbClient.now();

    if (existing) {
      const mergedEvidence = Array.from(
        new Set([...existing.evidenceIds, ...input.evidenceIds])
      );
      const updated = dbClient.update("graduateProgram", existing.id, (row) => ({
        ...row,
        aliases: Array.from(new Set([...row.aliases, ...(input.aliases ?? [])])),
        degreeType: input.degreeType,
        modality: input.modality,
        concentration: input.concentration ?? row.concentration,
        curriculumUrl: input.curriculumUrl ?? row.curriculumUrl,
        admissionsUrl: input.admissionsUrl ?? row.admissionsUrl,
        thesisOption: input.thesisOption,
        relevanceClass: input.relevanceClass,
        keywordHits: Array.from(
          new Set([...row.keywordHits, ...input.keywordHits])
        ),
        fitScore: input.fitScore,
        active: input.active ?? row.active,
        lastVerifiedAt: now,
        evidenceIds: mergedEvidence,
        updatedAt: now
      }));

      assertEvidenceBinding({
        subjectType: "graduate_program",
        subjectId: updated.id,
        evidenceIds: updated.evidenceIds
      });

      return updated;
    }

    const record: GraduateProgramRecord = {
      id: input.id,
      universityId: input.universityId,
      departmentId: input.departmentId,
      title: input.title,
      aliases: input.aliases ?? [],
      degreeType: input.degreeType,
      modality: input.modality,
      concentration: input.concentration ?? null,
      curriculumUrl: input.curriculumUrl ?? null,
      admissionsUrl: input.admissionsUrl ?? null,
      thesisOption: input.thesisOption,
      relevanceClass: input.relevanceClass,
      keywordHits: input.keywordHits,
      fitScore: input.fitScore,
      active: input.active ?? true,
      lastVerifiedAt: now,
      evidenceIds: [...input.evidenceIds],
      createdAt: now,
      updatedAt: now
    };

    assertEvidenceBinding({
      subjectType: "graduate_program",
      subjectId: input.id,
      evidenceIds: record.evidenceIds
    });

    return dbClient.insert("graduateProgram", record);
  },

  listByUniversity(universityId: string): GraduateProgramRecord[] {
    return dbClient.list(
      "graduateProgram",
      (row) => row.universityId === universityId
    );
  },

  listByDepartment(departmentId: string): GraduateProgramRecord[] {
    return dbClient.list(
      "graduateProgram",
      (row) => row.departmentId === departmentId
    );
  },

  listQualified(): GraduateProgramRecord[] {
    return dbClient.list(
      "graduateProgram",
      (row) =>
        row.active &&
        (row.relevanceClass === "core" || row.relevanceClass === "adjacent")
    );
  }
} as const;
