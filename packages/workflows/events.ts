export const workflowEvents = {
  onboardingStarted: "onboarding.started",
  onboardingDocumentsRegistered: "onboarding.documents.registered",
  onboardingAnswersIngested: "onboarding.answers.ingested",
  onboardingProfileDraftSaved: "onboarding.profile.draft-saved",
  onboardingStoriesDrafted: "onboarding.stories.drafted",
  onboardingStoriesVerified: "onboarding.stories.verified",
  onboardingVoiceAnchorRecorded: "onboarding.voice-anchor.recorded",
  onboardingAttested: "onboarding.attested",
  onboardingComplete: "onboarding.complete",
  researchCycleStarted: "research.cycle.started",
  researchUniversitiesDiscovered: "research.universities.discovered",
  researchProgramsQualified: "research.programs.qualified",
  researchFundingAnalyzed: "research.funding.analyzed",
  researchContactsEnriched: "research.contacts.enriched",
  researchProfilesEnriched: "research.profiles.enriched",
  researchCycleComplete: "research.cycle.complete",
  writingCycleStarted: "writing.cycle.started",
  writingDraftGenerated: "writing.draft.generated",
  writingCriticRan: "writing.critic.ran",
  writingGroundingChecked: "writing.grounding.checked",
  writingStyleChecked: "writing.style.checked",
  writingArtifactReady: "writing.artifact.ready",
  writingArtifactPaused: "writing.artifact.paused",
  writingCycleComplete: "writing.cycle.complete",
  applicationPrepStarted: "application.prep.started",
  applicationPacketAssembled: "application.prep.packet.assembled",
  applicationChecklistEvaluated: "application.prep.checklist.evaluated",
  applicationApprovalEnqueued: "application.prep.approval.enqueued",
  applicationPrepComplete: "application.prep.complete",
  approvalDecided: "approval.decided",
  applicationStatusChanged: "application.status.changed",
  applicationResumed: "application.resumed",
} as const;

export const sourceDocumentKinds = [
  "resume",
  "transcript",
  "supplemental-material",
] as const;

export type SourceDocumentKind = (typeof sourceDocumentKinds)[number];

export interface OnboardingStartedPayload {
  userId: string;
  revisionId: string;
  startedAt: string;
  initiatedBy: "local_script" | "manual_review" | "test";
}

export interface OnboardingDocumentsRegisteredPayload {
  userId: string;
  revisionId: string;
  recordedAt: string;
  documentKinds: SourceDocumentKind[];
}

export interface OnboardingAnswersIngestedPayload {
  userId: string;
  revisionId: string;
  ingestedAt: string;
  answerCount: number;
}

export interface OnboardingProfileDraftSavedPayload {
  userId: string;
  revisionId: string;
  savedAt: string;
}

export interface OnboardingStoriesDraftedPayload {
  userId: string;
  revisionId: string;
  draftedAt: string;
  storyCount: number;
}

export interface OnboardingStoriesVerifiedPayload {
  userId: string;
  revisionId: string;
  verifiedAt: string;
  verifiedStoryCount: number;
}

export interface OnboardingVoiceAnchorRecordedPayload {
  userId: string;
  revisionId: string;
  recordedAt: string;
  voiceAnchorId: string;
}

export interface OnboardingAttestedPayload {
  userId: string;
  revisionId: string;
  attestedAt: string;
  attestedFieldCount: number;
}

export interface OnboardingCompletePayload {
  userId: string;
  revisionId: string;
  completedAt: string;
  verifiedStoryCount: number;
  voiceAnchorId: string;
}

export interface ResearchCycleStartedPayload {
  userId: string;
  revisionId: string;
  cycleId: string;
  startedAt: string;
  reason: "onboarding_complete" | "manual_refresh";
  filtersHash: string;
}

export interface ResearchUniversitiesDiscoveredPayload {
  cycleId: string;
  recordedAt: string;
  consideredCount: number;
  acceptedCount: number;
  rejectedCount: number;
  acceptedUniversityIds: string[];
}

