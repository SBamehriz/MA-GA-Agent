import type {
  EvidenceSourceType
} from "../../db/enums";
import type { UniversityRecord } from "../../db/schema";
import type { AgentContract } from "../types";

export interface UniversityCandidateEvidenceInput {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  quotedText: string;
  sourceQualityScore?: number;
}

export interface UniversityCandidateInput {
  canonicalName: string;
  aliases?: string[];
  country: string;
  state?: string | null;
  tierTag?: string | null;
  primaryDomain: string;
  ipedsId?: string | null;
  researchFocus: string[];
  evidence: UniversityCandidateEvidenceInput[];
}

export interface UniversityDiscoveryFilters {
  targetCountries?: string[];
  targetStates?: string[];
  researchThemes?: string[];
  requiredTierTags?: string[];
}

export interface UniversityDiscoveryInput {
  userId: string;
  revisionId: string;
  filters: UniversityDiscoveryFilters;
  candidates: UniversityCandidateInput[];
}

export interface UniversityCandidateResult {
  universityId: string;
  canonicalName: string;
  country: string;
  state: string | null;
  tierTag: string | null;
  primaryDomain: string;
  initialFitScore: number;
  fitScoreBreakdown: string[];
  accepted: boolean;
  reason: string;
  evidenceIds: string[];
}

export interface UniversityDiscoveryOutput {
  universities: UniversityRecord[];
  results: UniversityCandidateResult[];
  acceptedIds: string[];
  rejectedCandidates: UniversityCandidateResult[];
  filtersHash: string;
  notes: string[];
}

export const contract: AgentContract = {
  name: "UniversityDiscoveryAgent",
  version: "0.1.0",
  inputs: {
    description:
      "Seed-based university candidates plus user geo/research filters; produces a ranked, filtered set of university rows.",
    typeName: "UniversityDiscoveryInput"
  },
  outputs: {
    description:
      "Persisted university records with initial_fit_score and evidence bindings; rejected candidates returned with reason.",
    typeName: "UniversityDiscoveryOutput"
  },
  tools: ["search.web", "crawl.page", "seed.csv"],
  model:
    "deterministic seed-based scoring in this slice; search.web/crawl.page remain declared for future live discovery",
  invariants: [
    "Every university row is created with at least one evidence row (URL + quoted snippet + sourceType).",
    "Candidates failing the country/state filter are rejected — never silently re-homed.",
    "Satellite campuses with the same primary_domain merge into the parent university, they do not create duplicates.",
    "No network fetch is performed in this slice — seeds are attested by the user or by a prior crawl run."
  ],
  failureModes: [
    "Satellite campus duplicated as its own university.",
    "Non-target country slipping in because the filter was not applied.",
    "Candidate evidence missing a URL or quoted snippet."
  ],
  escalation:
    "If a candidate has strong AI signal but fails the country filter, emit it as a rejected candidate with reason so the user can override in a future run — never silently include.",
  confidence:
    "Identity confidence >= 0.95 required; fit score is initial only and refined by ProgramQualificationAgent.",
  idempotency: "{user_id, filters_hash, primary_domain}"
};
