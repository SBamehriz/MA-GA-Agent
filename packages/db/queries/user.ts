import { dbClient } from "../client";
import type {
  OnboardingAnswerFormat,
  ProfileFieldCategory,
  ProfileFieldStatus,
  ProfileRevisionStatus,
  SourceDocumentKind
} from "../enums";
import type {
  JsonObject,
  JsonValue,
  OnboardingAnswerRecord,
  ProfileFieldRecord,
  SourceDocumentRecord,
  UserProfileRevisionRecord,
  UserRecord
} from "../schema";
import { evidenceQueries } from "./evidence";

export interface EnsureLocalUserInput {
  displayName?: string | null;
  email?: string | null;
  id?: string;
  preferences?: JsonObject;
}

export interface CreateUserProfileRevisionInput {
  intakeSummary?: string | null;
  status?: ProfileRevisionStatus;
  userId: string;
}

export interface AddSourceDocumentInput {
  extractedText?: string | null;
  fileName?: string | null;
  kind: SourceDocumentKind;
  label: string;
  metadata?: JsonObject;
  mimeType?: string | null;
  revisionId: string;
  sha256?: string | null;
  storageRef: string;
  userId: string;
}

export interface RecordOnboardingAnswerInput {
  answer: JsonValue;
  answerFormat?: OnboardingAnswerFormat;
  prompt: string;
  questionKey: string;
  revisionId: string;
  sourceDocumentIds?: string[];
  userId: string;
}

export interface UpsertProfileFieldInput {
  category?: ProfileFieldCategory;
  fieldKey: string;
  fieldLabel?: string;
  isRequired?: boolean;
  reason?: string | null;
  revisionId: string;
  sourceAnswerIds?: string[];
  sourceDocumentIds?: string[];
  status?: ProfileFieldStatus;
  userId: string;
  value: JsonValue;
}

export interface IngestOnboardingAnswersInput {
  answers?: Array<
    Omit<RecordOnboardingAnswerInput, "revisionId" | "sourceDocumentIds" | "userId"> & {
      sourceDocumentIds?: string[];
      sourceDocumentKinds?: SourceDocumentKind[];
    }
  >;
  intakeSummary?: string | null;
  profileFields?: Array<
    Omit<UpsertProfileFieldInput, "revisionId" | "sourceAnswerIds" | "sourceDocumentIds" | "userId"> & {
      sourceAnswerIds?: string[];
      sourceAnswerKeys?: string[];
      sourceDocumentIds?: string[];
      sourceDocumentKinds?: SourceDocumentKind[];
    }
  >;
  revisionId?: string;
  sourceDocuments?: Array<Omit<AddSourceDocumentInput, "revisionId" | "userId">>;
  user: EnsureLocalUserInput;
}

export interface RevisionReadiness {
  fieldsNeedingReview: string[];
  missingRequiredFieldKeys: string[];
  readyForCompletion: boolean;
  readyForVerification: boolean;
  requiredFieldCount: number;
  totalFieldCount: number;
  unattestedRequiredFieldKeys: string[];
}

export interface UserProfileRevisionBundle {
  answers: OnboardingAnswerRecord[];
  evidence: ReturnType<typeof evidenceQueries.listForRevision>;
  profileFields: ProfileFieldRecord[];
  revision: UserProfileRevisionRecord;
  sourceDocuments: SourceDocumentRecord[];
  user: UserRecord;
}

export interface IngestOnboardingAnswersResult extends UserProfileRevisionBundle {
  readiness: RevisionReadiness;
}

function ensureUser(userId: string): UserRecord {
  const user = dbClient.get("user", userId);

  if (!user) {
    throw new Error(`Missing user: ${userId}`);
  }

  return user;
}

function ensureRevision(revisionId: string): UserProfileRevisionRecord {
  const revision = dbClient.get("userProfileRevision", revisionId);

  if (!revision) {
    throw new Error(`Missing user profile revision: ${revisionId}`);
  }

  return revision;
}

