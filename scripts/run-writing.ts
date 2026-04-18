import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  runLocalResearchSweep,
  type LocalResearchSweepInput,
  type LocalResearchSweepResult,
} from "../packages/workflows/run-research-sweep";
import {
  runLocalWritingCycle,
  type LocalWritingCycleResult,
} from "../packages/workflows/run-writing";
import type {
  WritingArtifact,
  WritingDocumentRequest,
} from "../packages/writing/types";

const DEFAULT_ONBOARDING_FIXTURE = "fixtures/seeds/onboarding-sample.json";
const DEFAULT_RESEARCH_FIXTURE = "fixtures/seeds/research-seed.json";
const DEFAULT_OUT_DIR = "out/writing";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function argOrDefault(index: number, fallback: string): string {
  const explicit = process.argv[index];
  return resolve(repoRoot(), explicit ?? fallback);
}

function loadOnboardingFixture(path: string): LocalOnboardingMemoryInput {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as LocalOnboardingMemoryInput;
}

function loadResearchFixture(
  path: string,
): Omit<LocalResearchSweepInput, "userId" | "revisionId"> {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as Omit<
    LocalResearchSweepInput,
    "userId" | "revisionId"
  >;
}

function printHeader(
  onboardingPath: string,
  researchPath: string,
  outDir: string,
): void {
  console.log("================================================================");
  console.log(" MA-GA-Agent - local WritingAgent harness");
  console.log("================================================================");
  console.log(` onboarding fixture: ${onboardingPath}`);
  console.log(` research fixture:   ${researchPath}`);
  console.log(` output directory:   ${outDir}`);
  console.log("");
}

function printOnboardingSummary(result: LocalOnboardingMemoryResult): void {
  const completed = result.emittedEvents.some(
    (e) => e.name === workflowEvents.onboardingComplete,
  );
  console.log("--- Onboarding phase ---");
  console.log(`  user_id:             ${result.userId}`);
  console.log(`  profile_revision_id: ${result.revisionId}`);
  console.log(`  onboarding.complete: ${completed ? "emitted" : "NOT emitted"}`);
  console.log(`  stories_verified:    ${result.workflowState.verifiedStoryCount}`);
  console.log(
    `  voice_anchor_id:     ${result.workflowState.voiceAnchorId ?? "(none)"}`,
  );
  console.log("");
}

function printResearchSummary(result: LocalResearchSweepResult): void {
  console.log("--- Research sweep phase ---");
  console.log(`  cycle_id:           ${result.cycleId}`);
  console.log(`  universities:       ${result.universities.length}`);
  console.log(`  programs:           ${result.programs.length}`);
  console.log(`  funding:            ${result.funding.length}`);
  console.log(`  contact_roles:      ${result.personRoles.length}`);
  console.log(
    `  prof_profiles:      ${result.professionalProfiles.length}`,
  );
  console.log("");
}

/**
 * Build a demonstration writing plan using the first qualified/core program
 * with the strongest person_role + funding attachments. This is the
 * HarnessSubagent's job — in a real run the user picks targets. Here we pick
 * the "most typable" ones: core relevance, highest fit, a named contact, and
 * a funding opportunity if one is attached to the same university.
 */
function selectPrimaryTarget(research: LocalResearchSweepResult): {
  universityId: string;
  programId: string;
  fundingId: string | null;
  personRoleId: string | null;
  professionalProfileId: string | null;
} | null {
  const programs = [...research.programs].sort((a, b) => {
    const relWeight = (rel: string): number => {
      switch (rel) {
        case "core":
          return 4;
        case "adjacent":
          return 3;
        case "tangential":
          return 2;
        default:
          return 1;
      }
    };
    const relDelta = relWeight(b.relevanceClass) - relWeight(a.relevanceClass);
    if (relDelta !== 0) return relDelta;
    return b.fitScore - a.fitScore;
  });

  const primaryProgram = programs[0];
  if (!primaryProgram) return null;

  const primaryRole = [...research.personRoles]
    .filter((r) => r.universityId === primaryProgram.universityId)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)[0];

  const primaryFunding = [...research.funding]
    .filter((f) => f.universityId === primaryProgram.universityId)
    .sort((a, b) => b.confidence - a.confidence)[0];

  const primaryProfile = primaryRole
    ? research.professionalProfiles.find(
        (p) => p.personId === primaryRole.personId,
      ) ?? null
    : null;

  return {
    universityId: primaryProgram.universityId,
    programId: primaryProgram.id,
    fundingId: primaryFunding?.id ?? null,
    personRoleId: primaryRole?.id ?? null,
    professionalProfileId: primaryProfile?.id ?? null,
  };
}

