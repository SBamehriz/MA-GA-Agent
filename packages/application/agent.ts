import { dbClient } from "../db/client";
import { loadWritingProfileContext } from "../writing/resources";
import type { WritingArtifact } from "../writing/types";

import {
  buildApprovalQueue,
  emptyQueueTotals,
  tallyQueue
} from "./approval-queue";
import { buildChecklist, summarizeReadiness } from "./checklist";
import type {
  ApplicationPacket,
  ApplicationPrepInput,
  ApplicationPrepResult,
  ApprovalActionType,
  ApprovalItem,
  PacketTargetContext
} from "./types";

/**
 * ApplicationPreparationAgent.
 *
 * Orchestrates the prep slice: for each program the user has writing
 * artifacts for (or explicitly requested), build a PacketTargetContext,
 * assemble documents, produce a deterministic checklist, and emit
 * approval items. This agent never contacts an external system.
 */
export interface ApplicationPrepCycleInput extends ApplicationPrepInput {
  writingArtifacts: readonly WritingArtifact[];
  userPreferences?: {
    includeCoverLetter?: boolean;
    includePersonalStatement?: boolean;
    includePortfolio?: boolean;
  };
}

export class ApplicationPrepError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApplicationPrepError";
    this.code = code;
  }
}

function loadTargetForProgram(programId: string): PacketTargetContext {
  const program = dbClient.get("graduateProgram", programId);
  if (!program) {
    throw new ApplicationPrepError(
      "missing_program",
      `ApplicationPrepAgent cannot load program ${programId}.`
    );
  }

  const university = dbClient.get("university", program.universityId);
  if (!university) {
    throw new ApplicationPrepError(
      "missing_university",
      `ApplicationPrepAgent cannot load university ${program.universityId} for program ${programId}.`
    );
  }

  return {
    university,
    program,
    funding: null,
    personRole: null,
    person: null,
    professionalProfile: null
  };
}

/**
 * Pick the most representative opportunity context attached to a program.
 * Priority: the funding/role pair the writing artifacts already consumed >
 * highest-confidence funding for this program > highest-scored role at
 * this university. This keeps the checklist aligned with what the writing
 * cycle actually wrote.
 */
function resolveTargetContext(
  programId: string,
  writingArtifacts: readonly WritingArtifact[]
): PacketTargetContext {
  const base = loadTargetForProgram(programId);
  const artifactsForProgram = writingArtifacts.filter(
    (artifact) => artifact.draft.targetProgramId === programId
  );

  const fundingIds = new Set<string>();
  const roleIds = new Set<string>();
  const profileIds = new Set<string>();
  for (const artifact of artifactsForProgram) {
    for (const id of artifact.usageSummary.fundingIds) fundingIds.add(id);
    for (const id of artifact.usageSummary.personRoleIds) roleIds.add(id);
    for (const id of artifact.usageSummary.professionalProfileIds) {
      profileIds.add(id);
    }
  }

  let funding = null;
  if (fundingIds.size > 0) {
    for (const id of fundingIds) {
      const row = dbClient.get("fundingOpportunity", id);
      if (row && row.universityId === base.university.id) {
        funding = row;
        break;
      }
    }
  }
  if (!funding) {
    const candidates = dbClient.list(
      "fundingOpportunity",
      (row) => row.universityId === base.university.id
    );
    candidates.sort((a, b) => b.confidence - a.confidence);
    funding = candidates[0] ?? null;
  }

  let personRole = null;
  if (roleIds.size > 0) {
    for (const id of roleIds) {
      const row = dbClient.get("personRole", id);
      if (row && row.universityId === base.university.id) {
        personRole = row;
        break;
      }
    }
  }
  if (!personRole) {
    const candidates = dbClient.list(
      "personRole",
      (row) => row.universityId === base.university.id
    );
    candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    personRole = candidates[0] ?? null;
  }

  const person = personRole
    ? dbClient.get("person", personRole.personId) ?? null
    : null;

  let professionalProfile = null;
  if (profileIds.size > 0) {
    for (const id of profileIds) {
      const row = dbClient.get("professionalProfile", id);
      if (row) {
        professionalProfile = row;
        break;
      }
    }
  }
  if (!professionalProfile && personRole) {
    professionalProfile =
      dbClient.list(
        "professionalProfile",
        (row) => row.personId === personRole!.personId
      )[0] ?? null;
  }

  return {
    ...base,
    funding,
    personRole,
    person,
    professionalProfile
  };
}

