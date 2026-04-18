import { isVoiceAnchorReady } from "../agents/types";
import type { VerifiedStoryRecord } from "../agents/types";
import { dbClient } from "../db/client";
import type {
  ProfileFieldRecord,
  SourceDocumentRecord,
  StoryRecord,
  VoiceAnchorRecord
} from "../db/schema";

import type { WritingProfileContext } from "./types";

export class WritingResourceError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WritingResourceError";
    this.code = code;
  }
}

function toAgentStoryRecord(
  row: StoryRecord
): VerifiedStoryRecord | null {
  if (!row.verifiedByUser || !row.verifiedAt) {
    return null;
  }

  const sourceRefs = row.sourceRefs.map((sourceRef, index) => ({
    ref_id: sourceRef,
    ref_type: row.sourceTypes[index] ?? "other",
    label: sourceRef
  }));

  return {
    id: row.id,
    user_id: row.userId,
    revision_id: row.revisionId,
    title: row.title,
    summary: row.summary,
    proof_points: [...row.proofPoints],
    themes: [...row.themes],
    source_refs: sourceRefs,
    verified_by_user: true,
    verification_status: "verified",
    verification_notes: [],
    confidence: 0.9,
    verified_at: row.verifiedAt
  };
}

/**
 * Build a writing-side view of the user's grounded memory for a given
 * revision. Enforces CLAUDE.md §8.4 (no unsourced facts) at the writing
 * input boundary: attestation + story verification + voice-anchor readiness
 * are required before the agent can draft.
 */
export function loadWritingProfileContext(
  userId: string,
  revisionId: string
): WritingProfileContext {
  const user = dbClient.get("user", userId);
  if (!user) {
    throw new WritingResourceError(
      "missing_user",
      `WritingAgent cannot load profile: user ${userId} not found.`
    );
  }

  const revision = dbClient.get("userProfileRevision", revisionId);
  if (!revision) {
    throw new WritingResourceError(
      "missing_revision",
      `WritingAgent cannot load profile: revision ${revisionId} not found.`
    );
  }

  const profileFields = dbClient.list(
    "profileField",
    (row) => row.revisionId === revisionId
  );

  const attestedFields = new Map<string, ProfileFieldRecord>();
  const attestedFieldsByKey = new Map<string, ProfileFieldRecord>();
  for (const field of profileFields) {
    if (field.status === "attested") {
      attestedFields.set(field.id, field);
      attestedFieldsByKey.set(field.fieldKey, field);
    }
  }

  if (attestedFields.size === 0) {
    throw new WritingResourceError(
      "no_attested_fields",
      "WritingAgent refuses to draft: no attested profile fields exist. Finish onboarding attestation first."
    );
  }

  const storyRows = dbClient.list(
    "story",
    (row) => row.revisionId === revisionId
  );

  const verifiedStories = storyRows
    .map(toAgentStoryRecord)
    .filter((row): row is VerifiedStoryRecord => row !== null);

  if (verifiedStories.length === 0) {
    throw new WritingResourceError(
      "no_verified_stories",
      "WritingAgent refuses to draft: at least one user-verified story is required (agents.md §4.13)."
    );
  }

  const voiceAnchors = dbClient.list(
    "voiceAnchor",
    (row) => row.revisionId === revisionId
  );
  const voiceAnchor: VoiceAnchorRecord | null =
    voiceAnchors.find((row) => row.verifiedAt !== null) ?? voiceAnchors[0] ?? null;

  if (!voiceAnchor) {
    throw new WritingResourceError(
      "missing_voice_anchor",
      "WritingAgent refuses to draft: voice anchor is required (agents.md §4.13)."
    );
  }

  if (!voiceAnchor.verifiedAt) {
    throw new WritingResourceError(
      "voice_anchor_not_ready",
      `WritingAgent refuses to draft: voice anchor ${voiceAnchor.id} is not yet ready (verifiedAt is null).`
    );
  }

  const sourceDocuments: SourceDocumentRecord[] = dbClient.list(
    "sourceDocument",
    (row) => row.revisionId === revisionId
  );

  void isVoiceAnchorReady;

  return {
    userId,
    revisionId,
    attestedFields,
    attestedFieldsByKey,
    verifiedStories,
    allStories: storyRows,
    voiceAnchor,
    sourceDocuments
  };
}