function buildWritingPlan(
  research: LocalResearchSweepResult,
): WritingDocumentRequest[] {
  const primary = selectPrimaryTarget(research);
  if (!primary) {
    return [];
  }

  const requests: WritingDocumentRequest[] = [
    {
      id: "req_sop_primary",
      documentType: "sop",
      universityId: primary.universityId,
      programId: primary.programId,
      fundingId: primary.fundingId,
      personRoleId: primary.personRoleId,
      professionalProfileId: primary.professionalProfileId,
    },
    {
      id: "req_short_answer_research_experience",
      documentType: "short_answer",
      universityId: primary.universityId,
      programId: primary.programId,
      prompt:
        "In 150 words, describe a research problem you scoped end-to-end and what you would want to keep working on in this program.",
      wordLimit: 150,
    },
    {
      id: "req_cover_letter_funding",
      documentType: "cover_letter",
      universityId: primary.universityId,
      programId: primary.programId,
      fundingId: primary.fundingId,
      personRoleId: primary.personRoleId,
      professionalProfileId: primary.professionalProfileId,
    },
    {
      id: "req_resume_tailoring_primary",
      documentType: "resume_tailoring",
      universityId: primary.universityId,
      programId: primary.programId,
      personRoleId: primary.personRoleId,
    },
    {
      id: "req_personal_statement_primary",
      documentType: "personal_statement",
      universityId: primary.universityId,
      programId: primary.programId,
    },
    {
      id: "req_outreach_primary",
      documentType: "outreach_message",
      universityId: primary.universityId,
      programId: primary.programId,
      personRoleId: primary.personRoleId,
      professionalProfileId: primary.professionalProfileId,
    },
  ];

  return requests;
}

function printWritingEventTrace(events: readonly WorkflowEvent[]): void {
  console.log("--- Writing cycle event trace ---");
  events.forEach((event, index) => {
    const idx = String(index + 1).padStart(2, "0");
    const name = event.name.padEnd(34);
    const payload = event.payload as unknown as Record<string, unknown>;
    const extras: string[] = [];

    if (typeof payload["requestId"] === "string") {
      extras.push(`req=${payload["requestId"]}`);
    }
    if (typeof payload["documentType"] === "string") {
      extras.push(`doc=${payload["documentType"]}`);
    }
    if (typeof payload["wordCount"] === "number") {
      extras.push(
        `words=${payload["wordCount"]} claims=${payload["claimCount"]}/${payload["verifiableClaimCount"]}v`,
      );
    }
    if (typeof payload["supportedClaims"] === "number") {
      extras.push(
        `supported=${payload["supportedClaims"]} unsupported=${payload["unsupportedClaims"]} pass=${payload["passed"]}`,
      );
    }
    if (typeof payload["noteCount"] === "number") {
      extras.push(
        `notes=${payload["noteCount"]} block=${payload["blockerCount"]}`,
      );
    }
    if (
      typeof payload["passed"] === "boolean" &&
      typeof payload["sentenceLengthDelta"] === "number"
    ) {
      extras.push(
        `style_pass=${payload["passed"]} dsent=${payload["sentenceLengthDelta"]} fp=${payload["firstPersonRatio"]}`,
      );
    }
    if (typeof payload["readiness"] === "string") {
      extras.push(`readiness=${payload["readiness"]}`);
    }
    if (typeof payload["readyCount"] === "number") {
      extras.push(
        `ready=${payload["readyCount"]} user=${payload["needsUserInputCount"]} grd=${payload["groundingFailedCount"]} sty=${payload["styleFailedCount"]}`,
      );
    }

    console.log(`  ${idx}. ${name}  ${extras.join("  ")}`);
  });
  console.log("");
}

