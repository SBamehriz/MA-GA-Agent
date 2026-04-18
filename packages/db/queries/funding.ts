import { assertEvidenceBinding } from "../../evidence/validator";
import { dbClient } from "../client";
import type {
  FundingClass,
  FundingHostType,
  StipendPeriod,
  TuitionCoverage
} from "../enums";
import type { FundingOpportunityRecord, JsonObject } from "../schema";

export interface UpsertFundingOpportunityInput {
  id: string;
  universityId: string;
  departmentId?: string | null;
  programId?: string | null;
  hostType: FundingHostType;
  title: string;
  description: string;
  fundingClass: FundingClass;
  tuitionCoverage: TuitionCoverage;
  stipendAmount?: number | null;
  stipendCurrency?: string;
  stipendPeriod: StipendPeriod;
  ftePct?: number | null;
  eligibility?: JsonObject;
  intlEligible?: boolean | null;
  applicationUrl?: string | null;
  deadlineDate?: string | null;
  primaryContactId?: string | null;
  confidence: number;
  classificationNotes: string[];
  taxonomyMatches: string[];
  evidenceIds: readonly string[];
}

function findFundingByTitle(
  universityId: string,
  title: string
): FundingOpportunityRecord | null {
  const target = title.trim().toLowerCase();

  return (
    dbClient.list(
      "fundingOpportunity",
      (row) =>
        row.universityId === universityId &&
        row.title.trim().toLowerCase() === target
    )[0] ?? null
  );
}

export const fundingQueries = {
  allocateId(
    universityId: string,
    title: string
  ): { id: string; isNew: boolean } {
    const existing = findFundingByTitle(universityId, title);

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    return { id: dbClient.createId("funding"), isNew: true };
  },

  upsert(input: UpsertFundingOpportunityInput): FundingOpportunityRecord {
    if (input.evidenceIds.length === 0) {
      throw new Error(
        `Funding opportunity "${input.title}" must be created with at least one evidence row.`
      );
    }

    if (
      (input.fundingClass === "full_tuition_plus_stipend" ||
        input.fundingClass === "full_tuition_only") &&
      input.taxonomyMatches.length === 0
    ) {
      throw new Error(
        `Funding opportunity "${input.title}" classified as "${input.fundingClass}" must have at least one taxonomy phrase match (agents.md §4.6).`
      );
    }

    const now = dbClient.now();
    const existing = findFundingByTitle(input.universityId, input.title);

    if (existing) {
      const mergedEvidence = Array.from(
        new Set([...existing.evidenceIds, ...input.evidenceIds])
      );
      const updated = dbClient.update(
        "fundingOpportunity",
        existing.id,
        (row) => ({
          ...row,
          description: input.description || row.description,
          departmentId: input.departmentId ?? row.departmentId,
          programId: input.programId ?? row.programId,
          hostType: input.hostType,
          fundingClass: input.fundingClass,
          tuitionCoverage: input.tuitionCoverage,
          stipendAmount: input.stipendAmount ?? row.stipendAmount,
          stipendCurrency: input.stipendCurrency ?? row.stipendCurrency,
          stipendPeriod: input.stipendPeriod,
          ftePct: input.ftePct ?? row.ftePct,
          eligibility: input.eligibility ?? row.eligibility,
          intlEligible: input.intlEligible ?? row.intlEligible,
          applicationUrl: input.applicationUrl ?? row.applicationUrl,
          deadlineDate: input.deadlineDate ?? row.deadlineDate,
          primaryContactId: input.primaryContactId ?? row.primaryContactId,
          confidence: input.confidence,
          classificationNotes: input.classificationNotes,
          taxonomyMatches: input.taxonomyMatches,
          lastVerifiedAt: now,
          evidenceIds: mergedEvidence,
          updatedAt: now
        })
      );

      assertEvidenceBinding({
        subjectType: "funding_opportunity",
        subjectId: updated.id,
        evidenceIds: updated.evidenceIds
      });

      return updated;
    }

    const record: FundingOpportunityRecord = {
      id: input.id,
      universityId: input.universityId,
      departmentId: input.departmentId ?? null,
      programId: input.programId ?? null,
      hostType: input.hostType,
      title: input.title,
      description: input.description,
      fundingClass: input.fundingClass,
      tuitionCoverage: input.tuitionCoverage,
      stipendAmount: input.stipendAmount ?? null,
      stipendCurrency: input.stipendCurrency ?? "USD",
      stipendPeriod: input.stipendPeriod,
      ftePct: input.ftePct ?? null,
      eligibility: input.eligibility ?? {},
      intlEligible: input.intlEligible ?? null,
      applicationUrl: input.applicationUrl ?? null,
      deadlineDate: input.deadlineDate ?? null,
      primaryContactId: input.primaryContactId ?? null,
      confidence: input.confidence,
      classificationNotes: input.classificationNotes,
      taxonomyMatches: input.taxonomyMatches,
      lastVerifiedAt: now,
      evidenceIds: [...input.evidenceIds],
      createdAt: now,
      updatedAt: now
    };

    assertEvidenceBinding({
      subjectType: "funding_opportunity",
      subjectId: input.id,
      evidenceIds: record.evidenceIds
    });

    return dbClient.insert("fundingOpportunity", record);
  },

  bindContact(
    fundingOpportunityId: string,
    contactPersonId: string
  ): FundingOpportunityRecord {
    return dbClient.update(
      "fundingOpportunity",
      fundingOpportunityId,
      (row) => ({
        ...row,
        primaryContactId: contactPersonId,
        updatedAt: dbClient.now()
      })
    );
  },

  listByUniversity(universityId: string): FundingOpportunityRecord[] {
    return dbClient.list(
      "fundingOpportunity",
      (row) => row.universityId === universityId
    );
  },

  listByProgram(programId: string): FundingOpportunityRecord[] {
    return dbClient.list(
      "fundingOpportunity",
      (row) => row.programId === programId
    );
  },

  listByDepartment(departmentId: string): FundingOpportunityRecord[] {
    return dbClient.list(
      "fundingOpportunity",
      (row) => row.departmentId === departmentId
    );
  }
} as const;
