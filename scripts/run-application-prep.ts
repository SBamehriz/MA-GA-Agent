import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ApplicationPacket,
  ApprovalItem,
} from "../packages/application";
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
  runLocalApplicationPrep,
  type LocalApplicationPrepResult,
} from "../packages/workflows/run-application-prep";
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
const DEFAULT_OUT_DIR = "out/application-prep";

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
  return JSON.parse(raw) as Omit<LocalResearchSweepInput, "userId" | "revisionId">;
}

function printHeader(
  onboardingPath: string,
  researchPath: string,
  outDir: string,
): void {
  console.log("================================================================");
  console.log(" MA-GA-Agent - local ApplicationPreparation + Approval harness");
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

function printWritingSummary(result: LocalWritingCycleResult): void {
  console.log("--- Writing phase ---");
  console.log(`  cycle_id:           ${result.cycleId}`);
  console.log(`  artifacts:          ${result.artifacts.length}`);
  console.log(`  ready:              ${result.totals.ready}`);
  console.log(
    `  needs_user_input:   ${result.totals.needsUserInput}`,
  );
  console.log(
    `  grounding_failed:   ${result.totals.groundingFailed}`,
  );
  console.log(`  style_failed:       ${result.totals.styleFailed}`);
  console.log("");
}

/**
 * HarnessSubagent — picks up to two evidence-rich programs and asks the
 * writing cycle to produce packets' worth of drafts for each. One primary
 * (core relevance + funding + named role) and one secondary (next-best
 * program, ideally adjacent relevance) so the prep cycle has to reason
 * across multiple programs, not just one.
 */
interface TargetPick {
  label: string;
  universityId: string;
  programId: string;
  fundingId: string | null;
  personRoleId: string | null;
  professionalProfileId: string | null;
}

function pickTargets(research: LocalResearchSweepResult): TargetPick[] {
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

  const picks: TargetPick[] = [];
  const seenUniversity = new Set<string>();

  for (const program of programs) {
    if (picks.length >= 2) break;
    if (program.relevanceClass === "rejected") continue;
    if (seenUniversity.has(program.universityId)) continue;
    seenUniversity.add(program.universityId);

    const role = [...research.personRoles]
      .filter((r) => r.universityId === program.universityId)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)[0];

    const funding = [...research.funding]
      .filter((f) => f.universityId === program.universityId)
      .sort((a, b) => b.confidence - a.confidence)[0];

    const profile = role
      ? research.professionalProfiles.find(
          (p) => p.personId === role.personId,
        ) ?? null
      : null;

    picks.push({
      label: picks.length === 0 ? "primary" : "secondary",
      universityId: program.universityId,
      programId: program.id,
      fundingId: funding?.id ?? null,
      personRoleId: role?.id ?? null,
      professionalProfileId: profile?.id ?? null,
    });
  }

  return picks;
}

function buildWritingPlanForTargets(
  targets: readonly TargetPick[],
): WritingDocumentRequest[] {
  const requests: WritingDocumentRequest[] = [];

  for (const target of targets) {
    const prefix = target.label;
    requests.push({
      id: `req_${prefix}_sop`,
      documentType: "sop",
      universityId: target.universityId,
      programId: target.programId,
      fundingId: target.fundingId,
      personRoleId: target.personRoleId,
      professionalProfileId: target.professionalProfileId,
    });
    requests.push({
      id: `req_${prefix}_resume_tailoring`,
      documentType: "resume_tailoring",
      universityId: target.universityId,
      programId: target.programId,
      personRoleId: target.personRoleId,
    });
    requests.push({
      id: `req_${prefix}_personal_statement`,
      documentType: "personal_statement",
      universityId: target.universityId,
      programId: target.programId,
    });
    if (target.fundingId) {
      requests.push({
        id: `req_${prefix}_cover_letter`,
        documentType: "cover_letter",
        universityId: target.universityId,
        programId: target.programId,
        fundingId: target.fundingId,
        personRoleId: target.personRoleId,
        professionalProfileId: target.professionalProfileId,
      });
    }
  }

  return requests;
}

