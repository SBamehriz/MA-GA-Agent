import type {
  EvidenceSourceType,
  FundingHostType
} from "../../db/enums";
import type { FundingOpportunityRecord, JsonObject } from "../../db/schema";
import type { AgentContract } from "../types";

export interface FundingEvidenceInput {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  quotedText: string;
  sourceQualityScore?: number;
}

export interface FundingOpportunitySeed {
  title: string;
  description: string;
  hostType: FundingHostType;
  programId?: string | null;
  departmentId?: string | null;
  applicationUrl?: string | null;
  deadlineDate?: string | null;
  eligibility?: JsonObject;
  intlEligible?: boolean | null;
  contactPersonId?: string | null;
  evidence: FundingEvidenceInput[];
}

export interface FundingDiscoveryInput {
  universityId: string;
  opportunities: FundingOpportunitySeed[];
}

export interface FundingDiscoveryResult {
  fundingOpportunityId: string;
  title: string;
  hostType: FundingHostType;
  programId: string | null;
  departmentId: string | null;
  fundingClass: FundingOpportunityRecord["fundingClass"];
  tuitionCoverage: FundingOpportunityRecord["tuitionCoverage"];
  stipendAmount: number | null;
  stipendPeriod: FundingOpportunityRecord["stipendPeriod"];
  ftePct: number | null;
  confidence: number;
  classificationNotes: string[];
  taxonomyMatches: string[];
  evidenceIds: string[];
}

export interface FundingDiscoveryOutput {
  opportunities: FundingOpportunityRecord[];
  results: FundingDiscoveryResult[];
  unclearOpportunities: FundingDiscoveryResult[];
  notes: string[];
}

export const contract: AgentContract = {
  name: "FundingDiscoveryAgent",
  version: "0.1.0",
  inputs: {
    description:
      "Per-university funding seeds (GA/TA/RA, fellowships, tuition waivers) with source evidence. Runs deterministic taxonomy classification in-line.",
    typeName: "FundingDiscoveryInput"
  },
  outputs: {
    description:
      "Persisted funding_opportunity rows with funding_class, tuition_coverage, stipend amount/period, ftePct, taxonomy matches, and evidence.",
    typeName: "FundingDiscoveryOutput"
  },
  tools: [
    "department.hr.crawler",
    "grad.school.funding.crawler",
    "lab.join.us.crawler",
    "classify.funding(taxonomy)"
  ],
  model:
    "deterministic funding-taxonomy classifier in this slice. LLM fallback intentionally not wired — any unmatched opportunity is stored as `unclear`.",
  invariants: [
    "Every funding opportunity carries at least one URL-backed evidence row.",
    "Historical postings (past deadline >30 days) are flagged before classification.",
    "`full_tuition_plus_stipend` and `full_tuition_only` require a matching deterministic taxonomy phrase; mere LLM inference is NOT sufficient.",
    "A funding row that survives validation is linkable to program/department/lab — never orphaned."
  ],
  failureModes: [
    "Duplicate opportunities across grad-school and department pages.",
    "Treating a historical posting as current.",
    "Misreading `in-state waiver` as `full_tuition`.",
    "Misreading `may include` as `includes`."
  ],
  escalation:
    "Opportunity mentioned historically with no current signal → mark `unclear` with note and surface to user. Two sources disagreeing on funding_class → do not pick silently (per data-model.md §7).",
  confidence:
    "Per-source weighted: department HR crawler > grad-school funding page > lab join-us page > aggregator. Taxonomy-matched classification > LLM inference > guess (rejected).",
  idempotency: "{university_id, program_id_or_department_id, title}"
};