function printArtifactSummary(artifact: WritingArtifact): void {
  console.log(
    `--- ${artifact.draft.title}  [${artifact.request.documentType}] ---`,
  );
  console.log(`  readiness:           ${artifact.readiness}`);
  console.log(
    `  draft:               ${artifact.draft.wordCount} words, ${artifact.draft.claimCount} claims (${artifact.draft.verifiableClaimCount} verifiable)`,
  );
  console.log(
    `  grounding:           supported=${artifact.grounding.supportedClaims} unsupported=${artifact.grounding.unsupportedClaims.length} pass=${artifact.grounding.passed}`,
  );
  console.log(
    `  style:               pass=${artifact.style.passed} Δsent=${artifact.style.sentenceLengthDelta} fp_ratio=${artifact.style.firstPersonRatio}`,
  );
  console.log(
    `  critic:              notes=${artifact.critic.notes.length} blockers=${
      artifact.critic.notes.filter((note) => note.severity === "block").length
    }`,
  );
  const usage = artifact.usageSummary;
  console.log(
    `  used profile_keys:   ${usage.profileFieldKeys.join(", ") || "(none)"}`,
  );
  console.log(
    `  used stories:        ${usage.verifiedStoryIds.length} (${usage.verifiedStoryIds.join(", ") || "-"})`,
  );
  console.log(
    `  used programs:       ${usage.programIds.length}  funding=${usage.fundingIds.length}  roles=${usage.personRoleIds.length}  unis=${usage.universityIds.length}  profiles=${usage.professionalProfileIds.length}`,
  );

  if (artifact.rejectionReasons.length > 0) {
    console.log("  rejection reasons:");
    for (const reason of artifact.rejectionReasons.slice(0, 5)) {
      console.log(`    - ${reason}`);
    }
    if (artifact.rejectionReasons.length > 5) {
      console.log(
        `    … ${artifact.rejectionReasons.length - 5} more (see saved artifact)`,
      );
    }
  }

  const preview =
    artifact.draft.text.length > 320
      ? `${artifact.draft.text.slice(0, 320).replace(/\s+/g, " ")}…`
      : artifact.draft.text;
  console.log("  preview:");
  console.log(`    ${preview}`);
  console.log("");
}

function saveArtifacts(
  cycle: LocalWritingCycleResult,
  outDir: string,
): string[] {
  mkdirSync(outDir, { recursive: true });
  const saved: string[] = [];

  for (const artifact of cycle.artifacts) {
    const baseName = `${artifact.request.id}__${artifact.request.documentType}`;
    const mdPath = resolve(outDir, `${baseName}.md`);
    const jsonPath = resolve(outDir, `${baseName}.json`);

    const header = [
      `# ${artifact.draft.title}`,
      "",
      `- document_type: ${artifact.request.documentType}`,
      `- readiness: ${artifact.readiness}`,
      `- word_count: ${artifact.draft.wordCount}`,
      `- claims: ${artifact.draft.claimCount} (${artifact.draft.verifiableClaimCount} verifiable)`,
      `- grounding: supported=${artifact.grounding.supportedClaims} unsupported=${artifact.grounding.unsupportedClaims.length} pass=${artifact.grounding.passed}`,
      `- style: pass=${artifact.style.passed} Δsent=${artifact.style.sentenceLengthDelta}`,
      "",
      "---",
      "",
      artifact.draft.text,
      "",
    ].join("\n");

    writeFileSync(mdPath, header, "utf8");
    writeFileSync(jsonPath, JSON.stringify(artifact, null, 2), "utf8");
    saved.push(mdPath);
    saved.push(jsonPath);
  }

  return saved;
}

function printCycleSummary(
  cycle: LocalWritingCycleResult,
  savedFiles: string[],
): void {
  const complete = cycle.emittedEvents.some(
    (e) => e.name === workflowEvents.writingCycleComplete,
  );
  console.log("--- Writing cycle summary ---");
  console.log(`  cycle_id:             ${cycle.cycleId}`);
  console.log(`  artifacts:            ${cycle.artifacts.length}`);
  console.log(`  ready:                ${cycle.totals.ready}`);
  console.log(`  needs_user_input:     ${cycle.totals.needsUserInput}`);
  console.log(`  grounding_failed:     ${cycle.totals.groundingFailed}`);
  console.log(`  style_failed:         ${cycle.totals.styleFailed}`);
  console.log(`  missing_inputs:       ${cycle.totals.missingInputs}`);
  console.log(`  files_saved:          ${savedFiles.length}`);
  console.log(
    `  writing.cycle.complete emitted: ${complete ? "yes" : "no"}`,
  );
  if (cycle.notes.length > 0) {
    console.log("  notes:");
    for (const note of cycle.notes) {
      console.log(`    - ${note}`);
    }
  }
  console.log("");
}

