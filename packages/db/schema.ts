import type {
  ApplicationArtifactKind,
  ApplicationArtifactStatus,
  ApplicationStatus,
  ApprovalRequestActionType,
  ApprovalRequestDefaultAction,
  ApprovalRequestStatus,
  DegreeType,
  EvidenceSourceType,
  FundingClass,
  FundingHostType,
  OnboardingAnswerFormat,
  ProfessionalProfileProvider,
  ProfessionalProfileType,
  ProfileFieldCategory,
  ProfileFieldStatus,
  ProfileRevisionStatus,
  ProgramModality,
  RelevanceClass,
  ResearchCycleStatus,
  RoleTag,
  SourceDocumentKind,
  StipendPeriod,
  StorySourceType,
  ThesisOption,
  TuitionCoverage
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

export interface UniversityRecord extends TimestampedRecord {
  id: string;
  canonicalName: string;
  aliases: string[];
  country: string;
  state: string | null;
  tierTag: string | null;
  primaryDomain: string;
  ipedsId: string | null;
  lastVerifiedAt: string | null;
  evidenceIds: string[];
}

export interface DepartmentRecord extends TimestampedRecord {
  id: string;
  universityId: string;
  name: string;
  website: string | null;
  admissionsUrl: string | null;
  staffDirectoryUrl: string | null;
  lastVerifiedAt: string | null;
  evidenceIds: string[];
}

export interface GraduateProgramRecord extends TimestampedRecord {
  id: string;
  universityId: string;
  departmentId: string;
  title: string;
  aliases: string[];
  degreeType: DegreeType;
  modality: ProgramModality;
  concentration: string | null;
  curriculumUrl: string | null;
  admissionsUrl: string | null;
  thesisOption: ThesisOption;
  relevanceClass: RelevanceClass;
  keywordHits: string[];
  fitScore: number;
  active: boolean;
  lastVerifiedAt: string | null;
  evidenceIds: string[];
}

export interface FundingOpportunityRecord extends TimestampedRecord {
  id: string;
  universityId: string;
  departmentId: string | null;
  programId: string | null;
  hostType: FundingHostType;
  title: string;
  description: string;
  fundingClass: FundingClass;
  tuitionCoverage: TuitionCoverage;
  stipendAmount: number | null;
  stipendCurrency: string;
  stipendPeriod: StipendPeriod;
  ftePct: number | null;
  eligibility: JsonObject;
  intlEligible: boolean | null;
  applicationUrl: string | null;
  deadlineDate: string | null;
  primaryContactId: string | null;
  confidence: number;
  classificationNotes: string[];
  taxonomyMatches: string[];
  lastVerifiedAt: string | null;
  evidenceIds: string[];
}

export interface PersonRecord extends TimestampedRecord {
  id: string;
  canonicalName: string;
  nameAliases: string[];
  preferredEmail: string | null;
  emails: string[];
  primaryOrgId: string | null;
  mergedInto: string | null;
}

export interface PersonRoleRecord extends TimestampedRecord {
  id: string;
  personId: string;
  universityId: string;
  departmentId: string | null;
  programId: string | null;
  roleTag: RoleTag;
  roleTitle: string;
  researchAreas: string[];
  relevanceScore: number;
  startDate: string | null;
  endDate: string | null;
  evidenceIds: string[];
}

export interface ProfessionalProfileRecord extends TimestampedRecord {
  id: string;
  personId: string;
  type: ProfessionalProfileType;
  url: string;
  provider: ProfessionalProfileProvider;
  confidence: number;
  verificationSignals: string[];
  institutionMatch: boolean;
  titleMatch: boolean;
  researchAreaOverlap: number;
  lastVerifiedAt: string | null;
  evidenceIds: string[];
}

/**
 * Persistent `application` row (data-model.md §6.1, subset). The v1 submission
 * flow does not yet exist; these rows are populated by the application-prep
 * cycle and updated by the approval resolver. `status = user_submitted` is
 * only reachable through an explicit manual user action in a later block —
 * never by any agent (CLAUDE.md §8 invariants 1–3).
 */
export interface ApplicationRecord extends TimestampedRecord {
  id: string;
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
  artifactIds: string[];
  approvalRequestIds: string[];
  submittedAt: string | null;
  cancelledAt: string | null;
}

/**
 * Persistent `application_artifact` row (data-model.md §6.3, subset).
 *
 * `writingRequestId` + `writingSectionsJson` + `groundingJson` + `styleJson`
 * capture the exact write-through snapshot of the WritingArtifact that
 * produced the draft. `contentText` is a denormalized rendered view so the
 * approval queue can surface a preview without re-running the writing
 * cycle.
 */
export interface ApplicationArtifactRecord extends TimestampedRecord {
  id: string;
  applicationId: string;
  userId: string;
  kind: ApplicationArtifactKind;
  status: ApplicationArtifactStatus;
  title: string;
  contentText: string;
  wordCount: number;
  draftVersion: number;
  writingRequestId: string | null;
  writingSectionsJson: JsonValue[];
  groundingJson: JsonObject;
  styleJson: JsonObject;
  criticJson: JsonObject;
  usageSummaryJson: JsonObject;
  rejectionReasons: string[];
  approvedByUserAt: string | null;
  supersededBy: string | null;
}

/**
 * Persistent `approval_request` row (data-model.md §6.4, subset).
 *
 * This slice only persists approval action types that do NOT have an
 * external side-effect (`approve_draft`, `edit_required`, `missing_input`,
 * `ready_for_submission`). Action types like `submit_application` /
 * `pay_fee` / `send_email` are part of the canonical enum but are never
 * emitted by an agent yet; they remain reserved for the browser-automation
 * and outreach-sending blocks. See implementation-notes.md §16.
 */
export interface ApprovalRequestRecord extends TimestampedRecord {
  id: string;
  userId: string;
  applicationId: string;
  artifactId: string | null;
  prepCycleId: string;
  actionType: ApprovalRequestActionType;
  status: ApprovalRequestStatus;
  defaultAction: ApprovalRequestDefaultAction;
  reason: string;
  actionRequired: string;
  groundingJson: JsonObject | null;
  evidenceJson: JsonObject | null;
  payloadJson: JsonObject;
  checklistItemIds: string[];
  decidedByUserAt: string | null;
  decisionNote: string | null;
  decisionActorHint: string | null;
  blockingSiblings: string[];
}

export interface ResearchCycleRecord extends TimestampedRecord {
  id: string;
  userId: string;
  revisionId: string;
  status: ResearchCycleStatus;
  reason: string;
  startedAt: string;
  completedAt: string | null;
  filtersHash: string;
  universityCount: number;
  programCount: number;
  fundingCount: number;
  contactCount: number;
  notes: string[];
}

export interface TableDefinition<TRecord> {
  primaryKey: keyof TRecord & string;
  tableName: string;
}

export interface TableRecordMap {
  application: ApplicationRecord;
  applicationArtifact: ApplicationArtifactRecord;
  approvalRequest: ApprovalRequestRecord;
  department: DepartmentRecord;
  evidence: EvidenceRecord;
  fundingOpportunity: FundingOpportunityRecord;
  graduateProgram: GraduateProgramRecord;
  onboardingAnswer: OnboardingAnswerRecord;
  person: PersonRecord;
  personRole: PersonRoleRecord;
  professionalProfile: ProfessionalProfileRecord;
  profileField: ProfileFieldRecord;
  researchCycle: ResearchCycleRecord;
  sourceDocument: SourceDocumentRecord;
  story: StoryRecord;
  university: UniversityRecord;
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
  application: {
    primaryKey: "id",
    tableName: "application"
  },
  applicationArtifact: {
    primaryKey: "id",
    tableName: "application_artifact"
  },
  approvalRequest: {
    primaryKey: "id",
    tableName: "approval_request"
  },
  department: {
    primaryKey: "id",
    tableName: "department"
  },
  evidence: {
    primaryKey: "id",
    tableName: "evidence"
  },
  fundingOpportunity: {
    primaryKey: "id",
    tableName: "funding_opportunity"
  },
  graduateProgram: {
    primaryKey: "id",
    tableName: "graduate_program"
  },
  onboardingAnswer: {
    primaryKey: "id",
    tableName: "onboarding_answer"
  },
  person: {
    primaryKey: "id",
    tableName: "person"
  },
  personRole: {
    primaryKey: "id",
    tableName: "person_role"
  },
  professionalProfile: {
    primaryKey: "id",
    tableName: "professional_profile"
  },
  profileField: {
    primaryKey: "id",
    tableName: "profile_field"
  },
  researchCycle: {
    primaryKey: "id",
    tableName: "research_cycle"
  },
  sourceDocument: {
    primaryKey: "id",
    tableName: "source_document"
  },
  story: {
    primaryKey: "id",
    tableName: "story"
  },
  university: {
    primaryKey: "id",
    tableName: "university"
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
