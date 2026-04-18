import type {
  EvidenceSourceType,
  OnboardingAnswerFormat,
  ProfileFieldCategory,
  ProfileFieldStatus,
  ProfileRevisionStatus,
  SourceDocumentKind,
  StorySourceType
} from "./enums";

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonObject | JsonPrimitive | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface TimestampedRecord {
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord extends TimestampedRecord {
  id: string;
  email: string | null;
  displayName: string | null;
  activeRevisionId: string | null;
  preferences: JsonObject;
}

export interface UserProfileRevisionRecord extends TimestampedRecord {
  id: string;
  userId: string;
  status: ProfileRevisionStatus;
  attestedAt: string | null;
  supersededBy: string | null;
  intakeSummary: string | null;
}

export interface SourceDocumentRecord extends TimestampedRecord {
  id: string;
  userId: string;
  revisionId: string;
  kind: SourceDocumentKind;
  label: string;
  fileName: string | null;
  storageRef: string;
  mimeType: string | null;
  sha256: string | null;
  extractedText: string | null;
  metadata: JsonObject;
}

export interface OnboardingAnswerRecord extends TimestampedRecord {
  id: string;
  userId: string;
  revisionId: string;
  questionKey: string;
  prompt: string;
  answer: JsonValue;
  answerFormat: OnboardingAnswerFormat;
  sourceDocumentIds: string[];
}

export interface ProfileFieldRecord extends TimestampedRecord {
  id: string;
  userId: string;
  revisionId: string;
  fieldKey: string;
  fieldLabel: string;
  category: ProfileFieldCategory;
  value: JsonValue;
  isRequired: boolean;
  status: ProfileFieldStatus;
  sourceDocumentIds: string[];
  sourceAnswerIds: string[];
  evidenceIds: string[];
  reason: string | null;
  attestedAt: string | null;
}

export interface EvidenceRecord {
  id: string;
  userId: string | null;
  revisionId: string | null;
  subjectType: string;
  subjectId: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  sourceRef: string | null;
  sourceDocumentId: string | null;
  sourceAnswerId: string | null;
  quotedText: string;
  createdAt: string;
  metadata: JsonObject;
}

export interface StoryRecord extends TimestampedRecord {
  id: string;
  userId: string;
  revisionId: string;
  title: string;
  summary: string;
  proofPoints: string[];
  themes: string[];
  sourceRefs: string[];
  sourceTypes: StorySourceType[];
  verifiedByUser: boolean;
  verifiedAt: string | null;
}

export interface VoiceAnchorRecord extends TimestampedRecord {
  id: string;
  userId: string;
  revisionId: string;
  sourceDocumentId: string | null;
  sampleText: string;
  sourceLabel: string;
  verifiedAt: string | null;
}

export interface TableDefinition<TRecord> {
  primaryKey: keyof TRecord & string;
  tableName: string;
}

export interface TableRecordMap {
  evidence: EvidenceRecord;
  onboardingAnswer: OnboardingAnswerRecord;
  profileField: ProfileFieldRecord;
  sourceDocument: SourceDocumentRecord;
  story: StoryRecord;
  user: UserRecord;
  userProfileRevision: UserProfileRevisionRecord;
  voiceAnchor: VoiceAnchorRecord;
}

export type TableName = keyof TableRecordMap;

export type LocalDbState = {
  [K in TableName]: Map<string, TableRecordMap[K]>;
};

export const schema: {
  [K in TableName]: TableDefinition<TableRecordMap[K]>;
} = {
  evidence: {
    primaryKey: "id",
    tableName: "evidence"
  },
  onboardingAnswer: {
    primaryKey: "id",
    tableName: "onboarding_answer"
  },
  profileField: {
    primaryKey: "id",
    tableName: "profile_field"
  },
  sourceDocument: {
    primaryKey: "id",
    tableName: "source_document"
  },
  story: {
    primaryKey: "id",
    tableName: "story"
  },
  user: {
    primaryKey: "id",
    tableName: "user"
  },
  userProfileRevision: {
    primaryKey: "id",
    tableName: "user_profile_revision"
  },
  voiceAnchor: {
    primaryKey: "id",
    tableName: "voice_anchor"
  }
} as const;
