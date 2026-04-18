export { contract } from "./contract";
export { SYSTEM_PROMPT } from "./prompt";
export type {
  UserProfileIngestionInput,
  UserProfileIngestionOutput
} from "./contract";

import { userQueries } from "../../db/queries/user";
import type { IngestOnboardingAnswersInput } from "../../db/queries/user";
import type {
  UserProfileIngestionInput,
  UserProfileIngestionOutput
} from "./contract";

function toQueryInput(input: UserProfileIngestionInput): IngestOnboardingAnswersInput {
  const nextInput: IngestOnboardingAnswersInput = {
    user: input.user
  };

  if (input.answers) {
    nextInput.answers = input.answers;
  }

  if (input.intakeSummary !== undefined) {
    nextInput.intakeSummary = input.intakeSummary;
  }

  if (input.profileFields) {
    nextInput.profileFields = input.profileFields;
  }

  if (input.revisionId) {
    nextInput.revisionId = input.revisionId;
  }

  if (input.sourceDocuments) {
    nextInput.sourceDocuments = input.sourceDocuments;
  }

  return nextInput;
}

function toOutput(result: ReturnType<typeof userQueries.ingestOnboardingAnswers>): UserProfileIngestionOutput {
  return {
    answerIds: result.answers.map((row) => row.id),
    fieldsNeedingReview: result.readiness.fieldsNeedingReview,
    missingRequiredFieldKeys: result.readiness.missingRequiredFieldKeys,
    profileFieldIds: result.profileFields.map((row) => row.id),
    readyForCompletion: result.readiness.readyForCompletion,
    readyForVerification: result.readiness.readyForVerification,
    revisionId: result.revision.id,
    revisionStatus: result.revision.status,
    sourceDocumentIds: result.sourceDocuments.map((row) => row.id),
    unattestedRequiredFieldKeys: result.readiness.unattestedRequiredFieldKeys,
    userId: result.user.id
  };
}

export async function run(input: UserProfileIngestionInput): Promise<UserProfileIngestionOutput> {
  const result = userQueries.ingestOnboardingAnswers(toQueryInput(input));
  return toOutput(result);
}