function printGroundingAudit(cycle: LocalWritingCycleResult): number {
  console.log("--- Integration audit: writing grounding ---");

  let totalVerifiable = 0;
  let totalSupported = 0;
  let totalUnsupported = 0;
  for (const artifact of cycle.artifacts) {
    totalVerifiable += artifact.grounding.verifiableClaims;
    totalSupported += artifact.grounding.supportedClaims;
    totalUnsupported += artifact.grounding.unsupportedClaims.length;
  }

  console.log(`  total_verifiable_claims:  ${totalVerifiable}`);
  console.log(`  total_supported_claims:   ${totalSupported}`);
  console.log(`  total_unsupported_claims: ${totalUnsupported}`);

  if (totalUnsupported > 0) {
    console.log(
      "  result: FAIL — one or more drafts contain claims without DB-resolvable evidence.",
    );
  } else {
    console.log(
      "  result: OK — every verifiable claim resolves to an attested field, verified story, or evidence-backed external row.",
    );
  }
  console.log("");

  return totalUnsupported;
}

async function main(): Promise<void> {
  const onboardingPath = argOrDefault(2, DEFAULT_ONBOARDING_FIXTURE);
  const researchPath = argOrDefault(3, DEFAULT_RESEARCH_FIXTURE);
  const outDir = resolve(repoRoot(), DEFAULT_OUT_DIR);

  printHeader(onboardingPath, researchPath, outDir);

  resetLocalWorkflowClient();

  const onboardingInput = loadOnboardingFixture(onboardingPath);
  const onboardingResult = await runLocalOnboardingMemoryFlow(onboardingInput);
  printOnboardingSummary(onboardingResult);

  const onboardingComplete = onboardingResult.emittedEvents.some(
    (e) => e.name === workflowEvents.onboardingComplete,
  );
  if (!onboardingComplete) {
    console.error(
      "onboarding.complete was NOT emitted — aborting writing harness.",
    );
    process.exitCode = 1;
    return;
  }

  const researchFixture = loadResearchFixture(researchPath);
  const researchInput: LocalResearchSweepInput = {
    ...researchFixture,
    userId: onboardingResult.userId,
    revisionId: onboardingResult.revisionId,
  };

  const researchResult = await runLocalResearchSweep(researchInput);
  printResearchSummary(researchResult);

  const sweepComplete = researchResult.emittedEvents.some(
    (e) => e.name === workflowEvents.researchCycleComplete,
  );
  if (!sweepComplete) {
    console.error(
      "research.cycle.complete was NOT emitted — aborting writing harness.",
    );
    process.exitCode = 1;
    return;
  }

  const plan = buildWritingPlan(researchResult);
  if (plan.length === 0) {
    console.error(
      "Writing harness: could not build a writing plan — no qualified program in the research sweep.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("--- Writing plan (harness-selected) ---");
  for (const req of plan) {
    console.log(
      `  ${req.id.padEnd(40)}  type=${req.documentType.padEnd(18)}  program=${req.programId}  funding=${req.fundingId ?? "-"}  role=${req.personRoleId ?? "-"}`,
    );
  }
  console.log("");

  const cycle = await runLocalWritingCycle({
    userId: onboardingResult.userId,
    revisionId: onboardingResult.revisionId,
    requests: plan,
  });

  printWritingEventTrace(cycle.emittedEvents);
  for (const artifact of cycle.artifacts) {
    printArtifactSummary(artifact);
  }

  const savedFiles = saveArtifacts(cycle, outDir);
  printCycleSummary(cycle, savedFiles);
  const unsupportedCount = printGroundingAudit(cycle);

  const writingComplete = cycle.emittedEvents.some(
    (e) => e.name === workflowEvents.writingCycleComplete,
  );
  if (!writingComplete) {
    console.error(
      "writing.cycle.complete was NOT emitted. Inspect the trace above.",
    );
    process.exitCode = 1;
    return;
  }

  if (unsupportedCount > 0) {
    console.error(
      `Writing integration audit FAILED — ${unsupportedCount} unsupported claim(s) across drafts.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Done. The writing slice ran end-to-end locally, produced ${cycle.artifacts.length} drafts, and emitted writing.cycle.complete.`,
  );
  console.log(`  artifacts saved under: ${outDir}`);
}

main().catch((error) => {
  console.error("[run-writing] fatal error:", error);
  process.exit(1);
});
