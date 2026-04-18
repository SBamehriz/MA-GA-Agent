import type { ProfessionalProfileRecord } from "../../db/schema";
import type { AgentContract } from "../types";
import type { ContactCandidateEnrichmentRequest } from "../contact-discovery/contract";

export interface ProfileEnrichmentInput {
  requests: ContactCandidateEnrichmentRequest[];
}

export interface ProfileEnrichmentResult {
  personId: string;
  canonicalName: string;
  profileId: string;
  profileType: ProfessionalProfileRecord["type"];
  provider: ProfessionalProfileRecord["provider"];
  url: string;
  confidence: number;
  verificationSignals: string[];
  outreachReady: boolean;
  reason: string;
}

export interface ProfileEnrichmentOutput {
  profiles: ProfessionalProfileRecord[];
  results: ProfileEnrichmentResult[];
  skipped: Array<{
    personId: string;
    canonicalName: string;
    reason: string;
  }>;
  notes: string[];
}

export const contract: AgentContract = {
  name: "ProfileEnrichmentAgent",
  version: "0.1.0",
  inputs: {
    description:
      "Contacts queued for profile enrichment (faculty/scholar/personal/LinkedIn) with institution_match and title_match signals.",
    typeName: "ProfileEnrichmentInput"
  },
  outputs: {
    description:
      "Persisted professional_profile rows per contact with confidence; LinkedIn rows only created from user_attested or approved_provider_stub providers.",
    typeName: "ProfileEnrichmentOutput"
  },
  tools: ["enrich.linkedin(approved_provider)", "scholar.search(SerpAPI)"],
  model:
    "deterministic signal aggregation (institution_match × title_match × research_area_overlap). No direct LinkedIn scraping — agent refuses unless provider is user_attested or approved_provider_stub.",
  invariants: [
    "LinkedIn profiles are never populated via direct scraping — only user_attested URLs or approved provider output.",
    "A profile with confidence < 0.85 is NOT flagged outreach-ready.",
    "Two viable candidates for the same person produce distinct rows; the agent never merges.",
    "Every profile row carries at least one evidence row bound to its subject_id."
  ],
  failureModes: [
    "Name collision across two real people with the same canonical name.",
    "Private LinkedIn profile passed as URL with no signals.",
    "Out-of-date role on a faculty page."
  ],
  escalation:
    "Two viable candidates → keep distinct. Confidence < 0.85 → hold from outreach binding.",
  confidence:
    "institution_match(+0.25) × title_match(+0.2) × research_area_overlap(0–0.3) × provider_quality(+0.1 base; +0.2 if user_attested).",
  idempotency: "{person_id, profile_url}"
};
