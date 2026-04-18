import { run as runContactDiscovery } from "../agents/contact-discovery";
import type {
  ContactCandidateEnrichmentRequest,
  ContactCandidateInput,
} from "../agents/contact-discovery";
import type { FundingOpportunitySeed } from "../agents/funding-discovery";
import { run as runFundingDiscovery } from "../agents/funding-discovery";
import { run as runProfileEnrichment } from "../agents/profile-enrichment";
import type {
  ProgramQualificationCandidate,
} from "../agents/program-qualification";
import { run as runProgramQualification } from "../agents/program-qualification";
import type {
  UniversityCandidateInput,
  UniversityDiscoveryFilters,
  UniversityDiscoveryOutput,
} from "../agents/university-discovery";
import { run as runUniversityDiscovery } from "../agents/university-discovery";
import { dbClient } from "../db/client";
import type {
  FundingOpportunityRecord,
  GraduateProgramRecord,
  PersonRecord,
  PersonRoleRecord,
  ProfessionalProfileRecord,
  ResearchCycleRecord,
  UniversityRecord,
} from "../db/schema";

import {
  createWorkflowEvent,
  workflowEvents,
  type ResearchSweepEvent,
  type WorkflowEvent,
} from "./events";
import {
  applyResearchSweepEvent,
  createInitialResearchSweepState,
  type ResearchSweepState,
} from "./research-sweep";

/**
 * A `university_seed` is one university candidate bundled with the programs,
 * funding opportunities, and contacts we want the sweep to qualify, classify,
 * and enrich if the university passes discovery filters.
 *
 * Everything is user-attested or prior-crawled in this slice — the sweep
 * performs NO network fetch, which keeps the local run deterministic and
 * mirrors agents.md §3.1 (current emphasis: correctness before scale).
 */
export interface ResearchUniversitySeed {
  university: UniversityCandidateInput;
  programs: ProgramQualificationCandidate[];
  funding: FundingOpportunitySeed[];
  contacts: ContactCandidateInput[];
}

export interface LocalResearchSweepInput {
  userId: string;
  revisionId: string;
  reason?: "onboarding_complete" | "manual_refresh";
  filters: UniversityDiscoveryFilters;
  universities: ResearchUniversitySeed[];
}

export interface LocalResearchSweepResult {
  cycleId: string;
  state: ResearchSweepState;
  emittedEvents: WorkflowEvent[];
  universities: UniversityRecord[];
  programs: GraduateProgramRecord[];
  funding: FundingOpportunityRecord[];
  persons: PersonRecord[];
  personRoles: PersonRoleRecord[];
  professionalProfiles: ProfessionalProfileRecord[];
  cycleRecord: ResearchCycleRecord;
  notes: string[];
}

function nowIso(): string {
  return dbClient.now();
}

