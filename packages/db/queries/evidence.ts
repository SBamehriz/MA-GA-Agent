import { dbClient } from "../client";
import type { EvidenceSourceType, SourceDocumentKind } from "../enums";
import type { EvidenceRecord, JsonObject, JsonValue, OnboardingAnswerRecord, SourceDocumentRecord } from "../schema";

export interface CreateEvidenceInput {
  metadata?: JsonObject;
  quotedText: string;
  revisionId?: string | null;
  sourceAnswerId?: string | null;
  sourceDocumentId?: string | null;
  sourceLabel: string;
  sourceRef?: string | null;
  sourceType: EvidenceSourceType;
  subjectId: string;
  subjectType: string;
  userId?: string | null;
}

export interface CreateAnswerEvidenceInput {
  onboardingAnswerId: string;
  subjectId: string;
  subjectType: string;
}

export interface CreateDocumentEvidenceInput {
  sourceDocumentId: string;
  subjectId: string;
  subjectType: string;
}

function normalizeQuotedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function serializeJsonValue(value: JsonValue): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function mapDocumentKindToEvidenceSourceType(kind: SourceDocumentKind): EvidenceSourceType {
  switch (kind) {
    case "resume":
      return "resume";
    case "transcript":
      return "transcript";
    case "writing_sample":
      return "writing_sample";
    case "test_report":
      return "test_report";
    case "portfolio":
      return "portfolio";
    case "reference_material":
      return "reference_material";
    case "other":
    default:
      return "other_document";
  }
}

function getExistingEvidence(input: CreateEvidenceInput): EvidenceRecord | null {
  const quotedText = normalizeQuotedText(input.quotedText);

  return (
    dbClient.list("evidence", (row) => {
      return (
        row.subjectId === input.subjectId &&
        row.subjectType === input.subjectType &&
        row.sourceType === input.sourceType &&
        row.sourceDocumentId === (input.sourceDocumentId ?? null) &&
        row.sourceAnswerId === (input.sourceAnswerId ?? null) &&
        row.quotedText === quotedText
      );
    })[0] ?? null
  );
}

function getSourceDocument(sourceDocumentId: string): SourceDocumentRecord {
  const sourceDocument = dbClient.get("sourceDocument", sourceDocumentId);

  if (!sourceDocument) {
    throw new Error(`Missing source document: ${sourceDocumentId}`);
  }

  return sourceDocument;
}

function getOnboardingAnswer(onboardingAnswerId: string): OnboardingAnswerRecord {
  const onboardingAnswer = dbClient.get("onboardingAnswer", onboardingAnswerId);

  if (!onboardingAnswer) {
    throw new Error(`Missing onboarding answer: ${onboardingAnswerId}`);
  }

  return onboardingAnswer;
}

export const evidenceQueries = {
  create(input: CreateEvidenceInput): EvidenceRecord {
    const quotedText = normalizeQuotedText(input.quotedText);

    if (!quotedText) {
      throw new Error("Evidence requires non-empty quoted text.");
    }

    const existing = getExistingEvidence({
      ...input,
      quotedText
    });

    if (existing) {
      return existing;
    }

    const evidence: EvidenceRecord = {
      id: dbClient.createId("evidence"),
      userId: input.userId ?? null,
      revisionId: input.revisionId ?? null,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
      sourceRef: input.sourceRef ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
      sourceAnswerId: input.sourceAnswerId ?? null,
      quotedText,
      createdAt: dbClient.now(),
      metadata: input.metadata ?? {}
    };

    return dbClient.insert("evidence", evidence);
  },

  createForOnboardingAnswer(input: CreateAnswerEvidenceInput): EvidenceRecord {
    const onboardingAnswer = getOnboardingAnswer(input.onboardingAnswerId);

    return evidenceQueries.create({
      quotedText: serializeJsonValue(onboardingAnswer.answer),
      revisionId: onboardingAnswer.revisionId,
      sourceAnswerId: onboardingAnswer.id,
      sourceLabel: onboardingAnswer.questionKey,
      sourceType: "onboarding_answer",
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      userId: onboardingAnswer.userId
    });
  },

  createForSourceDocument(input: CreateDocumentEvidenceInput): EvidenceRecord | null {
    const sourceDocument = getSourceDocument(input.sourceDocumentId);
    const quotedText = normalizeQuotedText(sourceDocument.extractedText ?? "");

    if (!quotedText) {
      return null;
    }

    return evidenceQueries.create({
      quotedText,
      revisionId: sourceDocument.revisionId,
      sourceDocumentId: sourceDocument.id,
      sourceLabel: sourceDocument.label,
      sourceRef: sourceDocument.storageRef,
      sourceType: mapDocumentKindToEvidenceSourceType(sourceDocument.kind),
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      userId: sourceDocument.userId
    });
  },

  createUserAttested(input: Omit<CreateEvidenceInput, "sourceLabel" | "sourceType"> & { sourceLabel?: string }) {
    return evidenceQueries.create({
      ...input,
      sourceLabel: input.sourceLabel ?? "user_attested",
      sourceType: "user_attested"
    });
  },

  listForRevision(revisionId: string): EvidenceRecord[] {
    return dbClient.list("evidence", (row) => row.revisionId === revisionId);
  },

  listForSubject(subjectType: string, subjectId: string): EvidenceRecord[] {
    return dbClient.list("evidence", (row) => {
      return row.subjectType === subjectType && row.subjectId === subjectId;
    });
  }
} as const;
