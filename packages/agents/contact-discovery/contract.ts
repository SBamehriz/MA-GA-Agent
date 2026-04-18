import type {
  EvidenceSourceType,
  RoleTag
} from "../../db/enums";
import type {
  PersonRecord,
  PersonRoleRecord
} from "../../db/schema";
import type { AgentContract } from "../types";

export interface ContactEvidenceInput {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  quotedText: string;
  sourceQualityScore?: number;
}

export interface ContactCandidateInput {
  canonicalName: string;
  nameAliases?: string[];
  roleTag: RoleTag;
  roleTitle: string;
  researchAreas?: string[];
  preferredEmail?: string | null;
  emails?: string[];
  departmentId: string;
  programId?: string | null;
  facultyPageUrl?: string;
  scholarUrl?: string;
  personalUrl?: string;
  /**
   * User-attested LinkedIn URL, if any. LinkedIn data is NEVER scraped —
   * only user-attested or approved-provider-stub URLs are accepted.
   * See CLAUDE.md §8.10 + agents.md §4.10.
   */
  attestedLinkedinUrl?: string | null;
  /** Institution match between the candidate and the program's university. */
  institutionMatch?: boolean;
  /** Title match between the candidate's role and the LinkedIn headline. */
  titleMatch?: boolean;
  evidence: ContactEvidenceInput[];
}

export interface ContactDiscoveryInput {
  universityId: string;
  contacts: ContactCandidateInput[];
}

export interface ContactDiscoveryResult {
  personId: string;
  canonicalName: string;
  personRoleId: string;
  roleTag: RoleTag;
  roleTitle: string;
  departmentId: string;
  programId: string | null;
  relevanceScore: number;
  evidenceIds: string[];
  pendingEnrichment: boolean;
}

export interface ContactDiscoveryOutput {
  persons: PersonRecord[];
  personRoles: PersonRoleRecord[];
  results: ContactDiscoveryResult[];
  enrichmentQueue: ContactCandidateEnrichmentRequest[];
  notes: string[];
}

export interface ContactCandidateEnrichmentRequest {
  personId: string;
  canonicalName: string;
  departmentId: string;
  roleTag: RoleTag;
  roleTitle: string;
  researchAreas: string[];
  facultyPageUrl?: string;
  scholarUrl?: string;
  personalUrl?: string;
  attestedLinkedinUrl?: string | null;
  institutionMatch: boolean;
  titleMatch: boolean;
  evidence: ContactEvidenceInput[];
}

export const contract: AgentContract = {
  name: "ContactDiscoveryAgent",
  version: "0.1.0",
  inputs: {
    description:
      "Per-department / per-program contact seeds with role, role_tag, research areas, and source evidence. Produces person + person_role rows and queues profile enrichment.",
    typeName: "ContactDiscoveryInput"
  },
  outputs: {
    description:
      "Persisted person + person_role + faculty/scholar professional_profile rows; every row carries evidence. Enrichment queue forwarded to ProfileEnrichmentAgent.",
    typeName: "ContactDiscoveryOutput"
  },
  tools: [
    "department.directory.crawler",
    "grad.school.directory.crawler",
    "lab.page.crawler",
    "scholar.search(SerpAPI)"
  ],
  model:
    "deterministic directory extraction in this slice. LLM name-disambiguation is NOT wired — two viable candidates are kept distinct per agents.md §4.9.",
  invariants: [
    "Every person_role carries at least one evidence row.",
    "A contact with two viable candidates is kept as distinct persons, never merged.",
    "LinkedIn enrichment is queued — it is NOT performed directly in this agent.",
    "Obfuscated emails are not expanded by heuristics — stored as-is and flagged."
  ],
  failureModes: [
    "Email obfuscation (dots/spaces/AT swap) misparsed.",
    "Wrong person with same name.",
    "Stale role (person left the institution)."
  ],
  escalation:
    "No contact found for a funding opportunity tagged `unclear` → prompt user for guidance.",
  confidence:
    "Role-weighted (DGS/PI/coordinator > staff > other) × directory specificity (department > grad school > lab > aggregator).",
  idempotency: "{university_id, department_id, canonical_name, role_tag}"
};