function createPacketId(programId: string): string {
  return `packet_${programId}_${Date.now().toString(36)}_${Math.floor(
    Math.random() * 1_000_000
  )
    .toString(36)
    .padStart(4, "0")}`;
}

function programIdsFromArtifacts(
  writingArtifacts: readonly WritingArtifact[]
): string[] {
  const ids = new Set<string>();
  for (const artifact of writingArtifacts) {
    ids.add(artifact.draft.targetProgramId);
  }
  return [...ids];
}

/**
 * ApplicationPrepSubagent — builds one packet for one program.
 */
export function buildApplicationPacket(input: {
  userId: string;
  revisionId: string;
  programId: string;
  writingArtifacts: readonly WritingArtifact[];
  sourceDocumentIds?: readonly string[];
  userPreferences?: ApplicationPrepCycleInput["userPreferences"];
}): ApplicationPacket {
  const target = resolveTargetContext(input.programId, input.writingArtifacts);
  const profile = loadWritingProfileContext(input.userId, input.revisionId);

  const programArtifacts = input.writingArtifacts.filter(
    (artifact) => artifact.draft.targetProgramId === input.programId
  );

  const sourceDocuments = input.sourceDocumentIds
    ? input.sourceDocumentIds
        .map((id) => dbClient.get("sourceDocument", id))
        .filter((row): row is NonNullable<typeof row> => row !== null)
    : profile.sourceDocuments;

  const checklist = buildChecklist({
    target,
    profile,
    writingArtifacts: programArtifacts,
    sourceDocuments,
    userPreferences: input.userPreferences ?? {}
  });

  const readiness = summarizeReadiness(checklist);

  return {
    id: createPacketId(input.programId),
    userId: input.userId,
    revisionId: input.revisionId,
    programId: input.programId,
    universityId: target.university.id,
    fundingId: target.funding?.id ?? null,
    target,
    documents: programArtifacts,
    checklist,
    readiness,
    generatedAt: dbClient.now()
  };
}

/**
 * ApplicationPreparationAgent cycle — packets + approval queue in one
 * deterministic pass. Returns in-memory results; nothing is written to
 * external systems.
 */
export function runApplicationPrepCycle(
  input: ApplicationPrepCycleInput
): ApplicationPrepResult {
  const cycleId = `app_prep_cycle_${Date.now().toString(36)}_${Math.floor(
    Math.random() * 1_000_000
  )
    .toString(36)
    .padStart(4, "0")}`;

  const requestedProgramIds =
    input.programIds && input.programIds.length > 0
      ? input.programIds
      : programIdsFromArtifacts(input.writingArtifacts);

  const packets: ApplicationPacket[] = [];
  const approvalQueue: ApprovalItem[] = [];
  const notes: string[] = [];

  const totals = {
    packets: 0,
    readyForReview: 0,
    readyWithWarnings: 0,
    needsUserInput: 0,
    blocked: 0
  };

  for (const programId of requestedProgramIds) {
    try {
      const packet = buildApplicationPacket({
        userId: input.userId,
        revisionId: input.revisionId,
        programId,
        writingArtifacts: input.writingArtifacts,
        userPreferences: input.userPreferences ?? {}
      });
      packets.push(packet);
      totals.packets += 1;

      switch (packet.readiness.status) {
        case "ready_for_review":
          totals.readyForReview += 1;
          break;
        case "ready_with_warnings":
          totals.readyWithWarnings += 1;
          break;
        case "needs_user_input":
          totals.needsUserInput += 1;
          break;
        case "blocked":
          totals.blocked += 1;
          break;
      }

      const queueItems = buildApprovalQueue({ packet });
      approvalQueue.push(...queueItems);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      notes.push(`[skip] program ${programId}: ${reason}`);
    }
  }

  const queueTotals: Record<ApprovalActionType, number> =
    approvalQueue.length > 0 ? tallyQueue(approvalQueue) : emptyQueueTotals();

  return {
    cycleId,
    packets,
    approvalQueue,
    totals,
    queueTotals,
    notes,
    generatedAt: dbClient.now()
  };
}
