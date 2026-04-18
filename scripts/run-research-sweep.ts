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
  runLocalResearchSweep,
  type LocalResearchSweepInput,
  type LocalResearchSweepResult,
} from "../packages/workflows/run-research-sweep";
import {
  auditEvidenceBindings,
  type AuditMissingEvidenceReport,
  type EvidenceAuditInput,
} from "../packages/evidence/validator";

const DEFAULT_ONBOARDING_FIXTURE = "fixtures/seeds/onboarding-sample.json";
const DEFAULT_RESEARCH_FIXTURE = "fixtures/seeds/research-seed.json";

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

function printHeader(onboardingPath: string, researchPath: string): void {
  console.log("================================================================");
  console.log(" MA-GA-Agent - local research-sweep harness");
  console.log("================================================================");
  console.log(` onboarding fixture: ${onboardingPath}`);
  console.log(` research fixture:   ${researchPath}`);
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
  console.log(`  voice_anchor_id:     ${result.workflowState.voiceAnchorId ?? "(none)"}`);
  console.log("");
}

function printResearchEventTrace(events: readonly WorkflowEvent[]): void {
  console.log("--- Research sweep event trace ---");
  events.forEach((event, index) => {
    const idx = String(index + 1).padStart(2, "0");
    const name = event.name.padEnd(40);
    const payload = event.payload as unknown as Record<string, unknown>;

    const extras: string[] = [];
    if (typeof payload["cycleId"] === "string") {
      extras.push(`cycle=${String(payload["cycleId"]).slice(0, 14)}…`);
    }
    if (typeof payload["universityId"] === "string") {
      extras.push(`uni=${String(payload["universityId"]).slice(0, 14)}…`);
    }
    if (typeof payload["acceptedCount"] === "number") {
      extras.push(
        `accepted=${payload["acceptedCount"]}/${payload["consideredCount"] ?? "?"}`,
      );
    }
    if (
      typeof payload["programCount"] === "number" &&
      typeof payload["coreCount"] === "number"
    ) {
      extras.push(
        `programs=${payload["programCount"]} core=${payload["coreCount"]}`,
      );
    } else if (typeof payload["programCount"] === "number") {
      extras.push(`programs=${payload["programCount"]}`);
    }
    if (typeof payload["opportunityCount"] === "number") {
      extras.push(
        `funding=${payload["opportunityCount"]} unclear=${payload["unclearCount"]}`,
      );
    }
    if (typeof payload["personRoleCount"] === "number") {
      extras.push(`contacts=${payload["personRoleCount"]}`);
    }
    if (typeof payload["profilesPersisted"] === "number") {
      extras.push(
        `profiles=${payload["profilesPersisted"]} skipped=${payload["profilesSkipped"]}`,
      );
    }

    console.log(`  ${idx}. ${name}  ${extras.join("  ")}`);
  });
  console.log("");
}

function printDiscoveryTables(result: LocalResearchSweepResult): void {
  console.log("--- Universities persisted ---");
  for (const uni of result.universities) {
    console.log(
      `  ${uni.id}  ${uni.canonicalName.padEnd(40)}  ${uni.primaryDomain.padEnd(18)}  ${uni.country}/${uni.state ?? "-"}  evidence=${uni.evidenceIds.length}`,
    );
  }
  console.log("");

  console.log("--- Programs persisted ---");
  for (const prog of result.programs) {
    console.log(
      `  ${prog.id}  ${prog.title.padEnd(55)}  rel=${prog.relevanceClass.padEnd(10)} fit=${prog.fitScore.toFixed(2)}  evidence=${prog.evidenceIds.length}`,
    );
  }
  console.log("");

  console.log("--- Funding opportunities persisted ---");
  for (const fund of result.funding) {
    const stipend = fund.stipendAmount
      ? `$${fund.stipendAmount}/${fund.stipendPeriod}`
      : "no-stipend";
    console.log(
      `  ${fund.id}  ${fund.title.padEnd(55)}  class=${fund.fundingClass.padEnd(26)} cov=${fund.tuitionCoverage.padEnd(8)} ${stipend}  conf=${fund.confidence.toFixed(2)}  evidence=${fund.evidenceIds.length}`,
    );
  }
  console.log("");

  console.log("--- Contacts persisted (person_role) ---");
  for (const role of result.personRoles) {
    const person = result.persons.find((p) => p.id === role.personId);
    const name = person?.canonicalName ?? "(unknown)";
    console.log(
      `  ${role.id}  ${name.padEnd(26)}  role=${role.roleTag.padEnd(12)} title="${role.roleTitle}"  rel=${role.relevanceScore.toFixed(2)}  evidence=${role.evidenceIds.length}`,
    );
  }
  console.log("");

  console.log("--- Professional profiles (enrichment) ---");
  for (const profile of result.professionalProfiles) {
    const person = result.persons.find((p) => p.id === profile.personId);
    const name = person?.canonicalName ?? "(unknown)";
    console.log(
      `  ${profile.id}  ${name.padEnd(26)}  type=${profile.type.padEnd(12)} provider=${profile.provider.padEnd(22)} conf=${profile.confidence.toFixed(2)}  evidence=${profile.evidenceIds.length}`,
    );
  }
  console.log("");
}

