import {
  buildStoryBank,
  verifyStory,
  type StoryBankBuilderInput,
  type StoryRecord as AgentStoryRecord,
} from "../agents/story-bank-builder";
import { run as runUserProfileIngestion } from "../agents/user-profile-ingestion";
import type { UserProfileIngestionInput } from "../agents/user-profile-ingestion";
import { dbClient } from "../db/client";
import type { ProfileFieldRecord, StoryRecord as DbStoryRecord, VoiceAnchorRecord as DbVoiceAnchorRecord } from "../db/schema";
import { userQueries } from "../db/queries/user";
import { createWritingGroundingContext, type WritingGroundingContext } from "../writing";
import {
  createWorkflowEvent,
  sourceDocumentKinds,
  workflowEvents,
  type OnboardingWorkflowEvent,
  type WorkflowEvent,
} from "./events";
import {
  createInitialOnboardingState,
  onboardingWorkflow,
  type OnboardingWorkflowResult,
  type OnboardingWorkflowState,
} from "./onboarding";

export interface LocalOnboardingMemoryInput {
  attestation?: {
    fieldKeys?: string[];
    performedAt?: string;
  };
  initiatedBy?: "local_script" | "manual_review" | "test";
  ingestion: UserProfileIngestionInput;
  storyMemory: Omit<StoryBankBuilderInput, "existing_stories" | "revision_id" | "user_id">;
  verifiedStoryIds?: string[];
}

export interface LocalOnboardingMemoryResult {
  emittedEvents: WorkflowEvent[];
  ingestion: Awaited<ReturnType<typeof runUserProfileIngestion>>;
  revisionId: string;
  stories: AgentStoryRecord[];
  userId: string;
  voiceAnchorId: string | null;
  workflowState: OnboardingWorkflowState;
  writingGrounding: WritingGroundingContext;
}

function nowIso(): string {
  return dbClient.now();
}

function createAndApplyEvent(
  currentState: OnboardingWorkflowState | null,
  event: OnboardingWorkflowEvent,
  emittedEvents: WorkflowEvent[],
): Promise<OnboardingWorkflowResult> {
  emittedEvents.push(event);
  return onboardingWorkflow(currentState, event);
}

