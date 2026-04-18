import {
  workflowEvents,
  type ResearchSweepEvent,
  type ResearchCycleStartedPayload,
  type WorkflowEvent,
} from "./events";

export type ResearchSweepStatus =
  | "idle"
  | "running_universities"
  | "running_programs"
  | "running_funding"
  | "running_contacts"
  | "running_profiles"
  | "complete"
  | "halted";

export interface PerUniversityProgress {
  universityId: string;
  programsQualifiedAt: string | null;
  fundingAnalyzedAt: string | null;
  contactsEnrichedAt: string | null;
  profilesEnrichedAt: string | null;
  programCount: number;
  coreProgramCount: number;
  fundingCount: number;
  unclearFundingCount: number;
  personRoleCount: number;
  profilesPersistedCount: number;
}

export interface ResearchSweepState {
  cycleId: string;
  userId: string;
  revisionId: string;
  filtersHash: string;
  status: ResearchSweepStatus;
  startedAt: string;
  lastEventAt: string;
  lastEventName: ResearchSweepEvent["name"];
  universitiesConsidered: number;
  acceptedUniversityIds: string[];
  perUniversity: Record<string, PerUniversityProgress>;
  completedAt: string | null;
  totals: {
    universityCount: number;
    programCount: number;
    fundingCount: number;
    contactCount: number;
  };
  notes: string[];
}

export interface ResearchSweepResult {
  state: ResearchSweepState;
  emittedEvents: WorkflowEvent[];
}

export function createInitialResearchSweepState(
  payload: ResearchCycleStartedPayload,
): ResearchSweepState {
  return {
    cycleId: payload.cycleId,
    userId: payload.userId,
    revisionId: payload.revisionId,
    filtersHash: payload.filtersHash,
    status: "idle",
    startedAt: payload.startedAt,
    lastEventAt: payload.startedAt,
    lastEventName: workflowEvents.researchCycleStarted,
    universitiesConsidered: 0,
    acceptedUniversityIds: [],
    perUniversity: {},
    completedAt: null,
    totals: {
      universityCount: 0,
      programCount: 0,
      fundingCount: 0,
      contactCount: 0,
    },
    notes: [],
  };
}

function assertMatchingCycle(state: ResearchSweepState, cycleId: string): void {
  if (state.cycleId !== cycleId) {
    throw new Error(
      `Research sweep event for cycle "${cycleId}" does not match active cycle "${state.cycleId}".`,
    );
  }
}

function ensurePerUniversity(
  state: ResearchSweepState,
  universityId: string,
): PerUniversityProgress {
  const existing = state.perUniversity[universityId];
  if (existing) return existing;

  const fresh: PerUniversityProgress = {
    universityId,
    programsQualifiedAt: null,
    fundingAnalyzedAt: null,
    contactsEnrichedAt: null,
    profilesEnrichedAt: null,
    programCount: 0,
    coreProgramCount: 0,
    fundingCount: 0,
    unclearFundingCount: 0,
    personRoleCount: 0,
    profilesPersistedCount: 0,
  };
  state.perUniversity[universityId] = fresh;
  return fresh;
}