function collectAuditEntries(
  result: LocalResearchSweepResult,
): EvidenceAuditInput[] {
  const entries: EvidenceAuditInput[] = [];

  for (const row of result.universities) {
    entries.push({
      subjectType: "university",
      subjectId: row.id,
      title: row.canonicalName,
      evidenceIds: row.evidenceIds,
    });
  }
  for (const row of result.programs) {
    entries.push({
      subjectType: "graduate_program",
      subjectId: row.id,
      title: row.title,
      evidenceIds: row.evidenceIds,
    });
  }
  for (const row of result.funding) {
    entries.push({
      subjectType: "funding_opportunity",
      subjectId: row.id,
      title: row.title,
      evidenceIds: row.evidenceIds,
    });
  }
  for (const row of result.personRoles) {
    entries.push({
      subjectType: "person_role",
      subjectId: row.id,
      title: row.roleTitle,
      evidenceIds: row.evidenceIds,
    });
  }
  for (const row of result.professionalProfiles) {
    entries.push({
      subjectType: "professional_profile",
      subjectId: row.id,
      title: row.url,
      evidenceIds: row.evidenceIds,
    });
  }

  return entries;
}

function printIntegrationAudit(
  result: LocalResearchSweepResult,
): AuditMissingEvidenceReport[] {
  const entries = collectAuditEntries(result);
  const violations = auditEvidenceBindings(entries);

  console.log("--- Integration audit: evidence coverage ---");
  console.log(`  subjects_audited:      ${entries.length}`);
  console.log(`  evidence_violations:   ${violations.length}`);

  if (violations.length > 0) {
    for (const v of violations) {
      console.log(
        `   ! ${v.subjectType}:${v.subjectId} ("${v.title}") — ${v.reason}`,
      );
    }
  } else {
    console.log(
      "  result: OK — every external-world row resolves to at least one matching evidence row.",
    );
  }
  console.log("");

  return violations;
}

function printFinalSummary(result: LocalResearchSweepResult): void {
  console.log("--- Research cycle summary ---");
  console.log(`  cycle_id:         ${result.cycleId}`);
  console.log(`  status:           ${result.cycleRecord.status}`);
  console.log(`  started_at:       ${result.cycleRecord.startedAt}`);
  console.log(`  completed_at:     ${result.cycleRecord.completedAt ?? "(not complete)"}`);
  console.log(`  filters_hash:     ${result.cycleRecord.filtersHash}`);
  console.log(`  universities:     ${result.cycleRecord.universityCount}`);
  console.log(`  programs:         ${result.cycleRecord.programCount}`);
  console.log(`  funding:          ${result.cycleRecord.fundingCount}`);
  console.log(`  contact_roles:    ${result.cycleRecord.contactCount}`);
  console.log(
    `  total_db_profiles:${result.professionalProfiles.length} (enriched+skipped rolls up in event trace)`,
  );
  console.log("");

  const complete = result.emittedEvents.some(
    (e) => e.name === workflowEvents.researchCycleComplete,
  );
  console.log(
    `  research.cycle.complete emitted: ${complete ? "yes" : "no"}`,
  );
  console.log("");
}

async function main(): Promise<void> {
  const onboardingPath = argOrDefault(2, DEFAULT_ONBOARDING_FIXTURE);
  const researchPath = argOrDefault(3, DEFAULT_RESEARCH_FIXTURE);

  printHeader(onboardingPath, researchPath);

  resetLocalWorkflowClient();

  const onboardingInput = loadOnboardingFixture(onboardingPath);
  const onboardingResult = await runLocalOnboardingMemoryFlow(onboardingInput);
  printOnboardingSummary(onboardingResult);

  const onboardingComplete = onboardingResult.emittedEvents.some(
    (e) => e.name === workflowEvents.onboardingComplete,
  );
  if (!onboardingComplete) {
    console.error(
      "onboarding.complete was NOT emitted — aborting research sweep (the sweep requires a completed onboarding state).",
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

  printResearchEventTrace(researchResult.emittedEvents);
  printDiscoveryTables(researchResult);
  printFinalSummary(researchResult);
  const violations = printIntegrationAudit(researchResult);

  const sweepComplete = researchResult.emittedEvents.some(
    (e) => e.name === workflowEvents.researchCycleComplete,
  );
  if (!sweepComplete) {
    console.error(
      "research.cycle.complete was NOT emitted. Inspect the trace above for the missing gate.",
    );
    process.exitCode = 1;
    return;
  }

  if (violations.length > 0) {
    console.error(
      `Integration audit FAILED — ${violations.length} external-world row(s) missing valid evidence bindings.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "Done. The research sweep ran end-to-end locally and emitted research.cycle.complete.",
  );
}

main().catch((error) => {
  console.error("[run-research-sweep] fatal error:", error);
  process.exit(1);
});