function isMissingValue(value: JsonValue): boolean {
  if (value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
}

function dedupeStrings(values: string[] | undefined): string[] {
  return [...new Set(values ?? [])];
}

function getAnswerByQuestionKey(revisionId: string, questionKey: string): OnboardingAnswerRecord | null {
  return (
    dbClient.list("onboardingAnswer", (row) => {
      return row.revisionId === revisionId && row.questionKey === questionKey;
    })[0] ?? null
  );
}

function getProfileFieldByKey(revisionId: string, fieldKey: string): ProfileFieldRecord | null {
  return (
    dbClient.list("profileField", (row) => {
      return row.revisionId === revisionId && row.fieldKey === fieldKey;
    })[0] ?? null
  );
}

function getSourceDocumentByStorageRef(revisionId: string, storageRef: string): SourceDocumentRecord | null {
  return (
    dbClient.list("sourceDocument", (row) => {
      return row.revisionId === revisionId && row.storageRef === storageRef;
    })[0] ?? null
  );
}

function resolveSourceDocumentIds(revisionId: string, ids: string[] = [], kinds: SourceDocumentKind[] = []): string[] {
  const resolvedIds = [...ids];

  for (const kind of kinds) {
    const matches = dbClient.list("sourceDocument", (row) => {
      return row.revisionId === revisionId && row.kind === kind;
    });

    for (const match of matches) {
      resolvedIds.push(match.id);
    }
  }

  return dedupeStrings(resolvedIds);
}

function resolveSourceAnswerIds(revisionId: string, ids: string[] = [], keys: string[] = []): string[] {
  const resolvedIds = [...ids];

  for (const key of keys) {
    const answer = getAnswerByQuestionKey(revisionId, key);

    if (answer) {
      resolvedIds.push(answer.id);
    }
  }

  return dedupeStrings(resolvedIds);
}

function buildRevisionBundle(revisionId: string): UserProfileRevisionBundle {
  const revision = ensureRevision(revisionId);
  const user = ensureUser(revision.userId);

  return {
    answers: dbClient.list("onboardingAnswer", (row) => row.revisionId === revisionId),
    evidence: evidenceQueries.listForRevision(revisionId),
    profileFields: dbClient.list("profileField", (row) => row.revisionId === revisionId),
    revision,
    sourceDocuments: dbClient.list("sourceDocument", (row) => row.revisionId === revisionId),
    user
  };
}

function setRevisionStatus(revisionId: string, status: ProfileRevisionStatus): UserProfileRevisionRecord {
  return dbClient.update("userProfileRevision", revisionId, (row) => {
    const timestamp = dbClient.now();

    return {
      ...row,
      status,
      updatedAt: timestamp
    };
  });
}

function syncFieldEvidence(field: ProfileFieldRecord): ProfileFieldRecord {
  const evidenceIds: string[] = [];

  for (const sourceAnswerId of field.sourceAnswerIds) {
    const evidence = evidenceQueries.createForOnboardingAnswer({
      onboardingAnswerId: sourceAnswerId,
      subjectId: field.id,
      subjectType: "profile_field"
    });

    evidenceIds.push(evidence.id);
  }

  for (const sourceDocumentId of field.sourceDocumentIds) {
    const evidence = evidenceQueries.createForSourceDocument({
      sourceDocumentId,
      subjectId: field.id,
      subjectType: "profile_field"
    });

    if (evidence) {
      evidenceIds.push(evidence.id);
    }
  }

  if (evidenceIds.length === 0 && field.status === "attested") {
    const evidence = evidenceQueries.createUserAttested({
      quotedText: typeof field.value === "string" ? field.value : JSON.stringify(field.value),
      revisionId: field.revisionId,
      subjectId: field.id,
      subjectType: "profile_field",
      userId: field.userId
    });

    evidenceIds.push(evidence.id);
  }

  return dbClient.update("profileField", field.id, (row) => {
    return {
      ...row,
      evidenceIds: dedupeStrings([...row.evidenceIds, ...evidenceIds]),
      updatedAt: dbClient.now()
    };
  });
}

export const userQueries = {
  addSourceDocument(input: AddSourceDocumentInput): SourceDocumentRecord {
    ensureUser(input.userId);
    ensureRevision(input.revisionId);

    const existing = getSourceDocumentByStorageRef(input.revisionId, input.storageRef);
    const timestamp = dbClient.now();

    if (existing) {
      return dbClient.update("sourceDocument", existing.id, (row) => {
        return {
          ...row,
          extractedText: input.extractedText ?? row.extractedText,
          fileName: input.fileName ?? row.fileName,
          kind: input.kind,
          label: input.label,
          metadata: input.metadata ?? row.metadata,
          mimeType: input.mimeType ?? row.mimeType,
          sha256: input.sha256 ?? row.sha256,
          updatedAt: timestamp
        };
      });
    }

    return dbClient.insert("sourceDocument", {
      id: dbClient.createId("srcdoc"),
      userId: input.userId,
      revisionId: input.revisionId,
      kind: input.kind,
      label: input.label,
      fileName: input.fileName ?? null,
      storageRef: input.storageRef,
      mimeType: input.mimeType ?? null,
      sha256: input.sha256 ?? null,
      extractedText: input.extractedText ?? null,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp
    });
  },

  attestProfileField(fieldId: string): ProfileFieldRecord {
    const field = dbClient.get("profileField", fieldId);

    if (!field) {
      throw new Error(`Missing profile field: ${fieldId}`);
    }

    const updated = dbClient.update("profileField", fieldId, (row) => {
      const timestamp = dbClient.now();

      return {
        ...row,
        attestedAt: timestamp,
        reason: row.reason ?? null,
        status: "attested",
        updatedAt: timestamp
      };
    });

    return syncFieldEvidence(updated);
  },

  attestUserProfileRevision(revisionId: string): IngestOnboardingAnswersResult {
    const bundle = buildRevisionBundle(revisionId);
    const readiness = userQueries.getRevisionReadiness(revisionId);

    if (!readiness.readyForCompletion) {
      throw new Error(
        `Revision ${revisionId} is not ready for completion. Missing required fields: ${readiness.unattestedRequiredFieldKeys.join(", ")}`
      );
    }

    const timestamp = dbClient.now();

    for (const field of bundle.profileFields) {
      if (field.status !== "attested") {
        userQueries.attestProfileField(field.id);
      }
    }

    const activeRevisionId = bundle.user.activeRevisionId;

    if (activeRevisionId && activeRevisionId !== revisionId) {
      dbClient.update("userProfileRevision", activeRevisionId, (row) => {
        return {
          ...row,
          status: "superseded",
          supersededBy: revisionId,
          updatedAt: timestamp
        };
      });
    }

    dbClient.update("userProfileRevision", revisionId, (row) => {
      return {
        ...row,
        attestedAt: timestamp,
        status: "attested",
        updatedAt: timestamp
      };
    });

    dbClient.update("user", bundle.user.id, (row) => {
      return {
        ...row,
        activeRevisionId: revisionId,
        updatedAt: timestamp
      };
    });

    return {
      ...buildRevisionBundle(revisionId),
      readiness: userQueries.getRevisionReadiness(revisionId)
    };
  },

  createUserProfileRevision(input: CreateUserProfileRevisionInput): UserProfileRevisionRecord {
    ensureUser(input.userId);

    const timestamp = dbClient.now();

    return dbClient.insert("userProfileRevision", {
      id: dbClient.createId("profilerev"),
      userId: input.userId,
      status: input.status ?? "draft",
      attestedAt: null,
      supersededBy: null,
      intakeSummary: input.intakeSummary ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  },

  ensureLocalUser(input: EnsureLocalUserInput): UserRecord {
    const byId = input.id ? dbClient.get("user", input.id) : null;
    const byEmail =
      input.email == null
        ? null
        : dbClient.list("user", (row) => {
            return row.email?.toLowerCase() === input.email?.toLowerCase();
          })[0] ?? null;

    const existing = byId ?? byEmail;
    const timestamp = dbClient.now();

    if (existing) {
      return dbClient.update("user", existing.id, (row) => {
        return {
          ...row,
          displayName: input.displayName ?? row.displayName,
          email: input.email ?? row.email,
          preferences: input.preferences ?? row.preferences,
          updatedAt: timestamp
        };
      });
    }

    return dbClient.insert("user", {
      id: input.id ?? dbClient.createId("user"),
      email: input.email ?? null,
      displayName: input.displayName ?? null,
      activeRevisionId: null,
      preferences: input.preferences ?? {},
      createdAt: timestamp,
      updatedAt: timestamp
    });
  },

  getActiveRevision(userId: string): UserProfileRevisionRecord | null {
    const user = ensureUser(userId);
    return user.activeRevisionId ? dbClient.get("userProfileRevision", user.activeRevisionId) : null;
  },

  getRevisionBundle(revisionId: string): UserProfileRevisionBundle {
    return buildRevisionBundle(revisionId);
  },

  getRevisionReadiness(revisionId: string): RevisionReadiness {
    const profileFields = dbClient.list("profileField", (row) => row.revisionId === revisionId);
    const requiredFields = profileFields.filter((row) => row.isRequired);
    const missingRequiredFieldKeys = requiredFields
      .filter((row) => isMissingValue(row.value))
      .map((row) => row.fieldKey);
    const unattestedRequiredFieldKeys = requiredFields
      .filter((row) => row.status !== "attested")
      .map((row) => row.fieldKey);
    const fieldsNeedingReview = profileFields
      .filter((row) => row.status === "needs_review")
      .map((row) => row.fieldKey);

    const readyForVerification = profileFields.length > 0 && missingRequiredFieldKeys.length === 0;
    const readyForCompletion =
      readyForVerification && unattestedRequiredFieldKeys.length === 0 && fieldsNeedingReview.length === 0;

    return {
      fieldsNeedingReview,
      missingRequiredFieldKeys,
      readyForCompletion,
      readyForVerification,
      requiredFieldCount: requiredFields.length,
      totalFieldCount: profileFields.length,
      unattestedRequiredFieldKeys
    };
  },

  ingestOnboardingAnswers(input: IngestOnboardingAnswersInput): IngestOnboardingAnswersResult {
    const user = userQueries.ensureLocalUser(input.user);
    const revision =
      input.revisionId == null
        ? userQueries.createUserProfileRevision({
            intakeSummary: input.intakeSummary ?? null,
            userId: user.id
          })
        : ensureRevision(input.revisionId);

    const sourceDocuments = (input.sourceDocuments ?? []).map((sourceDocument) => {
      return userQueries.addSourceDocument({
        ...sourceDocument,
        revisionId: revision.id,
        userId: user.id
      });
    });

    const answers = (input.answers ?? []).map((answerInput) => {
      return userQueries.recordOnboardingAnswer({
        ...answerInput,
        revisionId: revision.id,
        sourceDocumentIds: resolveSourceDocumentIds(
          revision.id,
          answerInput.sourceDocumentIds,
          answerInput.sourceDocumentKinds
        ),
        userId: user.id
      });
    });

    const profileFields = (input.profileFields ?? []).map((profileFieldInput) => {
      const fieldInput: UpsertProfileFieldInput = {
        fieldKey: profileFieldInput.fieldKey,
        revisionId: revision.id,
        sourceAnswerIds: resolveSourceAnswerIds(
          revision.id,
          profileFieldInput.sourceAnswerIds,
          profileFieldInput.sourceAnswerKeys
        ),
        sourceDocumentIds: resolveSourceDocumentIds(
          revision.id,
          profileFieldInput.sourceDocumentIds,
          profileFieldInput.sourceDocumentKinds
        ),
        userId: user.id,
        value: profileFieldInput.value
      };

      if (profileFieldInput.category) {
        fieldInput.category = profileFieldInput.category;
      }

      if (profileFieldInput.fieldLabel) {
        fieldInput.fieldLabel = profileFieldInput.fieldLabel;
      }

      if (profileFieldInput.isRequired !== undefined) {
        fieldInput.isRequired = profileFieldInput.isRequired;
      }

      if (profileFieldInput.reason !== undefined) {
        fieldInput.reason = profileFieldInput.reason;
      }

      if (profileFieldInput.status) {
        fieldInput.status = profileFieldInput.status;
      }

      const field = userQueries.upsertProfileField(fieldInput);

      return syncFieldEvidence(field);
    });

    if (
      revision.status === "draft" &&
      (sourceDocuments.length > 0 || answers.length > 0 || profileFields.length > 0)
    ) {
      setRevisionStatus(revision.id, "pending_verification");
    }

    return {
      ...buildRevisionBundle(revision.id),
      readiness: userQueries.getRevisionReadiness(revision.id)
    };
  },

  listUserProfileRevisions(userId: string): UserProfileRevisionRecord[] {
    ensureUser(userId);

    return dbClient.list("userProfileRevision", (row) => row.userId === userId);
  },

  markProfileFieldNeedsReview(fieldId: string, reason: string): ProfileFieldRecord {
    const field = dbClient.get("profileField", fieldId);

    if (!field) {
      throw new Error(`Missing profile field: ${fieldId}`);
    }

    return dbClient.update("profileField", fieldId, (row) => {
      return {
        ...row,
        reason,
        status: "needs_review",
        updatedAt: dbClient.now()
      };
    });
  },

  recordOnboardingAnswer(input: RecordOnboardingAnswerInput): OnboardingAnswerRecord {
    ensureUser(input.userId);
    ensureRevision(input.revisionId);

    const existing = getAnswerByQuestionKey(input.revisionId, input.questionKey);
    const timestamp = dbClient.now();

    if (existing) {
      return dbClient.update("onboardingAnswer", existing.id, (row) => {
        return {
          ...row,
          answer: input.answer,
          answerFormat: input.answerFormat ?? row.answerFormat,
          prompt: input.prompt,
          sourceDocumentIds: dedupeStrings(input.sourceDocumentIds),
          updatedAt: timestamp
        };
      });
    }

    return dbClient.insert("onboardingAnswer", {
      id: dbClient.createId("answer"),
      userId: input.userId,
      revisionId: input.revisionId,
      questionKey: input.questionKey,
      prompt: input.prompt,
      answer: input.answer,
      answerFormat: input.answerFormat ?? "long_text",
      sourceDocumentIds: dedupeStrings(input.sourceDocumentIds),
      createdAt: timestamp,
      updatedAt: timestamp
    });
  },

  upsertProfileField(input: UpsertProfileFieldInput): ProfileFieldRecord {
    ensureUser(input.userId);
    ensureRevision(input.revisionId);

    const existing = getProfileFieldByKey(input.revisionId, input.fieldKey);
    const timestamp = dbClient.now();

    if (existing) {
      return dbClient.update("profileField", existing.id, (row) => {
        return {
          ...row,
          category: input.category ?? row.category,
          evidenceIds: row.evidenceIds,
          fieldLabel: input.fieldLabel ?? row.fieldLabel,
          isRequired: input.isRequired ?? row.isRequired,
          reason: input.reason ?? row.reason,
          sourceAnswerIds: dedupeStrings([...row.sourceAnswerIds, ...(input.sourceAnswerIds ?? [])]),
          sourceDocumentIds: dedupeStrings([...row.sourceDocumentIds, ...(input.sourceDocumentIds ?? [])]),
          status: input.status ?? row.status,
          updatedAt: timestamp,
          value: input.value
        };
      });
    }

    return dbClient.insert("profileField", {
      id: dbClient.createId("field"),
      userId: input.userId,
      revisionId: input.revisionId,
      fieldKey: input.fieldKey,
      fieldLabel: input.fieldLabel ?? input.fieldKey,
      category: input.category ?? "other",
      value: input.value,
      isRequired: input.isRequired ?? false,
      status: input.status ?? "draft",
      sourceDocumentIds: dedupeStrings(input.sourceDocumentIds),
      sourceAnswerIds: dedupeStrings(input.sourceAnswerIds),
      evidenceIds: [],
      reason: input.reason ?? null,
      attestedAt: input.status === "attested" ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }
} as const;