function printAppPrepEventTrace(events: readonly WorkflowEvent[]): void {
  console.log("--- Application prep event trace ---");
  events.forEach((event, index) => {
    const idx = String(index + 1).padStart(2, "0");
    const name = event.name.padEnd(42);
    const payload = event.payload as unknown as Record<string, unknown>;
    const extras: string[] = [];

    if (typeof payload["programId"] === "string") {
      extras.push(`program=${payload["programId"]}`);
    }
    if (typeof payload["readiness"] === "string") {
      extras.push(`readiness=${payload["readiness"]}`);
    }
    if (typeof payload["totalItems"] === "number") {
      extras.push(
        `items=${payload["totalItems"]} ready=${payload["readyItems"]} warn=${payload["warningItems"]} miss=${payload["missingItems"]} user=${payload["userInputItems"]} def=${payload["deferredItems"]}`,
      );
    }
    if (typeof payload["approvalCount"] === "number") {
      extras.push(`approvals=${payload["approvalCount"]}`);
    }
    if (typeof payload["programCount"] === "number") {
      extras.push(
        `programs=${payload["programCount"]} artifacts=${payload["artifactCount"]}`,
      );
    }
    if (typeof payload["totalPackets"] === "number") {
      extras.push(
        `packets=${payload["totalPackets"]} ready=${payload["readyForReview"]} warn=${payload["readyWithWarnings"]} user=${payload["needsUserInput"]} blk=${payload["blocked"]} queue=${payload["totalApprovalItems"]}`,
      );
    }
    console.log(`  ${idx}. ${name}  ${extras.join("  ")}`);
  });
  console.log("");
}

function printPacketSummary(packet: ApplicationPacket): void {
  console.log(
    `--- Packet ${packet.target.program.title} @ ${packet.target.university.canonicalName} ---`,
  );
  console.log(`  packet_id:      ${packet.id}`);
  console.log(`  program_id:     ${packet.programId}`);
  console.log(
    `  funding_id:     ${packet.fundingId ?? "(none)"}  role=${packet.target.personRole?.id ?? "(none)"}`,
  );
  console.log(`  readiness:      ${packet.readiness.status}`);
  console.log(
    `  checklist:      total=${packet.readiness.totalItems}  ready=${packet.readiness.readyItems}  warn=${packet.readiness.warningItems}  miss=${packet.readiness.missingItems}  user=${packet.readiness.userInputItems}  def=${packet.readiness.deferredItems}`,
  );
  console.log(
    `  documents:      ${packet.documents.length}  (${packet.documents
      .map((d) => `${d.request.documentType}:${d.readiness}`)
      .join(", ") || "-"})`,
  );

  console.log("  checklist items:");
  for (const item of packet.checklist) {
    const req = item.required ? "required" : "optional";
    const origin = item.origin.replace("_default", "");
    const notes =
      item.notes.length > 0 ? `  # ${item.notes.join(" | ")}` : "";
    console.log(
      `    - [${item.status.padEnd(22)}] ${item.label.padEnd(44)} (${req}, ${origin})${notes}`,
    );
  }

  if (packet.readiness.blockers.length > 0) {
    console.log("  blockers:");
    for (const blocker of packet.readiness.blockers) {
      console.log(`    ! ${blocker}`);
    }
  }
  if (packet.readiness.warnings.length > 0) {
    console.log("  warnings:");
    for (const warning of packet.readiness.warnings.slice(0, 5)) {
      console.log(`    ~ ${warning}`);
    }
    if (packet.readiness.warnings.length > 5) {
      console.log(
        `    … ${packet.readiness.warnings.length - 5} more (see saved packet)`,
      );
    }
  }
  console.log("");
}

function printApprovalQueue(items: readonly ApprovalItem[]): void {
  console.log(`--- Approval queue (${items.length} pending) ---`);
  if (items.length === 0) {
    console.log("  (no items enqueued)");
    console.log("");
    return;
  }

  const groups = new Map<string, ApprovalItem[]>();
  for (const item of items) {
    const bucket = groups.get(item.actionType) ?? [];
    bucket.push(item);
    groups.set(item.actionType, bucket);
  }

  for (const [actionType, bucket] of groups) {
    console.log(`  [${actionType}] ${bucket.length}`);
    for (const item of bucket) {
      const artifact = item.artifactKind ? ` artifact=${item.artifactKind}` : "";
      const evidence = item.evidence?.exampleQuotes[0]
        ? ` ev="${item.evidence.exampleQuotes[0].slice(0, 80)}"`
        : "";
      const grounding = item.grounding
        ? ` support=${item.grounding.supportedClaims}/${item.grounding.verifiableClaims}${item.grounding.passed ? "" : "!"}`
        : "";
      console.log(
        `    - ${item.id.padEnd(48)} default=${item.defaultAction.padEnd(7)} program=${item.programId}${artifact}${grounding}${evidence}`,
      );
      console.log(`        reason:  ${item.reason}`);
      console.log(`        action:  ${item.actionRequired}`);
    }
  }
  console.log("");
}

