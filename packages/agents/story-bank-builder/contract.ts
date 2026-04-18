import type {
  AgentContract,
  StoryBankBuilderInput,
  StoryBankBuilderOutput
} from "../types";

const inputExample: StoryBankBuilderInput = {
  user_id: "<user_id>",
  revision_id: "<profile_revision_id>",
  story_seeds: [
    {
      id: "<story_seed_id>",
      title_hint: "Built a research prototype under time pressure",
      narrative: "<user-provided narrative>",
      proof_points: ["<concrete result>", "<specific technical choice>"],
      themes: ["technical depth", "ownership"],
      source_refs: [
        {
          ref_id: "<resume_project_id>",
          ref_type: "resume",
          label: "Resume project bullet",
          excerpt: "<quoted resume excerpt>"
        },
        {
          ref_id: "<onboarding_answer_id>",
          ref_type: "onboarding_answer",
          label: "Onboarding answer",
          excerpt: "<quoted user answer>"
        }
      ]
    }
  ],
  voice_anchor_input: {
    id: "<voice_anchor_id>",
    sample_text: "<3-5 paragraphs of user writing>",
    source_refs: [
      {
        ref_id: "<writing_sample_id>",
        ref_type: "writing_sample",
        label: "Writing sample"
      }
    ],
    notes: ["Collected during onboarding session 3"]
  }
};

const outputExample: StoryBankBuilderOutput = {
  stories: [
    {
      id: "<story_seed_id>",
      user_id: "<user_id>",
      revision_id: "<profile_revision_id>",
      title: "Built a research prototype under time pressure",
      summary: "<normalized story summary>",
      proof_points: ["<concrete result>", "<specific technical choice>"],
      themes: ["technical depth", "ownership"],
      source_refs: [
        {
          ref_id: "<resume_project_id>",
          ref_type: "resume",
          label: "Resume project bullet",
          excerpt: "<quoted resume excerpt>"
        },
        {
          ref_id: "<onboarding_answer_id>",
          ref_type: "onboarding_answer",
          label: "Onboarding answer",
          excerpt: "<quoted user answer>"
        }
      ],
      verified_by_user: false,
      verification_status: "pending_user_review",
      verification_notes: [],
      confidence: 0.82
    }
  ],
  voice_anchor: {
    id: "<voice_anchor_id>",
    user_id: "<user_id>",
    revision_id: "<profile_revision_id>",
    sample_text: "<3-5 paragraphs of user writing>",
    source_refs: [
      {
        ref_id: "<writing_sample_id>",
        ref_type: "writing_sample",
        label: "Writing sample"
      }
    ],
    status: "draft",
    notes: ["Collected during onboarding session 3"],
    word_count: 0
  },
  ready_for_user_review: true,
  ready_for_writing: false,
  verified_story_ids: [],
  pending_story_ids: ["<story_seed_id>"],
  rejected_story_ids: []
};

export const contract: AgentContract<
  StoryBankBuilderInput,
  StoryBankBuilderOutput
> = {
  name: "StoryBankBuilderAgent",
  version: "0.1.0",
  inputs: inputExample,
  outputs: outputExample,
  tools: ["voice-to-text", "resume-cross-reference"],
  model: "sonnet_story_synthesis",
  invariants: [
    "Every story draft must include at least one source_refs entry.",
    "verified_by_user remains false until the user explicitly verifies the story.",
    "Only verified stories are eligible for downstream writing use."
  ],
  failureModes: [
    "Multiple distinct episodes merged into one story draft.",
    "Source references are missing or too vague to support verification.",
    "A previously verified story is accidentally overwritten during regeneration."
  ],
  escalation:
    "Pause and request user clarification when a story cannot be supported by a concrete source reference or when one seed appears to contain multiple unrelated episodes.",
  confidence:
    "Derived from source reference count, proof-point specificity, and whether the draft can be tied to resume or onboarding evidence without invention.",
  idempotency:
    "Keyed on {revision_id, story_seed.id}; preserve verified or rejected stories on repeated runs."
};
