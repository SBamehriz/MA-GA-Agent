import type {
  FundingOpportunityRecord,
  GraduateProgramRecord,
  PersonRecord,
  PersonRoleRecord,
  ProfessionalProfileRecord,
  ProfileFieldRecord,
  SourceDocumentRecord,
  UniversityRecord,
  VoiceAnchorRecord,
  StoryRecord
} from "../db/schema";
import type { VerifiedStoryRecord } from "../agents/types";

/**
 * Claim is the smallest grounded unit of a draft.
 *
 * Per agents.md §4.13 + CLAUDE.md §8 invariant 11: every factually verifiable
 * claim in generated writing must map to the verified story bank or a profile
 * field (or, extended here, to an evidence-backed external-world row). We
 * enforce this by making the draft a sequence of Claims whose `refs[]` point
 * at real records, and by running the grounding check against those refs.
 */
export type ClaimKind =
  | "stylistic"
  | "voice_stylistic"
  | "narrative"
  | "factual_profile"
  | "factual_program"
  | "factual_funding"
  | "factual_contact"
  | "factual_university";

export type ClaimRefType =
  | "profile_field"
  | "story"
  | "program"
  | "funding"
  | "person_role"
  | "professional_profile"
  | "person"
  | "university"
  | "voice_anchor"
  | "source_document";

export interface ClaimRef {
  type: ClaimRefType;
  id: string;
}

export interface Claim {
  id: string;
  kind: ClaimKind;
  text: string;
  refs: ClaimRef[];
  /** Free-form tag to help the critic reason about coverage (e.g. "opening", "fit", "ask"). */
  slotTag: string;
}

export interface Paragraph {
  id: string;
  heading: string | null;
  claims: Claim[];
}

export interface Section {
  id: string;
  title: string;
  paragraphs: Paragraph[];
}

/**
 * Supported document types for this slice. `personal_statement` and
 * `outreach_message` are scaffolded through the same pipeline but the
 * priority cut per the task spec is sop / short_answer / cover_letter.
 */
export type WritingDocumentType =
  | "sop"
  | "short_answer"
  | "cover_letter"
  | "personal_statement"
  | "outreach_message"
  | "resume_tailoring";

export interface WritingTargetContext {
  university: UniversityRecord;
  program: GraduateProgramRecord;
  funding: FundingOpportunityRecord | null;
  personRole: PersonRoleRecord | null;
  person: PersonRecord | null;
  professionalProfile: ProfessionalProfileRecord | null;
}

export interface WritingProfileContext {
  userId: string;
  revisionId: string;
  attestedFields: Map<string, ProfileFieldRecord>;
  attestedFieldsByKey: Map<string, ProfileFieldRecord>;
  verifiedStories: VerifiedStoryRecord[];
  allStories: StoryRecord[];
  voiceAnchor: VoiceAnchorRecord;
  sourceDocuments: SourceDocumentRecord[];
}

export interface WritingDocumentRequest {
  id: string;
  documentType: WritingDocumentType;
  universityId: string;
  programId: string;
  fundingId?: string | null;
  personRoleId?: string | null;
  professionalProfileId?: string | null;
  prompt?: string;
  wordLimit?: number | null;
  notes?: string[];
}

export interface DraftArtifact {
  requestId: string;
  documentType: WritingDocumentType;
  targetProgramId: string;
  targetUniversityId: string;
  targetFundingId: string | null;
  targetPersonRoleId: string | null;
  title: string;
  sections: Section[];
  text: string;
  claimCount: number;
  verifiableClaimCount: number;
  wordCount: number;
  generatedAt: string;
}

export type CriticSeverity = "info" | "warn" | "block";

export interface CriticNote {
  code: string;
  severity: CriticSeverity;
  message: string;
  slotTag?: string;
}

export interface CriticReport {
  notes: CriticNote[];
  hasBlockers: boolean;
}

export interface UnsupportedClaim {
  claimId: string;
  slotTag: string;
  kind: ClaimKind;
  text: string;
  reason: string;
}

export interface ClaimGroundingEntry {
  claimId: string;
  slotTag: string;
  kind: ClaimKind;
  refs: ClaimRef[];
  resolvedRefs: Array<{
    type: ClaimRefType;
    id: string;
    resolved: true;
    note: string;
  }>;
  supported: boolean;
}

export interface GroundingReport {
  supportedClaims: number;
  unsupportedClaims: UnsupportedClaim[];
  verifiableClaims: number;
  stylisticClaims: number;
  refsByType: Partial<Record<ClaimRefType, number>>;
  entries: ClaimGroundingEntry[];
  passed: boolean;
}

export interface StyleReport {
  voiceAnchorId: string;
  meanSentenceLength: number;
  voiceAnchorMeanSentenceLength: number;
  sentenceLengthDelta: number;
  firstPersonRatio: number;
  bannedPhraseHits: Array<{ phrase: string; count: number }>;
  passed: boolean;
  notes: string[];
}

export type WritingReadiness =
  | "ready"
  | "needs_user_input"
  | "grounding_failed"
  | "style_failed"
  | "missing_inputs";

export interface WritingArtifact {
  request: WritingDocumentRequest;
  draft: DraftArtifact;
  critic: CriticReport;
  grounding: GroundingReport;
  style: StyleReport;
  readiness: WritingReadiness;
  rejectionReasons: string[];
  usageSummary: {
    profileFieldKeys: string[];
    verifiedStoryIds: string[];
    programIds: string[];
    fundingIds: string[];
    personRoleIds: string[];
    universityIds: string[];
    professionalProfileIds: string[];
    voiceAnchorId: string;
  };
}

export const WRITING_DOCUMENT_TYPES: readonly WritingDocumentType[] = [
  "sop",
  "short_answer",
  "cover_letter",
  "personal_statement",
  "outreach_message",
  "resume_tailoring"
] as const;