function saveArtifacts(
  cycle: LocalApplicationPrepResult,
  outDir: string,
): string[] {
  mkdirSync(outDir, { recursive: true });
  const saved: string[] = [];

  for (const packet of cycle.packets) {
    const safeId = packet.programId.replace(/[^a-z0-9_-]/gi, "_");
    const packetPath = resolve(outDir, `packet__${safeId}.json`);
    writeFileSync(packetPath, JSON.stringify(packet, null, 2), "utf8");
    saved.push(packetPath);

    const mdPath = resolve(outDir, `packet__${safeId}.md`);
    const header = [
      `# Packet — ${packet.target.program.title} @ ${packet.target.university.canonicalName}`,
      "",
      `- packet_id: ${packet.id}`,
      `- program_id: ${packet.programId}`,
      `- university_id: ${packet.universityId}`,
      `- funding_id: ${packet.fundingId ?? "(none)"}`,
      `- readiness: ${packet.readiness.status}`,
      "",
      "## Checklist",
      "",
      ...packet.checklist.map((item) => {
        const req = item.required ? "required" : "optional";
        const notes =
          item.notes.length > 0 ? ` — ${item.notes.join(" | ")}` : "";
        return `- [${item.status}] **${item.label}** (${req})${notes}`;
      }),
      "",
      "## Documents",
      "",
      ...packet.documents.map(
        (doc) =>
          `- ${doc.request.documentType}: readiness=${doc.readiness} — ${doc.draft.title}`,
      ),
      "",
    ].join("\n");
    writeFileSync(mdPath, header, "utf8");
    saved.push(mdPath);
  }

  const approvalsPath = resolve(outDir, "approval-queue.json");
  writeFileSync(
    approvalsPath,
    JSON.stringify(cycle.approvalQueue, null, 2),
    "utf8",
  );
  saved.push(approvalsPath);

  return saved;
}

function printCycleSummary(
  cycle: LocalApplicationPrepResult,
  savedFiles: string[],
): void {
  const complete = cycle.emittedEvents.some(
    (e) => e.name === workflowEvents.applicationPrepComplete,
  );
  console.log("--- Application prep cycle summary ---");
  console.log(`  cycle_id:                ${cycle.cycleId}`);
  console.log(`  packets:                 ${cycle.packets.length}`);
  console.log(`    ready_for_review:      ${cycle.totals.readyForReview}`);
  console.log(`    ready_with_warnings:   ${cycle.totals.readyWithWarnings}`);
  console.log(`    needs_user_input:      ${cycle.totals.needsUserInput}`);
  console.log(`    blocked:               ${cycle.totals.blocked}`);
  console.log(`  approval_queue_total:    ${cycle.approvalQueue.length}`);
  console.log(
    `    approve_draft:         ${cycle.queueTotals.approve_draft}`,
  );
  console.log(
    `    edit_required:         ${cycle.queueTotals.edit_required}`,
  );
  console.log(
    `    missing_input:         ${cycle.queueTotals.missing_input}`,
  );
  console.log(
    `    ready_for_submission:  ${cycle.queueTotals.ready_for_submission}`,
  );
  console.log(`  files_saved:             ${savedFiles.length}`);
  console.log(
    `  application.prep.complete emitted: ${complete ? "yes" : "no"}`,
  );
  if (cycle.notes.length > 0) {
    console.log("  notes:");
    for (const note of cycle.notes) {
      console.log(`    - ${note}`);
    }
  }
  console.log("");
}

