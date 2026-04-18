import type { RoleTag } from "../../db/enums";
import { contactQueries } from "../../db/queries/contact";
import { createExternalSourceEvidenceBatch } from "../../evidence/external";

import {
  contract,
  type ContactCandidateEnrichmentRequest,
  type ContactCandidateInput,
  type ContactDiscoveryInput,
  type ContactDiscoveryOutput,
  type ContactDiscoveryResult,
  type ContactEvidenceInput
} from "./contract";
import { SYSTEM_PROMPT } from "./prompt";

export { contract, SYSTEM_PROMPT };
export * from "./contract";

const ROLE_WEIGHTS: Record<RoleTag, number> = {
  professor: 0.7,
  pi: 0.85,
  dgs: 0.95,
  coordinator: 0.8,
  hr: 0.75,
  lab_manager: 0.7,
  staff: 0.5,
  other: 0.3
};

function computeRelevanceScore(
  candidate: ContactCandidateInput,
  themeHits: number
): number {
  const roleWeight = ROLE_WEIGHTS[candidate.roleTag];
  const evidenceBonus = Math.min(0.1, candidate.evidence.length * 0.04);
  const themeBonus = Math.min(0.1, themeHits * 0.05);
  return Number(Math.min(1, roleWeight + evidenceBonus + themeBonus).toFixed(2));
}

function materializeEvidence(
  evidence: readonly ContactEvidenceInput[],
  subjectType: "person_role",
  subjectId: string
): string[] {
  return createExternalSourceEvidenceBatch(
    evidence.map((ev) => ({
      sourceUrl: ev.sourceUrl,
      sourceType: ev.sourceType,
      sourceLabel: ev.sourceLabel,
      quotedText: ev.quotedText,
      sourceQualityScore: ev.sourceQualityScore ?? 0.75,
      subjectType,
      subjectId
    }))
  );
}

export async function run(
  input: ContactDiscoveryInput
): Promise<ContactDiscoveryOutput> {
  const results: ContactDiscoveryResult[] = [];
  const enrichmentQueue: ContactCandidateEnrichmentRequest[] = [];
  const notes: string[] = [];

  for (const candidate of input.contacts) {
    if (candidate.evidence.length === 0) {
      notes.push(
        `rejected contact "${candidate.canonicalName}" — no evidence provided`
      );
      continue;
    }

    const personInput: {
      canonicalName: string;
      nameAliases?: string[];
      preferredEmail?: string | null;
      emails?: string[];
      primaryOrgId?: string | null;
    } = {
      canonicalName: candidate.canonicalName,
      primaryOrgId: input.universityId
    };
    if (candidate.nameAliases) personInput.nameAliases = candidate.nameAliases;
    if (candidate.preferredEmail !== undefined) {
      personInput.preferredEmail = candidate.preferredEmail;
    }
    if (candidate.emails) personInput.emails = candidate.emails;

    const person = contactQueries.upsertPerson(personInput);

    const roleAlloc = contactQueries.allocatePersonRoleId(
      person.id,
      input.universityId,
      candidate.departmentId,
      candidate.roleTag
    );

    const evidenceIds = materializeEvidence(
      candidate.evidence,
      "person_role",
      roleAlloc.id
    );

    const themeHits = (candidate.researchAreas ?? []).length;
    const relevanceScore = computeRelevanceScore(candidate, themeHits);

    const roleInput: Parameters<typeof contactQueries.upsertPersonRole>[0] = {
      id: roleAlloc.id,
      personId: person.id,
      universityId: input.universityId,
      departmentId: candidate.departmentId,
      programId: candidate.programId ?? null,
      roleTag: candidate.roleTag,
      roleTitle: candidate.roleTitle,
      researchAreas: candidate.researchAreas ?? [],
      relevanceScore,
      evidenceIds
    };

    const role = contactQueries.upsertPersonRole(roleInput);

    const enrichmentRequest: ContactCandidateEnrichmentRequest = {
      personId: person.id,
      canonicalName: person.canonicalName,
      departmentId: candidate.departmentId,
      roleTag: candidate.roleTag,
      roleTitle: candidate.roleTitle,
      researchAreas: candidate.researchAreas ?? [],
      institutionMatch: candidate.institutionMatch ?? true,
      titleMatch: candidate.titleMatch ?? false,
      evidence: candidate.evidence
    };
    if (candidate.facultyPageUrl !== undefined) {
      enrichmentRequest.facultyPageUrl = candidate.facultyPageUrl;
    }
    if (candidate.scholarUrl !== undefined) {
      enrichmentRequest.scholarUrl = candidate.scholarUrl;
    }
    if (candidate.personalUrl !== undefined) {
      enrichmentRequest.personalUrl = candidate.personalUrl;
    }
    if (candidate.attestedLinkedinUrl !== undefined) {
      enrichmentRequest.attestedLinkedinUrl = candidate.attestedLinkedinUrl;
    }

    enrichmentQueue.push(enrichmentRequest);

    results.push({
      personId: person.id,
      canonicalName: person.canonicalName,
      personRoleId: role.id,
      roleTag: role.roleTag,
      roleTitle: role.roleTitle,
      departmentId: role.departmentId ?? candidate.departmentId,
      programId: role.programId,
      relevanceScore: role.relevanceScore,
      evidenceIds: role.evidenceIds,
      pendingEnrichment: true
    });
  }

  const persons = contactQueries.listAllPersons();
  const personRoles = contactQueries.listRolesForUniversity(input.universityId);

  notes.push(
    `candidates=${input.contacts.length}  persons_persisted=${results.length}  enrichment_queued=${enrichmentQueue.length}`
  );

  return {
    persons,
    personRoles,
    results,
    enrichmentQueue,
    notes
  };
}