export interface ResearchProgramsQualifiedPayload {
  cycleId: string;
  recordedAt: string;
  universityId: string;
  programCount: number;
  coreCount: number;
  adjacentCount: number;
  tangentialCount: number;
  rejectedCount: number;
}

export interface ResearchFundingAnalyzedPayload {
  cycleId: string;
  recordedAt: string;
  universityId: string;
  opportunityCount: number;
  unclearCount: number;
}

export interface ResearchContactsEnrichedPayload {
  cycleId: string;
  recordedAt: string;
  universityId: string;
  personCount: number;
  personRoleCount: number;
}

export interface ResearchProfilesEnrichedPayload {
  cycleId: string;
  recordedAt: string;
  universityId: string;
  profilesPersisted: number;
  profilesSkipped: number;
}

export interface ResearchCycleCompletePayload {
  cycleId: string;
  userId: string;
  revisionId: string;
  completedAt: string;
  universityCount: number;
  programCount: number;
  fundingCount: number;
  contactCount: number;
}

export type WritingDocumentTypeName =
  | "sop"
  | "short_answer"
  | "cover_letter"
  | "personal_statement"
  | "outreach_message"
  | "resume_tailoring";

export type WritingReadinessName =
  | "ready"
  | "needs_user_input"
  | "grounding_failed"
  | "style_failed"
  | "missing_inputs";

export interface WritingCycleStartedPayload {
  cycleId: string;
  userId: string;
  revisionId: string;
  startedAt: string;
  requestCount: number;
}

export interface WritingDraftGeneratedPayload {
  cycleId: string;
  requestId: string;
  documentType: WritingDocumentTypeName;
  targetProgramId: string;
  targetUniversityId: string;
  generatedAt: string;
  wordCount: number;
  claimCount: number;
  verifiableClaimCount: number;
}

export interface WritingCriticRanPayload {
  cycleId: string;
  requestId: string;
  ranAt: string;
  noteCount: number;
  blockerCount: number;
}

export interface WritingGroundingCheckedPayload {
  cycleId: string;
  requestId: string;
  checkedAt: string;
  supportedClaims: number;
  unsupportedClaims: number;
  passed: boolean;
}

export interface WritingStyleCheckedPayload {
  cycleId: string;
  requestId: string;
  checkedAt: string;
  voiceAnchorId: string;
  passed: boolean;
  sentenceLengthDelta: number;
  firstPersonRatio: number;
  bannedPhraseHits: number;
}

export interface WritingArtifactReadyPayload {
  cycleId: string;
  requestId: string;
  readyAt: string;
  documentType: WritingDocumentTypeName;
  readiness: WritingReadinessName;
}

export interface WritingArtifactPausedPayload {
  cycleId: string;
  requestId: string;
  pausedAt: string;
  readiness: WritingReadinessName;
  rejectionReasons: string[];
}

export interface WritingCycleCompletePayload {
  cycleId: string;
  userId: string;
  revisionId: string;
  completedAt: string;
  totalRequests: number;
  readyCount: number;
  needsUserInputCount: number;
  groundingFailedCount: number;
  styleFailedCount: number;
}

export type PacketReadinessName =
  | "ready_for_review"
  | "ready_with_warnings"
  | "needs_user_input"
  | "blocked";

export type ApprovalActionTypeName =
  | "approve_draft"
  | "edit_required"
  | "missing_input"
  | "ready_for_submission";

export interface ApplicationPrepStartedPayload {
  cycleId: string;
  userId: string;
  revisionId: string;
  startedAt: string;
  programCount: number;
  artifactCount: number;
}

export interface ApplicationPacketAssembledPayload {
  cycleId: string;
  packetId: string;
  programId: string;
  universityId: string;
  fundingId: string | null;
  documentCount: number;
  readiness: PacketReadinessName;
  assembledAt: string;
}

export interface ApplicationChecklistEvaluatedPayload {
  cycleId: string;
  packetId: string;
  programId: string;
  evaluatedAt: string;
  totalItems: number;
  readyItems: number;
  warningItems: number;
  missingItems: number;
  userInputItems: number;
  deferredItems: number;
  readiness: PacketReadinessName;
}

