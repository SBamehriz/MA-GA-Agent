import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  resetLocalWorkflowClient,
  runLocalOnboardingMemoryFlow,
  type LocalOnboardingMemoryInput,
  type LocalOnboardingMemoryResult,
} from "../packages/workflows/client";
import {
  workflowEvents,
  type WorkflowEvent,
} from "../packages/workflows/events";
import {
  applyOnboardingEvent,
  createInitialOnboardingState,
  type OnboardingWorkflowState,
} from "../packages/workflows/onboarding";

const DEFAULT_FIXTURE_REL_PATH = "fixtures/seeds/onboarding-sample.json";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function resolveFixturePath(): string {
  const explicit = process.argv[2];
  const rel = explicit ?? DEFAULT_FIXTURE_REL_PATH;
  return resolve(repoRoot(), rel);
}

function loadFixture(fixturePath: string): LocalOnboardingMemoryInput {
  const raw = readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as unknown as LocalOnboardingMemoryInput & {
    $schema?: string;
    description?: string;
  };

  if (!parsed.ingestion?.user) {
    throw new Error(
      `Fixture ${fixturePath} is missing ingestion.user; the onboarding harness cannot ensure a local user without it.`,
    );
  }

  if (!parsed.storyMemory?.story_seeds?.length) {
    throw new Error(
      `Fixture ${fixturePath} is missing storyMemory.story_seeds; at least one seed is required to draft stories.`,
    );
  }

  return parsed;
}

interface EventTrace {
  index: number;
  eventName: WorkflowEvent["name"];
  status: OnboardingWorkflowState["status"];
  verifiedStoryCount: number;
  storyDraftCount: number;
  voiceAnchorId: string | null;
  attestedAt: string | null;
  completedAt: string | null;
}

function traceWorkflowEvents(events: readonly WorkflowEvent[]): EventTrace[] {
  const traces: EventTrace[] = [];
  let state: OnboardingWorkflowState | null = null;

  events.forEach((event, index) => {
    if (event.name === workflowEvents.onboardingStarted) {
      state = createInitialOnboardingState(event.payload);
    } else if (state) {
      state = applyOnboardingEvent(
        state,
        event as Parameters<typeof applyOnboardingEvent>[1],
      );
    }

    const snapshot = state;
    traces.push({
      index: index + 1,
      eventName: event.name,
      status: snapshot?.status ?? "idle",
      verifiedStoryCount: snapshot?.verifiedStoryCount ?? 0,
      storyDraftCount: snapshot?.storyDraftCount ?? 0,
      voiceAnchorId: snapshot?.voiceAnchorId ?? null,
      attestedAt: snapshot?.attestedAt ?? null,
      completedAt: snapshot?.completedAt ?? null,
    });
  });

  return traces;
}

function countAnswers(input: LocalOnboardingMemoryInput): number {
  return input.ingestion.answers?.length ?? 0;
}

function countSourceDocuments(input: LocalOnboardingMemoryInput): number {
  return input.ingestion.sourceDocuments?.length ?? 0;
}

function printHeader(fixturePath: string): void {
  console.log("================================================================");
  console.log(" MA-GA-Agent - local onboarding-memory harness");
  console.log("================================================================");
  console.log(` fixture: ${fixturePath}`);
  console.log("");
}

function printInputSummary(input: LocalOnboardingMemoryInput): void {
  console.log("--- Loaded fixture ---");
  console.log(
    `  user: ${input.ingestion.user.displayName ?? "(unnamed)"} <${
      input.ingestion.user.email ?? "no-email"
    }>`,
  );
  console.log(`  source documents: ${countSourceDocuments(input)}`);
  console.log(`  onboarding answers: ${countAnswers(input)}`);
  console.log(
    `  profile fields declared: ${input.ingestion.profileFields?.length ?? 0}`,
  );
  console.log(
    `  story seeds: ${input.storyMemory.story_seeds.length}  |  verified story ids requested: ${
      input.verifiedStoryIds?.length ?? 0
    }`,
  );
  console.log(
    `  voice anchor provided: ${input.storyMemory.voice_anchor_input ? "yes" : "no"}`,
  );
  console.log(`  attestation requested: ${input.attestation ? "yes" : "no"}`);
  console.log("");
}