function persistCycle(input: {
  id: string;
  userId: string;
  revisionId: string;
  reason: string;
  filtersHash: string;
  startedAt: string;
}): ResearchCycleRecord {
  const now = nowIso();
  const record: ResearchCycleRecord = {
    id: input.id,
    userId: input.userId,
    revisionId: input.revisionId,
    status: "running",
    reason: input.reason,
    startedAt: input.startedAt,
    completedAt: null,
    filtersHash: input.filtersHash,
    universityCount: 0,
    programCount: 0,
    fundingCount: 0,
    contactCount: 0,
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
  return dbClient.insert("researchCycle", record);
}

function updateCycle(
  id: string,
  patch: Partial<Omit<ResearchCycleRecord, "id" | "createdAt">>,
): ResearchCycleRecord {
  return dbClient.update("researchCycle", id, (row) => ({
    ...row,
    ...patch,
    updatedAt: nowIso(),
  }));
}

function applyEvent(
  state: ResearchSweepState,
  event: ResearchSweepEvent,
  emitted: WorkflowEvent[],
): ResearchSweepState {
  emitted.push(event);
  return applyResearchSweepEvent(state, event);
}

function countRelevance(
  programs: GraduateProgramRecord[],
  ids: string[],
): { core: number; adjacent: number; tangential: number; rejected: number } {
  const idSet = new Set(ids);
  const rows = programs.filter((p) => idSet.has(p.id));
  return {
    core: rows.filter((p) => p.relevanceClass === "core").length,
    adjacent: rows.filter((p) => p.relevanceClass === "adjacent").length,
    tangential: rows.filter((p) => p.relevanceClass === "tangential").length,
    rejected: rows.filter((p) => p.relevanceClass === "rejected").length,
  };
}

function findSeedForUniversity(
  universities: readonly ResearchUniversitySeed[],
  universityRecord: UniversityRecord,
): ResearchUniversitySeed | undefined {
  const targetDomain = universityRecord.primaryDomain.trim().toLowerCase();
  return universities.find(
    (seed) =>
      seed.university.primaryDomain.trim().toLowerCase() === targetDomain,
  );
}

/**
 * Manager workflow for the research sweep.
 *
 * onboarding.complete → research.cycle.started
 *   → UniversityDiscoveryAgent → research.universities.discovered
 *   → for each accepted university:
 *       ProgramQualificationAgent → research.programs.qualified
 *       FundingDiscoveryAgent → research.funding.analyzed
 *       ContactDiscoveryAgent → research.contacts.enriched
 *       ProfileEnrichmentAgent → research.profiles.enriched
 *   → research.cycle.complete
 *
 * Every persisted external-world row is evidence-backed, classification is
 * deterministic (funding taxonomy + AI keyword heuristics), and no network
 * fetch is performed in this slice.
 */
export async function runLocalResearchSweep(
  input: LocalResearchSweepInput,
): Promise<LocalResearchSweepResult> {
  const emittedEvents: WorkflowEvent[] = [];
  const notes: string[] = [];
  const cycleId = dbClient.createId("researchCycle");
  const startedAt = nowIso();
  const reason = input.reason ?? "onboarding_complete";

  const discovery: UniversityDiscoveryOutput = await runUniversityDiscovery({
    userId: input.userId,
    revisionId: input.revisionId,
    filters: input.filters,
    candidates: input.universities.map((seed) => seed.university),
  });

  const cycleRecord = persistCycle({
    id: cycleId,
    userId: input.userId,
    revisionId: input.revisionId,
    reason,
    filtersHash: discovery.filtersHash,
    startedAt,
  });

  let state = createInitialResearchSweepState({
    cycleId,
    userId: input.userId,
    revisionId: input.revisionId,
    startedAt,
    reason,
    filtersHash: discovery.filtersHash,
  });
  emittedEvents.push(
    createWorkflowEvent(workflowEvents.researchCycleStarted, {
      cycleId,
      userId: input.userId,
      revisionId: input.revisionId,
      startedAt,
      reason,
      filtersHash: discovery.filtersHash,
    }),
  );

  state = applyEvent(
    state,
    createWorkflowEvent(workflowEvents.researchUniversitiesDiscovered, {
      cycleId,
      recordedAt: nowIso(),
      consideredCount: discovery.results.length,
      acceptedCount: discovery.acceptedIds.length,
      rejectedCount: discovery.rejectedCandidates.length,
      acceptedUniversityIds: discovery.acceptedIds,
    }),
    emittedEvents,
  );

  for (const uni of discovery.universities) {
    const seed = findSeedForUniversity(input.universities, uni);
    if (!seed) {
      notes.push(
        `[warn] accepted university ${uni.canonicalName} (${uni.id}) has no matching seed — skipped downstream agents`,
      );
      continue;
    }

    const programResult = await runProgramQualification({
      universityId: uni.id,
      primaryDomain: uni.primaryDomain,
      researchThemes: input.filters.researchThemes ?? [],
      candidates: seed.programs,
    });

    const relevanceCounts = countRelevance(
      programResult.programs,
      programResult.results.map((r) => r.programId),
    );

    state = applyEvent(
      state,
      createWorkflowEvent(workflowEvents.researchProgramsQualified, {
        cycleId,
        recordedAt: nowIso(),
        universityId: uni.id,
        programCount: programResult.results.length,
        coreCount: relevanceCounts.core,
        adjacentCount: relevanceCounts.adjacent,
        tangentialCount: relevanceCounts.tangential,
        rejectedCount: relevanceCounts.rejected,
      }),
      emittedEvents,
    );

    const resolvedFunding: FundingOpportunitySeed[] = seed.funding.map(
      (fund) => {
        if (!fund.programId && fund.departmentId) return fund;
        if (!fund.programId) return fund;

        const matchedProgram = programResult.programs.find((p) => {
          const programMarker = fund.programId ?? "";
          return (
            p.title.trim().toLowerCase() === programMarker.trim().toLowerCase()
          );
        });

        return matchedProgram
          ? { ...fund, programId: matchedProgram.id }
          : { ...fund, programId: null };
      },
    );

    const fundingResult = await runFundingDiscovery({
      universityId: uni.id,
      opportunities: resolvedFunding,
    });

    state = applyEvent(
      state,
      createWorkflowEvent(workflowEvents.researchFundingAnalyzed, {
        cycleId,
        recordedAt: nowIso(),
        universityId: uni.id,
        opportunityCount: fundingResult.results.length,
        unclearCount: fundingResult.unclearOpportunities.length,
      }),
      emittedEvents,
    );

    const resolvedContacts: ContactCandidateInput[] = seed.contacts.map(
      (contact) => {
        const department = programResult.departments.find((d) => {
          return (
            d.name.trim().toLowerCase() ===
            contact.departmentId.trim().toLowerCase()
          );
        });

        return {
          ...contact,
          departmentId: department?.id ?? contact.departmentId,
        };
      },
    );

    const contactResult = await runContactDiscovery({
      universityId: uni.id,
      contacts: resolvedContacts,
    });

    state = applyEvent(
      state,
      createWorkflowEvent(workflowEvents.researchContactsEnriched, {
        cycleId,
        recordedAt: nowIso(),
        universityId: uni.id,
        personCount: contactResult.persons.length,
        personRoleCount: contactResult.results.length,
      }),
      emittedEvents,
    );

    const enrichmentQueue: ContactCandidateEnrichmentRequest[] =
      contactResult.enrichmentQueue;

    const enrichmentResult =
      enrichmentQueue.length > 0
        ? await runProfileEnrichment({ requests: enrichmentQueue })
        : { profiles: [], results: [], skipped: [], notes: [] };

    state = applyEvent(
      state,
      createWorkflowEvent(workflowEvents.researchProfilesEnriched, {
        cycleId,
        recordedAt: nowIso(),
        universityId: uni.id,
        profilesPersisted: enrichmentResult.results.length,
        profilesSkipped: enrichmentResult.skipped.length,
      }),
      emittedEvents,
    );
  }

  const completedAt = nowIso();
  const universitiesAll = dbClient.list("university");
  const programsAll = dbClient.list("graduateProgram");
  const fundingAll = dbClient.list("fundingOpportunity");
  const personsAll = dbClient.list("person");
  const personRolesAll = dbClient.list("personRole");
  const profilesAll = dbClient.list("professionalProfile");

  updateCycle(cycleId, {
    status: "complete",
    completedAt,
    universityCount: state.totals.universityCount,
    programCount: state.totals.programCount,
    fundingCount: state.totals.fundingCount,
    contactCount: state.totals.contactCount,
    notes,
  });

  state = applyEvent(
    state,
    createWorkflowEvent(workflowEvents.researchCycleComplete, {
      cycleId,
      userId: input.userId,
      revisionId: input.revisionId,
      completedAt,
      universityCount: state.totals.universityCount,
      programCount: state.totals.programCount,
      fundingCount: state.totals.fundingCount,
      contactCount: state.totals.contactCount,
    }),
    emittedEvents,
  );

  const refreshedCycle = dbClient.get("researchCycle", cycleId) ?? cycleRecord;

  return {
    cycleId,
    state,
    emittedEvents,
    universities: universitiesAll,
    programs: programsAll,
    funding: fundingAll,
    persons: personsAll,
    personRoles: personRolesAll,
    professionalProfiles: profilesAll,
    cycleRecord: refreshedCycle,
    notes,
  };
}