export function applyResearchSweepEvent(
  state: ResearchSweepState,
  event: ResearchSweepEvent,
): ResearchSweepState {
  switch (event.name) {
    case workflowEvents.researchCycleStarted:
      return createInitialResearchSweepState(event.payload);

    case workflowEvents.researchUniversitiesDiscovered: {
      assertMatchingCycle(state, event.payload.cycleId);
      const next: ResearchSweepState = {
        ...state,
        status: "running_universities",
        lastEventAt: event.payload.recordedAt,
        lastEventName: event.name,
        universitiesConsidered: event.payload.consideredCount,
        acceptedUniversityIds: [...event.payload.acceptedUniversityIds],
        perUniversity: { ...state.perUniversity },
        totals: {
          ...state.totals,
          universityCount: event.payload.acceptedCount,
        },
      };

      for (const uniId of event.payload.acceptedUniversityIds) {
        if (!next.perUniversity[uniId]) {
          next.perUniversity[uniId] = {
            universityId: uniId,
            programsQualifiedAt: null,
            fundingAnalyzedAt: null,
            contactsEnrichedAt: null,
            profilesEnrichedAt: null,
            programCount: 0,
            coreProgramCount: 0,
            fundingCount: 0,
            unclearFundingCount: 0,
            personRoleCount: 0,
            profilesPersistedCount: 0,
          };
        }
      }
      return next;
    }

    case workflowEvents.researchProgramsQualified: {
      assertMatchingCycle(state, event.payload.cycleId);
      const next: ResearchSweepState = {
        ...state,
        status: "running_programs",
        lastEventAt: event.payload.recordedAt,
        lastEventName: event.name,
        perUniversity: { ...state.perUniversity },
        totals: {
          ...state.totals,
          programCount: state.totals.programCount + event.payload.programCount,
        },
      };
      const perUni = ensurePerUniversity(next, event.payload.universityId);
      perUni.programsQualifiedAt = event.payload.recordedAt;
      perUni.programCount = event.payload.programCount;
      perUni.coreProgramCount = event.payload.coreCount;
      return next;
    }

    case workflowEvents.researchFundingAnalyzed: {
      assertMatchingCycle(state, event.payload.cycleId);
      const next: ResearchSweepState = {
        ...state,
        status: "running_funding",
        lastEventAt: event.payload.recordedAt,
        lastEventName: event.name,
        perUniversity: { ...state.perUniversity },
        totals: {
          ...state.totals,
          fundingCount:
            state.totals.fundingCount + event.payload.opportunityCount,
        },
      };
      const perUni = ensurePerUniversity(next, event.payload.universityId);
      perUni.fundingAnalyzedAt = event.payload.recordedAt;
      perUni.fundingCount = event.payload.opportunityCount;
      perUni.unclearFundingCount = event.payload.unclearCount;
      return next;
    }

    case workflowEvents.researchContactsEnriched: {
      assertMatchingCycle(state, event.payload.cycleId);
      const next: ResearchSweepState = {
        ...state,
        status: "running_contacts",
        lastEventAt: event.payload.recordedAt,
        lastEventName: event.name,
        perUniversity: { ...state.perUniversity },
        totals: {
          ...state.totals,
          contactCount:
            state.totals.contactCount + event.payload.personRoleCount,
        },
      };
      const perUni = ensurePerUniversity(next, event.payload.universityId);
      perUni.contactsEnrichedAt = event.payload.recordedAt;
      perUni.personRoleCount = event.payload.personRoleCount;
      return next;
    }

    case workflowEvents.researchProfilesEnriched: {
      assertMatchingCycle(state, event.payload.cycleId);
      const next: ResearchSweepState = {
        ...state,
        status: "running_profiles",
        lastEventAt: event.payload.recordedAt,
        lastEventName: event.name,
        perUniversity: { ...state.perUniversity },
      };
      const perUni = ensurePerUniversity(next, event.payload.universityId);
      perUni.profilesEnrichedAt = event.payload.recordedAt;
      perUni.profilesPersistedCount = event.payload.profilesPersisted;
      return next;
    }

    case workflowEvents.researchCycleComplete: {
      assertMatchingCycle(state, event.payload.cycleId);
      return {
        ...state,
        status: "complete",
        lastEventAt: event.payload.completedAt,
        lastEventName: event.name,
        completedAt: event.payload.completedAt,
        totals: {
          universityCount: event.payload.universityCount,
          programCount: event.payload.programCount,
          fundingCount: event.payload.fundingCount,
          contactCount: event.payload.contactCount,
        },
      };
    }
  }
}

export async function researchSweepWorkflow(
  currentState: ResearchSweepState | null,
  event: ResearchSweepEvent,
): Promise<ResearchSweepResult> {
  const baseState =
    currentState ??
    (event.name === workflowEvents.researchCycleStarted
      ? createInitialResearchSweepState(event.payload)
      : (() => {
          throw new Error(
            "The local research sweep workflow must start with research.cycle.started.",
          );
        })());

  const nextState = applyResearchSweepEvent(baseState, event);
  return { state: nextState, emittedEvents: [] };
}

/**
 * Deferred / legacy export — left so any prior imports keep resolving while
 * callers migrate to `researchSweepWorkflow` above.
 */
export async function research_sweepWorkflow(): Promise<void> {
  return;
}
