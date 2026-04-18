import { classifyFunding } from "../../classifiers/funding-taxonomy";

import {
  contract,
  type FundingClassificationAgentInput,
  type FundingClassificationAgentOutput
} from "./contract";
import { SYSTEM_PROMPT } from "./prompt";

export { contract, SYSTEM_PROMPT };
export * from "./contract";

export async function run(
  input: FundingClassificationAgentInput
): Promise<FundingClassificationAgentOutput> {
  const classification = classifyFunding({
    title: input.title,
    description: input.description
  });

  return {
    fundingOpportunityId: input.fundingOpportunityId,
    fundingClass: classification.fundingClass,
    tuitionCoverage: classification.tuitionCoverage,
    stipendAmount: classification.stipendAmount,
    stipendPeriod: classification.stipendPeriod,
    ftePct: classification.ftePct,
    confidence: classification.confidence,
    matchedPhrases: classification.matchedPhrases,
    notes: classification.notes,
    method:
      classification.matchedPhrases.length > 0
        ? "deterministic_taxonomy"
        : "unclear_fallback"
  };
}
