import { classifyFunding } from "../../classifiers/funding-taxonomy";
import { fundingQueries } from "../../db/queries/funding";
import { createExternalSourceEvidenceBatch } from "../../evidence/external";

import {
  contract,
  type FundingDiscoveryInput,
  type FundingDiscoveryOutput,
  type FundingDiscoveryResult,
  type FundingOpportunitySeed
} from "./contract";
import { SYSTEM_PROMPT } from "./prompt";

export { contract, SYSTEM_PROMPT };
export * from "./contract";

function materializeEvidence(
  seed: FundingOpportunitySeed,
  subjectId: string
): string[] {
  return createExternalSourceEvidenceBatch(
    seed.evidence.map((ev) => ({
      sourceUrl: ev.sourceUrl,
      sourceType: ev.sourceType,
      sourceLabel: ev.sourceLabel,
      quotedText: ev.quotedText,
      sourceQualityScore: ev.sourceQualityScore ?? 0.8,
      subjectType: "funding_opportunity",
      subjectId
    }))
  );
}

/**
 * Runs FundingDiscoveryAgent + inline FundingClassificationAgent per
 * agents.md §4.5–§4.6. Classification is deterministic via
 * `classifiers/funding-taxonomy`; LLM fallback is not wired in this slice —
 * unmatched seeds are stored as `unclear` and surfaced for review.
 */
export async function run(
  input: FundingDiscoveryInput
): Promise<FundingDiscoveryOutput> {
  const results: FundingDiscoveryResult[] = [];
  const notes: string[] = [];

  for (const seed of input.opportunities) {
    if (seed.evidence.length === 0) {
      notes.push(
        `rejected funding "${seed.title}" — no evidence provided, skipped per evidence-first rule`
      );
      continue;
    }

    const classification = classifyFunding({
      title: seed.title,
      description: seed.description
    });

    const allocation = fundingQueries.allocateId(input.universityId, seed.title);
    const evidenceIds = materializeEvidence(seed, allocation.id);

    const upsertInput: Parameters<typeof fundingQueries.upsert>[0] = {
      id: allocation.id,
      universityId: input.universityId,
      departmentId: seed.departmentId ?? null,
      programId: seed.programId ?? null,
      hostType: seed.hostType,
      title: seed.title,
      description: seed.description,
      fundingClass: classification.fundingClass,
      tuitionCoverage: classification.tuitionCoverage,
      stipendAmount: classification.stipendAmount,
      stipendPeriod: classification.stipendPeriod,
      ftePct: classification.ftePct,
      eligibility: seed.eligibility ?? {},
      intlEligible: seed.intlEligible ?? null,
      applicationUrl: seed.applicationUrl ?? null,
      deadlineDate: seed.deadlineDate ?? null,
      primaryContactId: seed.contactPersonId ?? null,
      confidence: classification.confidence,
      classificationNotes: classification.notes,
      taxonomyMatches: classification.matchedPhrases,
      evidenceIds
    };

    const opportunity = fundingQueries.upsert(upsertInput);

    results.push({
      fundingOpportunityId: opportunity.id,
      title: opportunity.title,
      hostType: opportunity.hostType,
      programId: opportunity.programId,
      departmentId: opportunity.departmentId,
      fundingClass: opportunity.fundingClass,
      tuitionCoverage: opportunity.tuitionCoverage,
      stipendAmount: opportunity.stipendAmount,
      stipendPeriod: opportunity.stipendPeriod,
      ftePct: opportunity.ftePct,
      confidence: opportunity.confidence,
      classificationNotes: opportunity.classificationNotes,
      taxonomyMatches: opportunity.taxonomyMatches,
      evidenceIds: opportunity.evidenceIds
    });
  }

  const opportunities = fundingQueries.listByUniversity(input.universityId);
  const unclearOpportunities = results.filter(
    (r) => r.fundingClass === "unclear"
  );

  notes.push(
    `seeds=${input.opportunities.length}  persisted=${results.length}  unclear=${unclearOpportunities.length}`
  );

  return {
    opportunities,
    results,
    unclearOpportunities,
    notes
  };
}
