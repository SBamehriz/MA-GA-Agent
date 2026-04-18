import {
  isVerifiedStory,
  isVoiceAnchorReady,
  type ReadyVoiceAnchorRecord,
  type StoryRecord,
  type VerifiedStoryRecord,
  type VoiceAnchorRecord
} from "../agents/types";

export const WRITING_PACKAGE = "@ma-ga-agent/writing";

export type WritingMissingRequirement = "verified_story" | "voice_anchor";

export interface WritingGroundingInput {
  stories: StoryRecord[];
  voice_anchor?: VoiceAnchorRecord | null;
}

export interface WritingGroundingContext {
  ready: boolean;
  stories: VerifiedStoryRecord[];
  voice_anchor: ReadyVoiceAnchorRecord | null;
  missing_requirements: WritingMissingRequirement[];
}

export function getVerifiedStories(
  stories: readonly StoryRecord[]
): VerifiedStoryRecord[] {
  return stories.filter(isVerifiedStory);
}

export function createWritingGroundingContext(
  input: WritingGroundingInput
): WritingGroundingContext {
  const stories = getVerifiedStories(input.stories);
  const voiceAnchor =
    input.voice_anchor && isVoiceAnchorReady(input.voice_anchor)
      ? input.voice_anchor
      : null;

  const missingRequirements: WritingMissingRequirement[] = [];
  if (stories.length === 0) {
    missingRequirements.push("verified_story");
  }
  if (!voiceAnchor) {
    missingRequirements.push("voice_anchor");
  }

  return {
    ready: missingRequirements.length === 0,
    stories,
    voice_anchor: voiceAnchor,
    missing_requirements: missingRequirements
  };
}