export interface ApplicationApprovalEnqueuedPayload {
  cycleId: string;
  packetId: string;
  programId: string;
  enqueuedAt: string;
  approvalCount: number;
  queueTotals: Record<ApprovalActionTypeName, number>;
}

export interface ApplicationPrepCompletePayload {
  cycleId: string;
  userId: string;
  revisionId: string;
  completedAt: string;
  totalPackets: number;
  readyForReview: number;
  readyWithWarnings: number;
  needsUserInput: number;
  blocked: number;
  totalApprovalItems: number;
  queueTotals: Record<ApprovalActionTypeName, number>;
}

export type ApprovalRequestStatusName =
  | "pending"
  | "approved"
  | "edited"
  | "rejected"
  | "skipped"
  | "expired";

export type ApprovalResolutionDecisionName =
  | "approve"
  | "reject"
  | "request_edit"
  | "skip";

export type ApplicationStatusName =
  | "queued"
  | "preparing"
  | "awaiting_user"
  | "ready_for_user_submission"
  | "user_submitted"
  | "cancelled";

export interface ApprovalDecidedPayload {
  approvalRequestId: string;
  applicationId: string;
  userId: string;
  actionType: ApprovalActionTypeName;
  decision: ApprovalResolutionDecisionName;
  newStatus: ApprovalRequestStatusName;
  decidedAt: string;
  artifactId: string | null;
  checklistItemIds: string[];
  decisionNote: string | null;
}

export interface ApplicationStatusChangedPayload {
  applicationId: string;
  userId: string;
  programId: string;
  fromStatus: ApplicationStatusName;
  toStatus: ApplicationStatusName;
  changedAt: string;
  pendingApprovals: number;
  blockers: string[];
}

export interface ApplicationResumedPayload {
  applicationId: string;
  userId: string;
  programId: string;
  resumedAt: string;
  pendingApprovals: number;
  resolvedApprovals: number;
  status: ApplicationStatusName;
}

export type WorkflowEventMap = {
  [workflowEvents.onboardingStarted]: OnboardingStartedPayload;
  [workflowEvents.onboardingDocumentsRegistered]: OnboardingDocumentsRegisteredPayload;
  [workflowEvents.onboardingAnswersIngested]: OnboardingAnswersIngestedPayload;
  [workflowEvents.onboardingProfileDraftSaved]: OnboardingProfileDraftSavedPayload;
  [workflowEvents.onboardingStoriesDrafted]: OnboardingStoriesDraftedPayload;
  [workflowEvents.onboardingStoriesVerified]: OnboardingStoriesVerifiedPayload;
  [workflowEvents.onboardingVoiceAnchorRecorded]: OnboardingVoiceAnchorRecordedPayload;
  [workflowEvents.onboardingAttested]: OnboardingAttestedPayload;
  [workflowEvents.onboardingComplete]: OnboardingCompletePayload;
  [workflowEvents.researchCycleStarted]: ResearchCycleStartedPayload;
  [workflowEvents.researchUniversitiesDiscovered]: ResearchUniversitiesDiscoveredPayload;
  [workflowEvents.researchProgramsQualified]: ResearchProgramsQualifiedPayload;
  [workflowEvents.researchFundingAnalyzed]: ResearchFundingAnalyzedPayload;
  [workflowEvents.researchContactsEnriched]: ResearchContactsEnrichedPayload;
  [workflowEvents.researchProfilesEnriched]: ResearchProfilesEnrichedPayload;
  [workflowEvents.researchCycleComplete]: ResearchCycleCompletePayload;
  [workflowEvents.writingCycleStarted]: WritingCycleStartedPayload;
  [workflowEvents.writingDraftGenerated]: WritingDraftGeneratedPayload;
  [workflowEvents.writingCriticRan]: WritingCriticRanPayload;
  [workflowEvents.writingGroundingChecked]: WritingGroundingCheckedPayload;
  [workflowEvents.writingStyleChecked]: WritingStyleCheckedPayload;
  [workflowEvents.writingArtifactReady]: WritingArtifactReadyPayload;
  [workflowEvents.writingArtifactPaused]: WritingArtifactPausedPayload;
  [workflowEvents.writingCycleComplete]: WritingCycleCompletePayload;
  [workflowEvents.applicationPrepStarted]: ApplicationPrepStartedPayload;
  [workflowEvents.applicationPacketAssembled]: ApplicationPacketAssembledPayload;
  [workflowEvents.applicationChecklistEvaluated]: ApplicationChecklistEvaluatedPayload;
  [workflowEvents.applicationApprovalEnqueued]: ApplicationApprovalEnqueuedPayload;
  [workflowEvents.applicationPrepComplete]: ApplicationPrepCompletePayload;
  [workflowEvents.approvalDecided]: ApprovalDecidedPayload;
  [workflowEvents.applicationStatusChanged]: ApplicationStatusChangedPayload;
  [workflowEvents.applicationResumed]: ApplicationResumedPayload;
};

