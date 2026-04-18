import { dbClient } from "../db/client";
import {
  loadWritingProfileContext,
  loadWritingTargetContext,
  runWritingAgent,
  type WritingArtifact,
  type WritingDocumentRequest
} from "../writing";

import {
  createWorkflowEvent,
  workflowEvents,
  type WorkflowEvent
} from "./events";

export interface LocalWritingCycleInput {
  userId: string;
  revisionId: string;
  requests: WritingDocumentRequest[];
}

export interface LocalWritingCycleResult {
  cycleId: string;
  emittedEvents: WorkflowEvent[];
  artifacts: WritingArtifact[];
  readyArtifacts: WritingArtifact[];
  pausedArtifacts: WritingArtifact[];
  totals: {
    ready: number;
    needsUserInput: number;
    groundingFailed: number;
    styleFailed: number;
    missingInputs: number;
  };
  notes: string[];
}

function nowIso(): string {
  return dbClient.now();
}

/**
 * Manager workflow for the WritingAgent slice.
 *
 *   writing.cycle.started
 *     → per request:
 *         writing.draft.generated
 *         writing.critic.ran
 *         writing.grounding.checked
 *         writing.style.checked
 *         writing.artifact.ready | writing.artifact.paused
 *   writing.cycle.complete
 *
 * Nothing in this slice sends outreach, submits an application, or writes
 * to external systems (CLAUDE.md §8 invariants 1–3). All artifacts are
 * returned to the caller for local review.
 */
export async function runLocalWritingCycle(
  input: LocalWritingCycleInput
): Promise<LocalWritingCycleResult> {
  const cycleId = `writing_cycle_${Date.now().toString(36)}_${Math.floor(
    Math.random() * 1_000_000
  )
    .toString(36)
    .padStart(4, "0")}`;
  const emittedEvents: WorkflowEvent[] = [];
  const artifacts: WritingArtifact[] = [];
  const readyArtifacts: WritingArtifact[] = [];
  const pausedArtifacts: WritingArtifact[] = [];
  const notes: string[] = [];

  const totals = {
    ready: 0,
    needsUserInput: 0,
    groundingFailed: 0,
    styleFailed: 0,
    missingInputs: 0
  };

  emittedEvents.push(
    createWorkflowEvent(workflowEvents.writingCycleStarted, {
      cycleId,
      userId: input.userId,
      revisionId: input.revisionId,
      startedAt: nowIso(),
      requestCount: input.requests.length
    })
  );

  const profile = loadWritingProfileContext(input.userId, input.revisionId);

  for (const request of input.requests) {
    let target;
    try {
      target = loadWritingTargetContext(request);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : String(error);
      notes.push(
        `[skip] request ${request.id} (${request.documentType}): ${reason}`
      );
      totals.missingInputs += 1;
      continue;
    }

    const artifact = runWritingAgent({ request, profile, target });
    artifacts.push(artifact);

    emittedEvents.push(
      createWorkflowEvent(workflowEvents.writingDraftGenerated, {
        cycleId,
        requestId: request.id,
        documentType: request.documentType,
        targetProgramId: artifact.draft.targetProgramId,
        targetUniversityId: artifact.draft.targetUniversityId,
        generatedAt: artifact.draft.generatedAt,
        wordCount: artifact.draft.wordCount,
        claimCount: artifact.draft.claimCount,
        verifiableClaimCount: artifact.draft.verifiableClaimCount
      })
    );

    emittedEvents.push(
      createWorkflowEvent(workflowEvents.writingCriticRan, {
        cycleId,
        requestId: request.id,
        ranAt: nowIso(),
        noteCount: artifact.critic.notes.length,
        blockerCount: artifact.critic.notes.filter(
          (note) => note.severity === "block"
        ).length
      })
    );

    emittedEvents.push(
      createWorkflowEvent(workflowEvents.writingGroundingChecked, {
        cycleId,
        requestId: request.id,
        checkedAt: nowIso(),
        supportedClaims: artifact.grounding.supportedClaims,
        unsupportedClaims: artifact.grounding.unsupportedClaims.length,
        passed: artifact.grounding.passed
      })
    );

    emittedEvents.push(
      createWorkflowEvent(workflowEvents.writingStyleChecked, {
        cycleId,
        requestId: request.id,
        checkedAt: nowIso(),
        voiceAnchorId: artifact.style.voiceAnchorId,
        passed: artifact.style.passed,
        sentenceLengthDelta: artifact.style.sentenceLengthDelta,
        firstPersonRatio: artifact.style.firstPersonRatio,
        bannedPhraseHits: artifact.style.bannedPhraseHits.reduce(
          (sum, hit) => sum + hit.count,
          0
        )
      })
    );

    if (artifact.readiness === "ready") {
      readyArtifacts.push(artifact);
      totals.ready += 1;
      emittedEvents.push(
        createWorkflowEvent(workflowEvents.writingArtifactReady, {
          cycleId,
          requestId: request.id,
          readyAt: nowIso(),
          documentType: request.documentType,
          readiness: artifact.readiness
        })
      );
    } else {
      pausedArtifacts.push(artifact);
      switch (artifact.readiness) {
        case "needs_user_input":
          totals.needsUserInput += 1;
          break;
        case "grounding_failed":
          totals.groundingFailed += 1;
          break;
        case "style_failed":
          totals.styleFailed += 1;
          break;
        case "missing_inputs":
          totals.missingInputs += 1;
          break;
      }
      emittedEvents.push(
        createWorkflowEvent(workflowEvents.writingArtifactPaused, {
          cycleId,
          requestId: request.id,
          pausedAt: nowIso(),
          readiness: artifact.readiness,
          rejectionReasons: artifact.rejectionReasons
        })
      );
    }
  }

  emittedEvents.push(
    createWorkflowEvent(workflowEvents.writingCycleComplete, {
      cycleId,
      userId: input.userId,
      revisionId: input.revisionId,
      completedAt: nowIso(),
      totalRequests: input.requests.length,
      readyCount: totals.ready,
      needsUserInputCount: totals.needsUserInput,
      groundingFailedCount: totals.groundingFailed,
      styleFailedCount: totals.styleFailed
    })
  );

  return {
    cycleId,
    emittedEvents,
    artifacts,
    readyArtifacts,
    pausedArtifacts,
    totals,
    notes
  };
}
