import type {
  FundingClass,
  StipendPeriod,
  TuitionCoverage
} from "../../db/enums";
import type { AgentContract } from "../types";

export interface FundingClassificationAgentInput {
  fundingOpportunityId: string;
  title: string;
  description: string;
}

export interface FundingClassificationAgentOutput {
  fundingOpportunityId: string;
  fundingClass: FundingClass;
  tuitionCoverage: TuitionCoverage;
  stipendAmount: number | null;
  stipendPeriod: StipendPeriod;
  ftePct: number | null;
  confidence: number;
  matchedPhrases: string[];
  notes: string[];
  method: "deterministic_taxonomy" | "unclear_fallback";
}

export const contract: AgentContract = {
  name: "FundingClassificationAgent",
  version: "0.1.0",
  inputs: {
    description:
      "Single funding opportunity text to classify into a funding_class with explicit taxonomy matches.",
    typeName: "FundingClassificationAgentInput"
  },
  outputs: {
    description:
      "Deterministic funding_class + tuition_coverage + stipend details + matched taxonomy phrases used as evidence anchors.",
    typeName: "FundingClassificationAgentOutput"
  },
  tools: ["classify.funding(taxonomy)"],
  model:
    "deterministic taxonomy only in this slice. LLM fallback is the escalation path — wired later.",
  invariants: [
    "Deterministic match outranks LLM inference; LLM inference outranks guess (rejected).",
    "full_tuition_plus_stipend / full_tuition_only require a matching deterministic phrase.",
    "A low-confidence or unmatched classification returns `unclear` — never a plausible guess."
  ],
  failureModes: [
    "Misreading `in-state waiver` as `full_tuition`.",
    "Misreading `may include` as `includes`.",
    "Misreading a stipend figure that lacks a clear period."
  ],
  escalation:
    "LLM fallback with low confidence → mark `unclear` and surface for review. Two disagreeing classifications are stored as `field_candidate` rows (per data-model.md §7), not silently resolved.",
  confidence:
    "Deterministic match ≥0.75 by rule; unmatched falls back to 0.4 with class `unclear`.",
  idempotency: "{funding_opportunity_id, content_hash(title + description)}"
};