function printEventTrace(events: readonly WorkflowEvent[]): void {
  const traces = traceWorkflowEvents(events);

  console.log("--- Workflow event trace ---");
  for (const trace of traces) {
    const extras: string[] = [`state=${trace.status}`];
    if (trace.storyDraftCount > 0) {
      extras.push(`stories=${trace.storyDraftCount}`);
    }
    if (trace.verifiedStoryCount > 0) {
      extras.push(`verified=${trace.verifiedStoryCount}`);
    }
    if (trace.voiceAnchorId) {
      extras.push(`voice_anchor=${trace.voiceAnchorId}`);
    }
    if (trace.attestedAt) {
      extras.push(`attested_at=${trace.attestedAt}`);
    }
    if (trace.completedAt) {
      extras.push(`completed_at=${trace.completedAt}`);
    }

    console.log(
      `  ${String(trace.index).padStart(2, "0")}. ${trace.eventName.padEnd(34)}  ${extras.join("  ")}`,
    );
  }
  console.log("");
}

function printFinalSummary(
  result: LocalOnboardingMemoryResult,
  input: LocalOnboardingMemoryInput,
): void {
  const completedEvent = result.emittedEvents.find(
    (event) => event.name === workflowEvents.onboardingComplete,
  );
  const voiceAnchor = result.workflowState.voiceAnchorId;
  const voiceAnchorStatus = result.voiceAnchorId
    ? "ready"
    : voiceAnchor
      ? "draft (not ready for writing)"
      : "missing";

  console.log("--- Final onboarding summary ---");
  console.log(`  user_id:                      ${result.userId}`);
  console.log(`  profile_revision_id:          ${result.revisionId}`);
  console.log(`  revision_status:              ${result.ingestion.revisionStatus}`);
  console.log(`  final_workflow_status:        ${result.workflowState.status}`);
  console.log("");
  console.log(`  source_documents_registered:  ${countSourceDocuments(input)}`);
  console.log(
    `    resume:                     ${result.workflowState.sourceDocuments.resume}`,
  );
  console.log(
    `    transcript:                 ${result.workflowState.sourceDocuments.transcript}`,
  );
  console.log(
    `    supplemental_material:      ${result.workflowState.sourceDocuments.supplementalMaterialCount}`,
  );
  console.log(
    `  onboarding_answers_ingested:  ${result.workflowState.answerCount}`,
  );
  console.log(`  profile_field_rows:           ${result.ingestion.profileFieldIds.length}`);
  console.log(`  attested_field_count:         ${result.workflowState.attestedFieldCount}`);
  console.log(`  stories_drafted:              ${result.stories.length}`);
  console.log(
    `  stories_verified:             ${result.workflowState.verifiedStoryCount}`,
  );
  console.log(`  voice_anchor_id:              ${voiceAnchor ?? "(none)"}`);
  console.log(`  voice_anchor_status:          ${voiceAnchorStatus}`);
  console.log(`  attested_at:                  ${result.workflowState.attestedAt ?? "(not attested)"}`);
  console.log(`  completed_at:                 ${result.workflowState.completedAt ?? "(not complete)"}`);
  console.log(
    `  onboarding.complete emitted:  ${completedEvent ? "yes" : "no"}`,
  );
  console.log(
    `  writing_grounding.ready:      ${result.writingGrounding.ready}  (required for downstream writing)`,
  );
  console.log("");

  if (completedEvent) {
    console.log(
      "onboarding.complete event payload:\n" +
        JSON.stringify(completedEvent.payload, null, 2)
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
    );
    console.log("");
  }

  console.log("--- Drafted stories ---");
  for (const story of result.stories) {
    const verifiedTag = story.verified_by_user ? "[verified]" : "[pending ]";
    console.log(`  ${verifiedTag} ${story.id}  ${story.title}`);
  }
  console.log("");
}

async function main(): Promise<void> {
  const fixturePath = resolveFixturePath();

  printHeader(fixturePath);

  resetLocalWorkflowClient();

  const input = loadFixture(fixturePath);
  printInputSummary(input);

  const result = await runLocalOnboardingMemoryFlow(input);

  printEventTrace(result.emittedEvents);
  printFinalSummary(result, input);

  const completed = result.emittedEvents.some(
    (event) => event.name === workflowEvents.onboardingComplete,
  );

  if (!completed) {
    console.error(
      "onboarding.complete was NOT emitted. Inspect the trace above for the missing gate.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "Done. The onboarding-memory slice ran end-to-end locally and emitted onboarding.complete.",
  );
}

main().catch((error) => {
  console.error("[run-onboarding] fatal error:", error);
  process.exit(1);
});
