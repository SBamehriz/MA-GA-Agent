import {
  createWorkflowEvent,
  workflowEvents,
  type OnboardingAttestedPayload,
  type OnboardingStartedPayload,
  type OnboardingWorkflowEvent,
  type WorkflowEvent,
} from "./events";

export const requiredSourceDocumentKinds = ["resume", "transcript"] as const;

export type RequiredSourceDocumentKind =
  (typeof requiredSourceDocumentKinds)[number];

export type OnboardingWorkflowStatus =
  | "idle"
  | "collecting_profile_material"
  | "profile_draft_saved"
  | "stories_verification_pending"
  | "stories_verified"
  | "voice_anchor_recorded"
  | "attestation_pending"
  | "attested"
  | "complete";

export interface OnboardingWorkflowState {
  userId: string;
  revisionId: string;
  status: OnboardingWorkflowStatus;
  startedAt: string;
  lastEventAt: string;
  lastEventName: OnboardingWorkflowEvent["name"];
  sourceDocuments: Record<RequiredSourceDocumentKind, boolean> & {
    supplementalMaterialCount: number;
  };
  onboardingAnswersIngested: boolean;
  profileDraftSaved: boolean;
  answerCount: number;
  storyDraftCount: number;
  verifiedStoryCount: number;
  voiceAnchorId: string | null;
  attestedAt: string | null;
  attestedFieldCount: number;
  completedAt: string | null;
}

export interface OnboardingWorkflowResult {
  state: OnboardingWorkflowState;
  emittedEvents: WorkflowEvent[];
}

export function createInitialOnboardingState(
  payload: OnboardingStartedPayload,
): OnboardingWorkflowState {
  return {
    userId: payload.userId,
    revisionId: payload.revisionId,
    status: "idle",
    startedAt: payload.startedAt,
    lastEventAt: payload.startedAt,
    lastEventName: workflowEvents.onboardingStarted,
    sourceDocuments: {
      resume: false,
      transcript: false,
      supplementalMaterialCount: 0,
    },
    onboardingAnswersIngested: false,
    profileDraftSaved: false,
    answerCount: 0,
    storyDraftCount: 0,
    verifiedStoryCount: 0,
    voiceAnchorId: null,
    attestedAt: null,
    attestedFieldCount: 0,
    completedAt: null,
  };
}

export function getOnboardingCompletionBlockers(
  state: OnboardingWorkflowState,
): string[] {
  const blockers: string[] = [];

  if (!state.sourceDocuments.resume) {
    blockers.push("resume source document is missing");
  }

  if (!state.sourceDocuments.transcript) {
    blockers.push("transcript source document is missing");
  }

  if (!state.onboardingAnswersIngested || state.answerCount < 1) {
    blockers.push("onboarding answers have not been ingested");
  }

  if (!state.profileDraftSaved) {
    blockers.push("profile draft has not been saved");
  }

  if (state.storyDraftCount < 1) {
    blockers.push("story drafts have not been generated");
  }

  if (state.verifiedStoryCount < 1) {
    blockers.push("at least one story must be verified by the user");
  }

  if (!state.voiceAnchorId) {
    blockers.push("voice anchor has not been recorded");
  }

  if (!state.attestedAt) {
    blockers.push("profile attestation has not been completed");
  }

  return blockers;
}

export function isReadyForAttestation(
  state: OnboardingWorkflowState,
): boolean {
  return (
    state.sourceDocuments.resume &&
    state.sourceDocuments.transcript &&
    state.onboardingAnswersIngested &&
    state.answerCount > 0 &&
    state.profileDraftSaved &&
    state.storyDraftCount > 0 &&
    state.verifiedStoryCount > 0 &&
    state.voiceAnchorId !== null
  );
}

export function canEmitOnboardingComplete(
  state: OnboardingWorkflowState,
): boolean {
  return getOnboardingCompletionBlockers(state).length === 0;
}

function deriveOnboardingStatus(
  state: Omit<OnboardingWorkflowState, "status">,
): OnboardingWorkflowStatus {
  if (state.completedAt) {
    return "complete";
  }

  if (state.attestedAt) {
    return "attested";
  }

  if (isReadyForAttestation({ ...state, status: "idle" })) {
    return "attestation_pending";
  }

  if (state.voiceAnchorId) {
    return "voice_anchor_recorded";
  }

  if (state.verifiedStoryCount > 0) {
    return "stories_verified";
  }

  if (state.storyDraftCount > 0) {
    return "stories_verification_pending";
  }

  if (state.profileDraftSaved) {
    return "profile_draft_saved";
  }

  if (
    state.sourceDocuments.resume ||
    state.sourceDocuments.transcript ||
    state.sourceDocuments.supplementalMaterialCount > 0 ||
    state.onboardingAnswersIngested
  ) {
    return "collecting_profile_material";
  }

  return "idle";
}

function updateState(
  state: OnboardingWorkflowState,
  patch: Partial<Omit<OnboardingWorkflowState, "userId" | "revisionId">>,
): OnboardingWorkflowState {
  const nextStateBase: Omit<OnboardingWorkflowState, "status"> = {
    ...state,
    ...patch,
  };

  return {
    ...nextStateBase,
    status: deriveOnboardingStatus(nextStateBase),
  };
}

function assertMatchingRevision(
  state: OnboardingWorkflowState,
  userId: string,
  revisionId: string,
): void {
  if (state.userId !== userId || state.revisionId !== revisionId) {
    throw new Error(
      "Onboarding event does not match the active local onboarding revision.",
    );
  }
}

