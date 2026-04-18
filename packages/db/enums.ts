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
  "user_attested",
  "admissions_page",
  "department_page",
  "lab_page",
  "directory",
  "scholar",
  "linkedin_profile",
  "aggregator",
  "news",
  "pdf"
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const RELEVANCE_CLASSES = [
  "core",
  "adjacent",
  "tangential",
  "rejected"
] as const;

export type RelevanceClass = (typeof RELEVANCE_CLASSES)[number];

export const DEGREE_TYPES = [
  "MS",
  "MEng",
  "MSE",
  "MASc",
  "MPS",
  "MSCS",
  "other"
] as const;

export type DegreeType = (typeof DEGREE_TYPES)[number];

export const PROGRAM_MODALITIES = ["in_person", "online", "hybrid"] as const;

export type ProgramModality = (typeof PROGRAM_MODALITIES)[number];

export const THESIS_OPTIONS = [
  "required",
  "optional",
  "none",
  "unknown"
] as const;

export type ThesisOption = (typeof THESIS_OPTIONS)[number];

export const FUNDING_HOST_TYPES = [
  "grad_school",
  "department",
  "lab",
  "external_unit"
] as const;

export type FundingHostType = (typeof FUNDING_HOST_TYPES)[number];

export const FUNDING_CLASSES = [
  "full_tuition_plus_stipend",
  "full_tuition_only",
  "partial_tuition",
  "stipend_only",
  "fee_reduction_only",
  "case_by_case",
  "unclear"
] as const;

export type FundingClass = (typeof FUNDING_CLASSES)[number];

export const STIPEND_PERIODS = [
  "academic_year",
  "calendar_year",
  "per_semester",
  "monthly",
  "unknown"
] as const;

export type StipendPeriod = (typeof STIPEND_PERIODS)[number];

export const TUITION_COVERAGE_VALUES = [
  "full",
  "partial",
  "none",
  "unknown"
] as const;

export type TuitionCoverage = (typeof TUITION_COVERAGE_VALUES)[number];

export const ROLE_TAGS = [
  "professor",
  "pi",
  "dgs",
  "coordinator",
  "hr",
  "lab_manager",
  "staff",
  "other"
] as const;

export type RoleTag = (typeof ROLE_TAGS)[number];

export const PROFESSIONAL_PROFILE_TYPES = [
  "linkedin",
  "scholar",
  "personal",
  "github",
  "orcid",
  "lab_page",
  "faculty_page"
] as const;

export type ProfessionalProfileType =
  (typeof PROFESSIONAL_PROFILE_TYPES)[number];

export const PROFESSIONAL_PROFILE_PROVIDERS = [
  "user_attested",
  "approved_provider_stub",
  "directory"
] as const;

export type ProfessionalProfileProvider =
  (typeof PROFESSIONAL_PROFILE_PROVIDERS)[number];

export const RESEARCH_CYCLE_STATUSES = [
  "pending",
  "running",
  "complete",
  "halted"
] as const;

export type ResearchCycleStatus = (typeof RESEARCH_CYCLE_STATUSES)[number];

export const APPLICATION_STATUSES = [
  "queued",
  "preparing",
  "awaiting_user",
  "ready_for_user_submission",
  "user_submitted",
  "cancelled"
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_ARTIFACT_KINDS = [
  "sop",
  "personal_statement",
  "short_answer",
  "cover_letter",
  "resume_tailoring",
  "outreach_message",
  "cv",
  "other_document"
] as const;

export type ApplicationArtifactKind =
  (typeof APPLICATION_ARTIFACT_KINDS)[number];

export const APPLICATION_ARTIFACT_STATUSES = [
  "draft",
  "needs_user_input",
  "grounding_failed",
  "style_failed",
  "ready",
  "approved",
  "superseded"
] as const;

export type ApplicationArtifactStatus =
  (typeof APPLICATION_ARTIFACT_STATUSES)[number];

export const APPROVAL_REQUEST_ACTION_TYPES = [
  "approve_draft",
  "edit_required",
  "missing_input",
  "ready_for_submission"
] as const;

export type ApprovalRequestActionType =
  (typeof APPROVAL_REQUEST_ACTION_TYPES)[number];

export const APPROVAL_REQUEST_STATUSES = [
  "pending",
  "approved",
  "edited",
  "rejected",
  "skipped",
  "expired"
] as const;

export type ApprovalRequestStatus =
  (typeof APPROVAL_REQUEST_STATUSES)[number];

export const APPROVAL_REQUEST_DEFAULT_ACTIONS = [
  "approve",
  "edit",
  "skip"
] as const;

export type ApprovalRequestDefaultAction =
  (typeof APPROVAL_REQUEST_DEFAULT_ACTIONS)[number];

export const APPROVAL_RESOLUTION_DECISIONS = [
  "approve",
  "reject",
  "request_edit",
  "skip"
] as const;

export type ApprovalResolutionDecision =
  (typeof APPROVAL_RESOLUTION_DECISIONS)[number];

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
  applicationArtifactKind: APPLICATION_ARTIFACT_KINDS,
  applicationArtifactStatus: APPLICATION_ARTIFACT_STATUSES,
  applicationStatus: APPLICATION_STATUSES,
  approvalRequestActionType: APPROVAL_REQUEST_ACTION_TYPES,
  approvalRequestDefaultAction: APPROVAL_REQUEST_DEFAULT_ACTIONS,
  approvalRequestStatus: APPROVAL_REQUEST_STATUSES,
  approvalResolutionDecision: APPROVAL_RESOLUTION_DECISIONS,
  degreeType: DEGREE_TYPES,
  evidenceSourceType: EVIDENCE_SOURCE_TYPES,
  fundingClass: FUNDING_CLASSES,
  fundingHostType: FUNDING_HOST_TYPES,
  onboardingAnswerFormat: ONBOARDING_ANSWER_FORMATS,
  professionalProfileProvider: PROFESSIONAL_PROFILE_PROVIDERS,
  professionalProfileType: PROFESSIONAL_PROFILE_TYPES,
  profileFieldCategory: PROFILE_FIELD_CATEGORIES,
  profileFieldStatus: PROFILE_FIELD_STATUSES,
  profileRevisionStatus: PROFILE_REVISION_STATUSES,
  programModality: PROGRAM_MODALITIES,
  relevanceClass: RELEVANCE_CLASSES,
  researchCycleStatus: RESEARCH_CYCLE_STATUSES,
  roleTag: ROLE_TAGS,
  sourceDocumentKind: SOURCE_DOCUMENT_KINDS,
  stipendPeriod: STIPEND_PERIODS,
  storySourceType: STORY_SOURCE_TYPES,
  thesisOption: THESIS_OPTIONS,
  tuitionCoverage: TUITION_COVERAGE_VALUES
} as const;