function printIntegrationAudit(
  writing: LocalWritingCycleResult,
  cycle: LocalApplicationPrepResult,
): number {
  console.log("--- Integration audit: application prep ---");

  let groundedArtifacts = 0;
  let artifactsReferencedByPackets = 0;
  const referencedArtifactIds = new Set<string>();
  for (const packet of cycle.packets) {
    for (const doc of packet.documents) {
      referencedArtifactIds.add(doc.request.id);
      if (doc.grounding.passed) groundedArtifacts += 1;
      artifactsReferencedByPackets += 1;
    }
  }

  const writingArtifactTotal = writing.artifacts.length;
  const writingArtifactsAllGrounded = writing.artifacts.every(
    (a) => a.grounding.passed,
  );

  let approvalsWithArtifactReference = 0;
  let approvalsWithGroundingSummary = 0;
  let approvalsSideEffecty = 0;
  const sideEffectActions = new Set([
    "submit_application",
    "pay_fee",
    "send_email",
    "send_linkedin_msg",
    "approve_outreach",
  ]);
  for (const item of cycle.approvalQueue) {
    if (item.artifactId) approvalsWithArtifactReference += 1;
    if (item.grounding) approvalsWithGroundingSummary += 1;
    if (sideEffectActions.has(item.actionType)) approvalsSideEffecty += 1;
  }

  console.log(
    `  writing_artifacts_produced:        ${writingArtifactTotal}`,
  );
  console.log(
    `  writing_artifacts_all_grounded:    ${writingArtifactsAllGrounded ? "yes" : "no"}`,
  );
  console.log(
    `  artifacts_referenced_by_packets:   ${artifactsReferencedByPackets}`,
  );
  console.log(
    `  distinct_artifact_refs_in_packets: ${referencedArtifactIds.size}`,
  );
  console.log(
    `  packet_docs_grounding_passed:      ${groundedArtifacts}/${artifactsReferencedByPackets}`,
  );
  console.log(
    `  approvals_with_artifact_ref:       ${approvalsWithArtifactReference}`,
  );
  console.log(
    `  approvals_with_grounding_summary:  ${approvalsWithGroundingSummary}`,
  );
  console.log(
    `  approvals_with_side_effects:       ${approvalsSideEffecty}`,
  );

  let failures = 0;
  if (!writingArtifactsAllGrounded) failures += 1;
  if (groundedArtifacts !== artifactsReferencedByPackets) failures += 1;
  if (approvalsSideEffecty !== 0) failures += 1;

  if (failures === 0) {
    console.log(
      "  result: OK — every packet document is grounded, every writing artifact the packets consume is grounded, and no side-effect approvals were emitted (CLAUDE.md §8 invariants 1–3).",
    );
  } else {
    console.log(
      `  result: FAIL — ${failures} audit check(s) did not pass.`,
    );
  }
  console.log("");
  return failures;
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
    console.error("onboarding.complete was NOT emitted — aborting harness.");
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

  const targets = pickTargets(researchResult);
  if (targets.length === 0) {
    console.error(
      "Application prep harness: no viable target programs in the research sweep.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("--- Targets (harness-selected) ---");
  for (const target of targets) {
    console.log(
      `  [${target.label}] program=${target.programId}  funding=${target.fundingId ?? "-"}  role=${target.personRoleId ?? "-"}`,
    );
  }
  console.log("");

  const writingPlan = buildWritingPlanForTargets(targets);
  const writingResult = await runLocalWritingCycle({
    userId: onboardingResult.userId,
    revisionId: onboardingResult.revisionId,
    requests: writingPlan,
  });
  printWritingSummary(writingResult);

  const appPrep = await runLocalApplicationPrep({
    userId: onboardingResult.userId,
    revisionId: onboardingResult.revisionId,
    writingArtifacts: writingResult.artifacts as readonly WritingArtifact[],
    programIds: targets.map((target) => target.programId),
  });

  printAppPrepEventTrace(appPrep.emittedEvents);
  for (const packet of appPrep.packets) {
    printPacketSummary(packet);
  }
  printApprovalQueue(appPrep.approvalQueue);

  const savedFiles = saveArtifacts(appPrep, outDir);
  printCycleSummary(appPrep, savedFiles);
  const failures = printIntegrationAudit(writingResult, appPrep);

  const prepComplete = appPrep.emittedEvents.some(
    (e) => e.name === workflowEvents.applicationPrepComplete,
  );
  if (!prepComplete) {
    console.error(
      "application.prep.complete was NOT emitted. Inspect the trace above.",
    );
    process.exitCode = 1;
    return;
  }
  if (failures > 0) {
    console.error(
      `Application prep integration audit FAILED — ${failures} check(s) did not pass.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Done. Application prep ran end-to-end, produced ${appPrep.packets.length} packet(s), and enqueued ${appPrep.approvalQueue.length} approval item(s).`,
  );
  console.log(`  artifacts saved under: ${outDir}`);
}

main().catch((error) => {
  console.error("[run-application-prep] fatal error:", error);
  process.exit(1);
});
