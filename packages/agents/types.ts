export interface AgentContract<TInputs = unknown, TOutputs = unknown> {
  name: string;
  version: string;
  inputs: TInputs;
  outputs: TOutputs;
  tools: string[];
  model: string;
  invariants: string[];
  failureModes: string[];
  escalation: string;
  confidence: string;
  idempotency: string;
}

export type StorySourceType =
  | "resume"
  | "transcript"
  | "onboarding_answer"
  | "profile_field"
  | "project"
  | "experience"
  | "writing_sample"
  | "other";

export interface StorySourceReference {
  ref_id: string;
  ref_type: StorySourceType;
  label: string;
  excerpt?: string;
}

export type StoryVerificationStatus =
  | "pending_user_review"
  | "verified"
  | "rejected";

interface StoryRecordBase {
  id: string;
  user_id: string;
  revision_id: string;
  title: string;
  summary: string;
  proof_points: string[];
  themes: string[];
  source_refs: StorySourceReference[];
  verification_notes: string[];
  confidence: number;
}

export interface PendingStoryRecord extends StoryRecordBase {
  verified_by_user: false;
  verification_status: "pending_user_review" | "rejected";
}

export interface VerifiedStoryRecord extends StoryRecordBase {
  verified_by_user: true;
  verification_status: "verified";
  verified_at: string;
}

export type StoryRecord = PendingStoryRecord | VerifiedStoryRecord;

export interface StorySeed {
  id: string;
  title_hint?: string;
  narrative: string;
  proof_points?: string[];
  themes?: string[];
  source_refs: StorySourceReference[];
  verification_notes?: string[];
}

export interface VoiceAnchorInput {
  id: string;
  sample_text: string;
  source_refs: StorySourceReference[];
  notes?: string[];
}

export interface VoiceAnchorRecord {
  id: string;
  user_id: string;
  revision_id: string;
  sample_text: string;
  source_refs: StorySourceReference[];
  status: "missing" | "draft" | "ready";
  notes: string[];
  word_count: number;
}

export interface ReadyVoiceAnchorRecord extends VoiceAnchorRecord {
  status: "ready";
}

export interface StoryBankBuilderInput {
  user_id: string;
  revision_id: string;
  story_seeds: StorySeed[];
  existing_stories?: StoryRecord[];
  voice_anchor_input?: VoiceAnchorInput | null;
}

export interface StoryBankBuilderOutput {
  stories: StoryRecord[];
  voice_anchor: VoiceAnchorRecord | null;
  ready_for_user_review: boolean;
  ready_for_writing: boolean;
  verified_story_ids: string[];
  pending_story_ids: string[];
  rejected_story_ids: string[];
}

export function isVerifiedStory(
  story: StoryRecord
): story is VerifiedStoryRecord {
  return story.verified_by_user && story.verification_status === "verified";
}

export function isVoiceAnchorReady(
  voiceAnchor: VoiceAnchorRecord | null | undefined
): voiceAnchor is ReadyVoiceAnchorRecord {
  return voiceAnchor?.status === "ready";
}
