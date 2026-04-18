import type { AgentContract } from "../types";
import type {
  OnboardingAnswerFormat,
  ProfileFieldCategory,
  ProfileFieldStatus,
  SourceDocumentKind
} from "../../db/enums";
import type { JsonObject, JsonValue } from "../../db/schema";

export interface UserProfileIngestionSourceDocumentInput {
  extractedText?: string | null;
  fileName?: string | null;
  kind: SourceDocumentKind;
  label: string;
  metadata?: JsonObject;
  mimeType?: string | null;
  sha256?: string | null;
  storageRef: string;
}

export interface UserProfileIngestionAnswerInput {
  answer: JsonValue;
  answerFormat?: OnboardingAnswerFormat;
  prompt: string;
  questionKey: string;
  sourceDocumentIds?: string[];
  sourceDocumentKinds?: SourceDocumentKind[];
}

export interface UserProfileIngestionFieldInput {
  category?: ProfileFieldCategory;
  fieldKey: string;
  fieldLabel?: string;
  isRequired?: boolean;
  reason?: string | null;
  sourceAnswerIds?: string[];
  sourceAnswerKeys?: string[];
  sourceDocumentIds?: string[];
  sourceDocumentKinds?: SourceDocumentKind[];
  status?: ProfileFieldStatus;
  value: JsonValue;
}

export interface UserProfileIngestionInput {
  answers?: UserProfileIngestionAnswerInput[];
  intakeSummary?: string | null;
  profileFields?: UserProfileIngestionFieldInput[];
  revisionId?: string;
  sourceDocuments?: UserProfileIngestionSourceDocumentInput[];
  user: {
    displayName?: string | null;
    email?: string | null;
    id?: string;
    preferences?: JsonObject;
  };
}

export interface UserProfileIngestionOutput {
  answerIds: string[];
  fieldsNeedingReview: string[];
  missingRequiredFieldKeys: string[];
  profileFieldIds: string[];
  readyForCompletion: boolean;
  readyForVerification: boolean;
  revisionId: string;
  revisionStatus: "draft" | "pending_verification" | "attested" | "superseded";
  sourceDocumentIds: string[];
  unattestedRequiredFieldKeys: string[];
  userId: string;
}

export const contract: AgentContract = {
  name: "UserProfileIngestionAgent",
  version: "0.1.0",
  inputs: {
    description: "Create or update one local user profile revision from onboarding answers and source documents.",
    typeName: "UserProfileIngestionInput"
  },
  outputs: {
    description: "Persisted local onboarding-memory records plus verification readiness for the revision.",
    typeName: "UserProfileIngestionOutput"
  },
  tools: ["parse.resume", "parse.transcript", "structured.onboarding", "store.local_profile"],
  model: "deterministic-first ingestion with optional llm.extract fallback for document parsing only",
  invariants: [
    "One revision belongs to one local user.",
    "No revision becomes active until attestation completes.",
    "Every persisted profile field carries sourceAnswerIds, sourceDocumentIds, evidenceIds, or an explicit review reason.",
    "The agent records source documents for resume, transcript, and related materials without requiring hosted storage."
  ],
  failureModes: [
    "Resume or transcript parse omits critical fields.",
    "A field is captured without enough support to verify it.",
    "A source document is referenced before it is attached to the revision."
  ],
  escalation:
    "Pause for user review when a required field is missing, a source document has no usable extracted text, or multiple conflicting values exist for the same field.",
  confidence:
    "High for fields directly backed by onboarding answers or parsed documents; lower for inferred normalization, which must remain draft or needs_review until attested.",
  idempotency: "user_id + revision_id_or_new_revision + normalized_question_keys + source_document_hashes"
};
