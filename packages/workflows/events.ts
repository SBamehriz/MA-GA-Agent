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
  startedAt: string;
  reason: "onboarding_complete" | "manual_refresh";
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

export function createWorkflowEvent<Name extends WorkflowEventName>(
  name: Name,
  payload: WorkflowEventMap[Name],
): WorkflowEvent<Name> {
  return { name, payload } as WorkflowEvent<Name>;
}
