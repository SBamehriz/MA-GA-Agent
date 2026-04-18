import {
  isVerifiedStory,
  isVoiceAnchorReady,
  type PendingStoryRecord,
  type StoryBankBuilderInput,
  type StoryBankBuilderOutput,
  type StoryRecord,
  type StorySeed,
  type StorySourceReference,
  type VerifiedStoryRecord,
  type VoiceAnchorInput,
  type VoiceAnchorRecord
} from "../types";

export { contract } from "./contract";
export { SYSTEM_PROMPT } from "./prompt";
export type { StoryBankBuilderInput, StoryBankBuilderOutput } from "../types";
export type { StoryRecord } from "../types";

export const VOICE_ANCHOR_READY_MIN_WORDS = 120;
export const VOICE_ANCHOR_READY_MIN_PARAGRAPHS = 3;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => normalizeText(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function sourceRefKey(sourceRef: StorySourceReference): string {
  return `${sourceRef.ref_type}:${sourceRef.ref_id}`;
}

function dedupeSourceRefs(
  sourceRefs: readonly StorySourceReference[]
): StorySourceReference[] {
  const seen = new Set<string>();
  const result: StorySourceReference[] = [];

  for (const sourceRef of sourceRefs) {
    const key = sourceRefKey(sourceRef);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      ...sourceRef,
      label: normalizeText(sourceRef.label),
      ...(sourceRef.excerpt
        ? { excerpt: normalizeText(sourceRef.excerpt) }
        : {})
    });
  }

  return result;
}

function deriveTitle(seed: StorySeed): string {
  const explicitTitle = seed.title_hint ? normalizeText(seed.title_hint) : "";
  if (explicitTitle) {
    return explicitTitle;
  }

  const firstSentence =
    seed.narrative
      .split(/[.!?]/)
      .map((sentence) => normalizeText(sentence))
      .find((sentence) => sentence.length > 0) ?? "Untitled story";

  const words = firstSentence.split(" ").filter((word) => word.length > 0);
  return words.slice(0, 8).join(" ");
}

function truncateSummary(value: string, maxLength = 280): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength - 3);
  const cutoff = truncated.lastIndexOf(" ");
  const safeCutoff = cutoff > 80 ? cutoff : truncated.length;
  return `${truncated.slice(0, safeCutoff).trim()}...`;
}

function deriveSummary(seed: StorySeed): string {
  return truncateSummary(normalizeText(seed.narrative));
}

function deriveProofPoints(seed: StorySeed): string[] {
  if (seed.proof_points && seed.proof_points.length > 0) {
    return uniqueStrings(seed.proof_points);
  }

  const sentences = seed.narrative
    .split(/[.!?]/)
    .map((sentence) => normalizeText(sentence))
    .filter((sentence) => sentence.length > 0);

  return uniqueStrings(sentences.slice(0, 3));
}

function deriveThemes(seed: StorySeed): string[] {
  return uniqueStrings(seed.themes ?? []);
}

function computeStoryConfidence(seed: StorySeed, proofPoints: string[]): number {
  const sourceScore = Math.min(seed.source_refs.length, 3) * 0.15;
  const proofPointScore = Math.min(proofPoints.length, 3) * 0.08;
  const titleScore = seed.title_hint ? 0.08 : 0;
  const baseScore = 0.35;

  return Math.min(0.95, baseScore + sourceScore + proofPointScore + titleScore);
}

function buildPendingStory(
  seed: StorySeed,
  input: Pick<StoryBankBuilderInput, "user_id" | "revision_id">
): PendingStoryRecord {
  if (seed.source_refs.length === 0) {
    throw new Error(`Story seed "${seed.id}" is missing source_refs.`);
  }

  const proofPoints = deriveProofPoints(seed);

  return {
    id: seed.id,
    user_id: input.user_id,
    revision_id: input.revision_id,
    title: deriveTitle(seed),
    summary: deriveSummary(seed),
    proof_points: proofPoints,
    themes: deriveThemes(seed),
    source_refs: dedupeSourceRefs(seed.source_refs),
    verified_by_user: false,
    verification_status: "pending_user_review",
    verification_notes: uniqueStrings(seed.verification_notes ?? []),
    confidence: computeStoryConfidence(seed, proofPoints)
  };
}

