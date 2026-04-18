export const SOURCE_DOCUMENT_KINDS = [
  "resume",
  "transcript",
  "writing_sample",
  "test_report",
  "portfolio",
  "reference_material",
  "other"
] as const;

export type SourceDocumentKind = (typeof SOURCE_DOCUMENT_KINDS)[number];

export const ONBOARDING_ANSWER_FORMATS = [
  "short_text",
  "long_text",
  "list",
  "boolean",
  "number",
  "date",
  "json"
] as const;

export type OnboardingAnswerFormat = (typeof ONBOARDING_ANSWER_FORMATS)[number];

export const PROFILE_FIELD_CATEGORIES = [
  "identity",
  "contact",
  "citizenship",
  "academics",
  "experience",
  "projects",
  "preferences",
  "writing",
  "logistics",
  "other"
] as const;

export type ProfileFieldCategory = (typeof PROFILE_FIELD_CATEGORIES)[number];

export const PROFILE_FIELD_STATUSES = [
  "draft",
  "needs_review",
  "attested"
] as const;

export type ProfileFieldStatus = (typeof PROFILE_FIELD_STATUSES)[number];

export const PROFILE_REVISION_STATUSES = [
  "draft",
  "pending_verification",
  "attested",
  "superseded"
] as const;

export type ProfileRevisionStatus = (typeof PROFILE_REVISION_STATUSES)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "onboarding_answer",
  "resume",
  "transcript",
  "writing_sample",
  "test_report",
  "portfolio",
  "reference_material",
  "other_document",
  "user_attested"
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const STORY_SOURCE_TYPES = [
  "resume",
  "transcript",
  "onboarding_answer",
  "profile_field",
  "project",
  "experience",
  "writing_sample",
  "other"
] as const;

export type StorySourceType = (typeof STORY_SOURCE_TYPES)[number];

export const DB_ENUMS = {
  evidenceSourceType: EVIDENCE_SOURCE_TYPES,
  onboardingAnswerFormat: ONBOARDING_ANSWER_FORMATS,
  profileFieldCategory: PROFILE_FIELD_CATEGORIES,
  profileFieldStatus: PROFILE_FIELD_STATUSES,
  profileRevisionStatus: PROFILE_REVISION_STATUSES,
  sourceDocumentKind: SOURCE_DOCUMENT_KINDS,
  storySourceType: STORY_SOURCE_TYPES
} as const;