function persistStoryRecord(story: AgentStoryRecord): DbStoryRecord {
  const timestamp = nowIso();
  const existing = dbClient.get("story", story.id);

  const nextRecord: DbStoryRecord = {
    id: story.id,
    userId: story.user_id,
    revisionId: story.revision_id,
    title: story.title,
    summary: story.summary,
    proofPoints: [...story.proof_points],
    themes: [...story.themes],
    sourceRefs: story.source_refs.map((sourceRef) => sourceRef.ref_id),
    sourceTypes: story.source_refs.map((sourceRef) => sourceRef.ref_type),
    verifiedByUser: story.verified_by_user,
    verifiedAt: story.verified_by_user ? story.verified_at : null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  if (existing) {
    return dbClient.update("story", story.id, () => nextRecord);
  }

  return dbClient.insert("story", nextRecord);
}

function persistVoiceAnchor(
  userId: string,
  revisionId: string,
  voiceAnchor: NonNullable<ReturnType<typeof buildStoryBank>["voice_anchor"]>,
): DbVoiceAnchorRecord {
  const timestamp = nowIso();
  const existing = dbClient.get("voiceAnchor", voiceAnchor.id);
  const sourceDocumentRef =
    voiceAnchor.source_refs.find((sourceRef) => sourceRef.ref_type === "writing_sample")
      ?.ref_id ?? null;

  const nextRecord: DbVoiceAnchorRecord = {
    id: voiceAnchor.id,
    userId,
    revisionId,
    sourceDocumentId: sourceDocumentRef,
    sampleText: voiceAnchor.sample_text,
    sourceLabel: voiceAnchor.source_refs.map((sourceRef) => sourceRef.label).join(", "),
    verifiedAt: voiceAnchor.status === "ready" ? timestamp : null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  if (existing) {
    return dbClient.update("voiceAnchor", voiceAnchor.id, () => nextRecord);
  }

  return dbClient.insert("voiceAnchor", nextRecord);
}

function attestSelectedFields(
  profileFields: readonly ProfileFieldRecord[],
  fieldKeys?: readonly string[],
): number {
  const targetFields = profileFields.filter((field) => {
    if (!field.isRequired) {
      return false;
    }

    if (!fieldKeys || fieldKeys.length === 0) {
      return true;
    }

    return fieldKeys.includes(field.fieldKey);
  });

  for (const field of targetFields) {
    userQueries.attestProfileField(field.id);
  }

  return targetFields.length;
}

function toRegisteredDocumentKinds(
  input: UserProfileIngestionInput,
): Array<(typeof sourceDocumentKinds)[number]> {
  const documentKinds = new Set<(typeof sourceDocumentKinds)[number]>();

  for (const document of input.sourceDocuments ?? []) {
    if (document.kind === "resume" || document.kind === "transcript") {
      documentKinds.add(document.kind);
      continue;
    }

    documentKinds.add("supplemental-material");
  }

  return [...documentKinds];
}

export async function runLocalOnboardingMemoryFlow(
  input: LocalOnboardingMemoryInput,
): Promise<LocalOnboardingMemoryResult> {
  const performedAt = input.attestation?.performedAt ?? nowIso();
  const ingestion = await runUserProfileIngestion(input.ingestion);
  const revisionBundle = userQueries.getRevisionBundle(ingestion.revisionId);
  const emittedEvents: WorkflowEvent[] = [];

  let workflowState = createInitialOnboardingState({
    userId: ingestion.userId,
    revisionId: ingestion.revisionId,
    startedAt: performedAt,
    initiatedBy: input.initiatedBy ?? "local_script",
  });
  emittedEvents.push(
    createWorkflowEvent(workflowEvents.onboardingStarted, {
      userId: ingestion.userId,
      revisionId: ingestion.revisionId,
      startedAt: performedAt,
      initiatedBy: input.initiatedBy ?? "local_script",
    }),
  );

  const documentKinds = toRegisteredDocumentKinds(input.ingestion);
  if (documentKinds.length > 0) {
    const result = await createAndApplyEvent(
      workflowState,
      createWorkflowEvent(workflowEvents.onboardingDocumentsRegistered, {
        userId: ingestion.userId,
        revisionId: ingestion.revisionId,
        recordedAt: nowIso(),
        documentKinds,
      }),
      emittedEvents,
    );
    workflowState = result.state;
  }

  if ((input.ingestion.answers?.length ?? 0) > 0) {
    const result = await createAndApplyEvent(
      workflowState,
      createWorkflowEvent(workflowEvents.onboardingAnswersIngested, {
        userId: ingestion.userId,
        revisionId: ingestion.revisionId,
        ingestedAt: nowIso(),
        answerCount: input.ingestion.answers?.length ?? 0,
      }),
      emittedEvents,
    );
    workflowState = result.state;
  }

  const draftSavedResult = await createAndApplyEvent(
    workflowState,
    createWorkflowEvent(workflowEvents.onboardingProfileDraftSaved, {
      userId: ingestion.userId,
      revisionId: ingestion.revisionId,
      savedAt: nowIso(),
    }),
    emittedEvents,
  );
  workflowState = draftSavedResult.state;

  const storyBank = buildStoryBank({
    ...input.storyMemory,
    revision_id: ingestion.revisionId,
    user_id: ingestion.userId,
  });

  let stories = storyBank.stories;
  for (const story of stories) {
    persistStoryRecord(story);
  }

  const storiesDraftedResult = await createAndApplyEvent(
    workflowState,
    createWorkflowEvent(workflowEvents.onboardingStoriesDrafted, {
      userId: ingestion.userId,
      revisionId: ingestion.revisionId,
      draftedAt: nowIso(),
      storyCount: stories.length,
    }),
    emittedEvents,
  );
  workflowState = storiesDraftedResult.state;

  if (input.verifiedStoryIds && input.verifiedStoryIds.length > 0) {
    stories = stories.map((story) => {
      if (!input.verifiedStoryIds?.includes(story.id)) {
        return story;
      }

      const verified = verifyStory(story, nowIso());
      persistStoryRecord(verified);
      return verified;
    });

    const verifiedStoryCount = stories.filter((story) => story.verified_by_user).length;
    const storiesVerifiedResult = await createAndApplyEvent(
      workflowState,
      createWorkflowEvent(workflowEvents.onboardingStoriesVerified, {
        userId: ingestion.userId,
        revisionId: ingestion.revisionId,
        verifiedAt: nowIso(),
        verifiedStoryCount,
      }),
      emittedEvents,
    );
    workflowState = storiesVerifiedResult.state;
  }

  if (storyBank.voice_anchor) {
    persistVoiceAnchor(ingestion.userId, ingestion.revisionId, storyBank.voice_anchor);
    const voiceAnchorRecordedResult = await createAndApplyEvent(
      workflowState,
      createWorkflowEvent(workflowEvents.onboardingVoiceAnchorRecorded, {
        userId: ingestion.userId,
        revisionId: ingestion.revisionId,
        recordedAt: nowIso(),
        voiceAnchorId: storyBank.voice_anchor.id,
      }),
      emittedEvents,
    );
    workflowState = voiceAnchorRecordedResult.state;
  }

  if (input.attestation) {
    const attestedFieldCount = attestSelectedFields(
      revisionBundle.profileFields,
      input.attestation.fieldKeys,
    );
    userQueries.attestUserProfileRevision(ingestion.revisionId);

    const attestedResult = await createAndApplyEvent(
      workflowState,
      createWorkflowEvent(workflowEvents.onboardingAttested, {
        userId: ingestion.userId,
        revisionId: ingestion.revisionId,
        attestedAt: performedAt,
        attestedFieldCount,
      }),
      emittedEvents,
    );
    workflowState = attestedResult.state;
    emittedEvents.push(...attestedResult.emittedEvents);
  }

  const voiceAnchor =
    storyBank.voice_anchor && storyBank.voice_anchor.status === "ready"
      ? storyBank.voice_anchor
      : null;

  return {
    emittedEvents,
    ingestion,
    revisionId: ingestion.revisionId,
    stories,
    userId: ingestion.userId,
    voiceAnchorId: voiceAnchor?.id ?? storyBank.voice_anchor?.id ?? null,
    workflowState,
    writingGrounding: createWritingGroundingContext({
      stories,
      voice_anchor: storyBank.voice_anchor,
    }),
  };
}

export function resetLocalWorkflowClient(): void {
  dbClient.reset();
}

export const workflowClient = {
  kind: "local-onboarding-memory",
  reset: resetLocalWorkflowClient,
  runLocalOnboardingMemoryFlow,
} as const;