function findExistingStory(
  seed: StorySeed,
  existingStories: readonly StoryRecord[]
): StoryRecord | undefined {
  return existingStories.find((story) => story.id === seed.id);
}

export function verifyStory(
  story: StoryRecord,
  verifiedAt: string,
  note?: string
): VerifiedStoryRecord {
  return {
    ...story,
    verified_by_user: true,
    verification_status: "verified",
    verification_notes: note
      ? uniqueStrings([...story.verification_notes, note])
      : story.verification_notes,
    verified_at: verifiedAt
  };
}

export function rejectStory(story: StoryRecord, note?: string): PendingStoryRecord {
  return {
    id: story.id,
    user_id: story.user_id,
    revision_id: story.revision_id,
    title: story.title,
    summary: story.summary,
    proof_points: [...story.proof_points],
    themes: [...story.themes],
    source_refs: dedupeSourceRefs(story.source_refs),
    verified_by_user: false,
    verification_status: "rejected",
    verification_notes: note
      ? uniqueStrings([...story.verification_notes, note])
      : [...story.verification_notes],
    confidence: story.confidence
  };
}

export function buildVoiceAnchorRecord(
  voiceAnchorInput: VoiceAnchorInput | null | undefined,
  input: Pick<StoryBankBuilderInput, "user_id" | "revision_id">
): VoiceAnchorRecord | null {
  if (!voiceAnchorInput) {
    return null;
  }

  const paragraphs = normalizeParagraphs(voiceAnchorInput.sample_text);
  const sampleText = paragraphs.join("\n\n");
  const wordCount = sampleText
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const status: VoiceAnchorRecord["status"] =
    sampleText.length === 0
      ? "missing"
      : wordCount >= VOICE_ANCHOR_READY_MIN_WORDS &&
          paragraphs.length >= VOICE_ANCHOR_READY_MIN_PARAGRAPHS
        ? "ready"
        : "draft";

  return {
    id: voiceAnchorInput.id,
    user_id: input.user_id,
    revision_id: input.revision_id,
    sample_text: sampleText,
    source_refs: dedupeSourceRefs(voiceAnchorInput.source_refs),
    status,
    notes: uniqueStrings(voiceAnchorInput.notes ?? []),
    word_count: wordCount
  };
}

export function buildStoryBank(
  input: StoryBankBuilderInput
): StoryBankBuilderOutput {
  const existingStories = input.existing_stories ?? [];
  const stories = input.story_seeds.map((seed) => {
    const existing = findExistingStory(seed, existingStories);

    if (
      existing &&
      (isVerifiedStory(existing) || existing.verification_status === "rejected")
    ) {
      return existing;
    }

    return buildPendingStory(seed, input);
  });

  const voiceAnchor = buildVoiceAnchorRecord(input.voice_anchor_input, input);
  const verifiedStoryIds = stories
    .filter(isVerifiedStory)
    .map((story) => story.id);
  const pendingStoryIds = stories
    .filter((story) => story.verification_status === "pending_user_review")
    .map((story) => story.id);
  const rejectedStoryIds = stories
    .filter((story) => story.verification_status === "rejected")
    .map((story) => story.id);

  return {
    stories,
    voice_anchor: voiceAnchor,
    ready_for_user_review: stories.length > 0,
    ready_for_writing:
      verifiedStoryIds.length > 0 && isVoiceAnchorReady(voiceAnchor),
    verified_story_ids: verifiedStoryIds,
    pending_story_ids: pendingStoryIds,
    rejected_story_ids: rejectedStoryIds
  };
}

export async function run(
  input: StoryBankBuilderInput
): Promise<StoryBankBuilderOutput> {
  return buildStoryBank(input);
}