function buildOnboardingCompleteEvent(
  state: OnboardingWorkflowState,
  payload: OnboardingAttestedPayload,
): WorkflowEvent<typeof workflowEvents.onboardingComplete> {
  if (!canEmitOnboardingComplete(state) || state.voiceAnchorId === null) {
    throw new Error(
      `Cannot emit ${workflowEvents.onboardingComplete} before verification and attestation are complete.`,
    );
  }

  return createWorkflowEvent(workflowEvents.onboardingComplete, {
    userId: state.userId,
    revisionId: state.revisionId,
    completedAt: payload.attestedAt,
    verifiedStoryCount: state.verifiedStoryCount,
    voiceAnchorId: state.voiceAnchorId,
  });
}

export function applyOnboardingEvent(
  state: OnboardingWorkflowState,
  event: OnboardingWorkflowEvent,
): OnboardingWorkflowState {
  switch (event.name) {
    case workflowEvents.onboardingStarted:
      return createInitialOnboardingState(event.payload);
    case workflowEvents.onboardingDocumentsRegistered: {
      assertMatchingRevision(
        state,
        event.payload.userId,
        event.payload.revisionId,
      );

      const nextSourceDocuments = { ...state.sourceDocuments };
      for (const kind of event.payload.documentKinds) {
        if (kind === "supplemental-material") {
          nextSourceDocuments.supplementalMaterialCount += 1;
          continue;
        }

        nextSourceDocuments[kind] = true;
      }

      return updateState(state, {
        lastEventAt: event.payload.recordedAt,
        lastEventName: event.name,
        sourceDocuments: nextSourceDocuments,
      });
    }
    case workflowEvents.onboardingAnswersIngested:
      assertMatchingRevision(state, event.payload.userId, event.payload.revisionId);
      return updateState(state, {
        lastEventAt: event.payload.ingestedAt,
        lastEventName: event.name,
        onboardingAnswersIngested: true,
        answerCount: event.payload.answerCount,
      });
    case workflowEvents.onboardingProfileDraftSaved:
      assertMatchingRevision(state, event.payload.userId, event.payload.revisionId);
      return updateState(state, {
        lastEventAt: event.payload.savedAt,
        lastEventName: event.name,
        profileDraftSaved: true,
      });
    case workflowEvents.onboardingStoriesDrafted:
      assertMatchingRevision(state, event.payload.userId, event.payload.revisionId);
      return updateState(state, {
        lastEventAt: event.payload.draftedAt,
        lastEventName: event.name,
        storyDraftCount: event.payload.storyCount,
      });
    case workflowEvents.onboardingStoriesVerified:
      assertMatchingRevision(state, event.payload.userId, event.payload.revisionId);
      return updateState(state, {
        lastEventAt: event.payload.verifiedAt,
        lastEventName: event.name,
        verifiedStoryCount: event.payload.verifiedStoryCount,
      });
    case workflowEvents.onboardingVoiceAnchorRecorded:
      assertMatchingRevision(state, event.payload.userId, event.payload.revisionId);
      return updateState(state, {
        lastEventAt: event.payload.recordedAt,
        lastEventName: event.name,
        voiceAnchorId: event.payload.voiceAnchorId,
      });
    case workflowEvents.onboardingAttested:
      assertMatchingRevision(state, event.payload.userId, event.payload.revisionId);
      if (!isReadyForAttestation(state)) {
        throw new Error(
          `Cannot attest onboarding before required materials, story verification, and voice anchor are complete: ${getOnboardingCompletionBlockers(
            state,
          )
            .filter((blocker) => blocker !== "profile attestation has not been completed")
            .join("; ")}`,
        );
      }

      return updateState(state, {
        lastEventAt: event.payload.attestedAt,
        lastEventName: event.name,
        attestedAt: event.payload.attestedAt,
        attestedFieldCount: event.payload.attestedFieldCount,
      });
    case workflowEvents.onboardingComplete:
      assertMatchingRevision(state, event.payload.userId, event.payload.revisionId);
      if (!canEmitOnboardingComplete(state)) {
        throw new Error(
          `Cannot complete onboarding while blockers remain: ${getOnboardingCompletionBlockers(
            state,
          ).join("; ")}`,
        );
      }

      return updateState(state, {
        lastEventAt: event.payload.completedAt,
        lastEventName: event.name,
        completedAt: event.payload.completedAt,
      });
  }
}

export async function onboardingWorkflow(
  currentState: OnboardingWorkflowState | null,
  event: OnboardingWorkflowEvent,
): Promise<OnboardingWorkflowResult> {
  const baseState =
    currentState ??
    (event.name === workflowEvents.onboardingStarted
      ? createInitialOnboardingState(event.payload)
      : (() => {
          throw new Error(
            "The local onboarding workflow must start with onboarding.started.",
          );
        })());

  const nextState = applyOnboardingEvent(baseState, event);
  if (
    event.name === workflowEvents.onboardingComplete ||
    nextState.completedAt !== null
  ) {
    return {
      state: nextState,
      emittedEvents: [],
    };
  }

  if (event.name === workflowEvents.onboardingAttested) {
    const completionEvent = buildOnboardingCompleteEvent(nextState, event.payload);
    const completedState = applyOnboardingEvent(nextState, completionEvent);

    return {
      state: completedState,
      emittedEvents: [completionEvent],
    };
  }

  return {
    state: nextState,
    emittedEvents: [],
  };
}
