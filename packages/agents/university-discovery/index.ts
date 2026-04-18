import { createHash } from "node:crypto";

import { universityQueries } from "../../db/queries/university";
import { createExternalSourceEvidenceBatch } from "../../evidence/external";

import {
  contract,
  type UniversityCandidateInput,
  type UniversityCandidateResult,
  type UniversityDiscoveryFilters,
  type UniversityDiscoveryInput,
  type UniversityDiscoveryOutput
} from "./contract";
import { SYSTEM_PROMPT } from "./prompt";

export { contract, SYSTEM_PROMPT };
export * from "./contract";

function hashFilters(filters: UniversityDiscoveryFilters): string {
  const canonical = JSON.stringify({
    targetCountries: [...(filters.targetCountries ?? [])].sort(),
    targetStates: [...(filters.targetStates ?? [])].sort(),
    researchThemes: [...(filters.researchThemes ?? [])].sort(),
    requiredTierTags: [...(filters.requiredTierTags ?? [])].sort()
  });

  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function passesFilters(
  candidate: UniversityCandidateInput,
  filters: UniversityDiscoveryFilters
): { accepted: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (
    filters.targetCountries?.length &&
    !filters.targetCountries.includes(candidate.country)
  ) {
    reasons.push(
      `country "${candidate.country}" not in target list (${filters.targetCountries.join(", ")})`
    );
  }

  if (
    filters.targetStates?.length &&
    candidate.state &&
    !filters.targetStates.includes(candidate.state)
  ) {
    reasons.push(
      `state "${candidate.state}" not in target list (${filters.targetStates.join(", ")})`
    );
  }

  if (
    filters.requiredTierTags?.length &&
    (!candidate.tierTag || !filters.requiredTierTags.includes(candidate.tierTag))
  ) {
    reasons.push(
      `tier "${candidate.tierTag ?? "unknown"}" not in required tiers (${filters.requiredTierTags.join(", ")})`
    );
  }

  return { accepted: reasons.length === 0, reasons };
}

function scoreCandidate(
  candidate: UniversityCandidateInput,
  filters: UniversityDiscoveryFilters
): { score: number; breakdown: string[] } {
  const breakdown: string[] = [];
  let score = 0;

  if (filters.targetCountries?.includes(candidate.country)) {
    score += 0.35;
    breakdown.push(`country_match(${candidate.country})+0.35`);
  }

  if (candidate.state && filters.targetStates?.includes(candidate.state)) {
    score += 0.15;
    breakdown.push(`state_match(${candidate.state})+0.15`);
  }

  if (candidate.tierTag === "R1") {
    score += 0.2;
    breakdown.push("tier_R1+0.20");
  } else if (candidate.tierTag === "R2") {
    score += 0.1;
    breakdown.push("tier_R2+0.10");
  }

  const themes = filters.researchThemes ?? [];
  const themeMatches = candidate.researchFocus.filter((focus) =>
    themes.some((theme) => focus.toLowerCase().includes(theme.toLowerCase()))
  );

  if (themes.length > 0 && themeMatches.length > 0) {
    const bonus = Math.min(0.3, themeMatches.length * 0.1);
    score += bonus;
    breakdown.push(
      `research_theme_match(${themeMatches.join("|")})+${bonus.toFixed(2)}`
    );
  }

  if (candidate.evidence.length >= 2) {
    score += 0.05;
    breakdown.push(`evidence_density(${candidate.evidence.length})+0.05`);
  }

  return { score: Math.min(1, score), breakdown };
}

/**
 * Seed-based university discovery: accepts a set of user-attested or
 * previously-crawled candidates, applies the user's geo/research filters,
 * attaches evidence rows, and persists the surviving universities.
 *
 * Follows agents.md §4.1 — a real network-bound implementation would plug
 * Tavily/Exa/Firecrawl into the same input-output shape.
 */
export async function run(
  input: UniversityDiscoveryInput
): Promise<UniversityDiscoveryOutput> {
  const results: UniversityCandidateResult[] = [];
  const filtersHash = hashFilters(input.filters);
  const notes: string[] = [];

  for (const candidate of input.candidates) {
    if (candidate.evidence.length === 0) {
      results.push({
        universityId: "",
        canonicalName: candidate.canonicalName,
        country: candidate.country,
        state: candidate.state ?? null,
        tierTag: candidate.tierTag ?? null,
        primaryDomain: candidate.primaryDomain,
        initialFitScore: 0,
        fitScoreBreakdown: [],
        accepted: false,
        reason: "no evidence provided — rejected per evidence-first rule",
        evidenceIds: []
      });
      continue;
    }

    const gate = passesFilters(candidate, input.filters);

    if (!gate.accepted) {
      results.push({
        universityId: "",
        canonicalName: candidate.canonicalName,
        country: candidate.country,
        state: candidate.state ?? null,
        tierTag: candidate.tierTag ?? null,
        primaryDomain: candidate.primaryDomain,
        initialFitScore: 0,
        fitScoreBreakdown: [],
        accepted: false,
        reason: `filter_reject: ${gate.reasons.join("; ")}`,
        evidenceIds: []
      });
      continue;
    }

    const allocation = universityQueries.allocateId(candidate.primaryDomain);
    const evidenceIds = createExternalSourceEvidenceBatch(
      candidate.evidence.map((ev) => ({
        sourceUrl: ev.sourceUrl,
        sourceType: ev.sourceType,
        sourceLabel: ev.sourceLabel,
        quotedText: ev.quotedText,
        sourceQualityScore: ev.sourceQualityScore ?? 0.8,
        subjectType: "university",
        subjectId: allocation.id
      }))
    );

    const { score, breakdown } = scoreCandidate(candidate, input.filters);

    const upsertInput: {
      id: string;
      canonicalName: string;
      country: string;
      primaryDomain: string;
      evidenceIds: string[];
      aliases?: string[];
      state?: string | null;
      tierTag?: string | null;
      ipedsId?: string | null;
    } = {
      id: allocation.id,
      canonicalName: candidate.canonicalName,
      country: candidate.country,
      primaryDomain: candidate.primaryDomain,
      evidenceIds
    };
    if (candidate.aliases) upsertInput.aliases = candidate.aliases;
    if (candidate.state !== undefined) upsertInput.state = candidate.state;
    if (candidate.tierTag !== undefined) upsertInput.tierTag = candidate.tierTag;
    if (candidate.ipedsId !== undefined) upsertInput.ipedsId = candidate.ipedsId;

    const university = universityQueries.upsert(upsertInput);

    results.push({
      universityId: university.id,
      canonicalName: university.canonicalName,
      country: university.country,
      state: university.state,
      tierTag: university.tierTag,
      primaryDomain: university.primaryDomain,
      initialFitScore: score,
      fitScoreBreakdown: breakdown,
      accepted: true,
      reason: "passed_filters",
      evidenceIds: university.evidenceIds
    });
  }

  const accepted = results.filter((r) => r.accepted);
  const rejected = results.filter((r) => !r.accepted);

  notes.push(
    `considered=${results.length}  accepted=${accepted.length}  rejected=${rejected.length}  filters_hash=${filtersHash}`
  );

  const allUniversities = universityQueries.listAll();
  const universities = accepted
    .map((r) => allUniversities.find((u) => u.id === r.universityId))
    .filter(
      (record): record is NonNullable<typeof record> => record !== undefined
    );

  return {
    universities,
    results,
    acceptedIds: accepted.map((r) => r.universityId),
    rejectedCandidates: rejected,
    filtersHash,
    notes
  };
}