export type WorkflowEventName = keyof WorkflowEventMap;

export type WorkflowEvent<Name extends WorkflowEventName = WorkflowEventName> =
  Name extends WorkflowEventName
    ? {
        name: Name;
        payload: WorkflowEventMap[Name];
      }
    : never;

export const onboardingWorkflowEventNames = [
  workflowEvents.onboardingStarted,
  workflowEvents.onboardingDocumentsRegistered,
  workflowEvents.onboardingAnswersIngested,
  workflowEvents.onboardingProfileDraftSaved,
  workflowEvents.onboardingStoriesDrafted,
  workflowEvents.onboardingStoriesVerified,
  workflowEvents.onboardingVoiceAnchorRecorded,
  workflowEvents.onboardingAttested,
  workflowEvents.onboardingComplete,
] as const;

export type OnboardingWorkflowEventName =
  (typeof onboardingWorkflowEventNames)[number];

export type OnboardingWorkflowEvent = WorkflowEvent<OnboardingWorkflowEventName>;

export const researchSweepEventNames = [
  workflowEvents.researchCycleStarted,
  workflowEvents.researchUniversitiesDiscovered,
  workflowEvents.researchProgramsQualified,
  workflowEvents.researchFundingAnalyzed,
  workflowEvents.researchContactsEnriched,
  workflowEvents.researchProfilesEnriched,
  workflowEvents.researchCycleComplete,
] as const;

export type ResearchSweepEventName = (typeof researchSweepEventNames)[number];

export type ResearchSweepEvent = WorkflowEvent<ResearchSweepEventName>;

export const writingCycleEventNames = [
  workflowEvents.writingCycleStarted,
  workflowEvents.writingDraftGenerated,
  workflowEvents.writingCriticRan,
  workflowEvents.writingGroundingChecked,
  workflowEvents.writingStyleChecked,
  workflowEvents.writingArtifactReady,
  workflowEvents.writingArtifactPaused,
  workflowEvents.writingCycleComplete,
] as const;

export type WritingCycleEventName = (typeof writingCycleEventNames)[number];

export type WritingCycleEvent = WorkflowEvent<WritingCycleEventName>;

export const applicationPrepEventNames = [
  workflowEvents.applicationPrepStarted,
  workflowEvents.applicationPacketAssembled,
  workflowEvents.applicationChecklistEvaluated,
  workflowEvents.applicationApprovalEnqueued,
  workflowEvents.applicationPrepComplete,
] as const;

export type ApplicationPrepEventName =
  (typeof applicationPrepEventNames)[number];

export type ApplicationPrepEvent = WorkflowEvent<ApplicationPrepEventName>;

export const approvalResolutionEventNames = [
  workflowEvents.approvalDecided,
  workflowEvents.applicationStatusChanged,
  workflowEvents.applicationResumed,
] as const;

export type ApprovalResolutionEventName =
  (typeof approvalResolutionEventNames)[number];

export type ApprovalResolutionEvent =
  WorkflowEvent<ApprovalResolutionEventName>;

export function createWorkflowEvent<Name extends WorkflowEventName>(
  name: Name,
  payload: WorkflowEventMap[Name],
): WorkflowEvent<Name> {
  return { name, payload } as WorkflowEvent<Name>;
}
