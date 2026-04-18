import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  listActionableApprovals,
  resolveApproval,
  resumeApplication,
  type ApprovalResolutionResult
} from "../packages/approvals";
import { applicationArtifactQueries, applicationQueries } from "../packages/db/queries/application";
import { approvalQueries } from "../packages/db/queries/approval";
import type {
  ApplicationArtifactRecord,
  ApplicationRecord,
  ApprovalRequestRecord
} from "../packages/db/schema";
import {
  resetLocalWorkflowClient,
  runLocalOnboardingMemoryFlow,
  type LocalOnboardingMemoryInput,
  type LocalOnboardingMemoryResult
} from "../packages/workflows/client";
import {
  workflowEvents,
  type WorkflowEvent
} from "../packages/workflows/events";
import {
  runLocalApplicationPrep,
  type LocalApplicationPrepResult
} from "../packages/workflows/run-application-prep";
import {
  runLocalResearchSweep,
  type LocalResearchSweepInput,
  type LocalResearchSweepResult
} from "../packages/workflows/run-research-sweep";
import {
  runLocalWritingCycle,
  type LocalWritingCycleResult
} from "../packages/workflows/run-writing";
import type {
  WritingArtifact,
  WritingDocumentRequest
} from "../packages/writing/types";

const DEFAULT_ONBOARDING_FIXTURE = "fixtures/seeds/onboarding-sample.json";
const DEFAULT_RESEARCH_FIXTURE = "fixtures/seeds/research-seed.json";
const DEFAULT_OUT_DIR = "out/approval-cycle";

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
  path: string
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
  outDir: string
): void {
  console.log("================================================================");
  console.log(" MA-GA-Agent - Approval Resolution + Persistence harness");
  console.log("================================================================");
  console.log(` onboarding fixture: ${onboardingPath}`);
  console.log(` research fixture:   ${researchPath}`);
  console.log(` output directory:   ${outDir}`);
  console.log("");
}

function printOnboardingSummary(result: LocalOnboardingMemoryResult): void {
  const completed = result.emittedEvents.some(
    (e) => e.name === workflowEvents.onboardingComplete
  );
  console.log("--- Onboarding phase ---");
  console.log(`  user_id:             ${result.userId}`);
  console.log(`  profile_revision_id: ${result.revisionId}`);
  console.log(`  onboarding.complete: ${completed ? "emitted" : "NOT emitted"}`);
  console.log("");
}

function printResearchSummary(result: LocalResearchSweepResult): void {
  console.log("--- Research sweep phase ---");
  console.log(`  cycle_id:           ${result.cycleId}`);
  console.log(`  universities:       ${result.universities.length}`);
  console.log(`  programs:           ${result.programs.length}`);
  console.log(`  funding:            ${result.funding.length}`);
  console.log(`  contact_roles:      ${result.personRoles.length}`);
  console.log("");
}

function printWritingSummary(result: LocalWritingCycleResult): void {
  console.log("--- Writing phase ---");
  console.log(`  cycle_id:           ${result.cycleId}`);
  console.log(`  artifacts:          ${result.artifacts.length}`);
  console.log(`  ready:              ${result.totals.ready}`);
  console.log(`  style_failed:       ${result.totals.styleFailed}`);
  console.log("");
}

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
    const relWeight = (rel: string): number =>
      rel === "core" ? 4 : rel === "adjacent" ? 3 : rel === "tangential" ? 2 : 1;
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
      ? research.professionalProfiles.find((p) => p.personId === role.personId) ??
        null
      : null;

    picks.push({
      label: picks.length === 0 ? "primary" : "secondary",
      universityId: program.universityId,
      programId: program.id,
      fundingId: funding?.id ?? null,
      personRoleId: role?.id ?? null,
      professionalProfileId: profile?.id ?? null
    });
  }
  return picks;
}

function buildWritingPlanForTargets(
  targets: readonly TargetPick[]
): WritingDocumentRequest[] {
  const requests: WritingDocumentRequest[] = [];
  for (const target of targets) {
    requests.push({
      id: `req_${target.label}_sop`,
      documentType: "sop",
      universityId: target.universityId,
      programId: target.programId,
      fundingId: target.fundingId,
      personRoleId: target.personRoleId,
      professionalProfileId: target.professionalProfileId
    });
    requests.push({
      id: `req_${target.label}_resume_tailoring`,
      documentType: "resume_tailoring",
      universityId: target.universityId,
      programId: target.programId,
      personRoleId: target.personRoleId
    });
    requests.push({
      id: `req_${target.label}_personal_statement`,
      documentType: "personal_statement",
      universityId: target.universityId,
      programId: target.programId
    });
    if (target.fundingId) {
      requests.push({
        id: `req_${target.label}_cover_letter`,
        documentType: "cover_letter",
        universityId: target.universityId,
        programId: target.programId,
        fundingId: target.fundingId,
        personRoleId: target.personRoleId,
        professionalProfileId: target.professionalProfileId
      });
    }
  }
  return requests;
}

function printPrepPersistedSummary(cycle: LocalApplicationPrepResult): void {
  console.log("--- Persisted prep output ---");
  console.log(`  prep_cycle_id:        ${cycle.cycleId}`);
  console.log(`  applications:         ${cycle.persisted.applications.length}`);
  console.log(`  application_artifacts:${cycle.persisted.artifacts.length}`);
  console.log(`  approval_requests:    ${cycle.persisted.approvalRequests.length}`);
  console.log("");

  for (const app of cycle.persisted.applications) {
    const artifacts = cycle.persisted.artifacts.filter(
      (row) => row.applicationId === app.id
    );
    const approvals = cycle.persisted.approvalRequests.filter(
      (row) => row.applicationId === app.id
    );
    console.log(`  [application ${app.id}]`);
    console.log(`      program_id:   ${app.programId}`);
    console.log(`      status:       ${app.status}`);
    console.log(`      artifacts:    ${artifacts.length}`);
    for (const art of artifacts) {
      console.log(
        `        - ${art.id.padEnd(48)} kind=${art.kind.padEnd(22)} status=${art.status}`
      );
    }
    console.log(`      approvals:    ${approvals.length}`);
    for (const app of approvals) {
      const blocks =
        app.blockingSiblings.length > 0
          ? ` (blocked-by=${app.blockingSiblings.length})`
          : "";
      console.log(
        `        - ${app.id.padEnd(48)} action=${app.actionType.padEnd(22)} status=${app.status}${blocks}`
      );
    }
  }
  console.log("");
}

interface DecisionPlanItem {
  approvalId: string;
  decision: "approve" | "reject" | "request_edit" | "skip";
  decisionNote: string;
}

function planDecisions(cycle: LocalApplicationPrepResult): DecisionPlanItem[] {
  const plan: DecisionPlanItem[] = [];
  const byType = new Map<string, ApprovalRequestRecord[]>();
  for (const approval of cycle.persisted.approvalRequests) {
    const bucket = byType.get(approval.actionType) ?? [];
    bucket.push(approval);
    byType.set(approval.actionType, bucket);
  }

  const approveDraft = (byType.get("approve_draft") ?? []).at(0);
  if (approveDraft) {
    plan.push({
      approvalId: approveDraft.id,
      decision: "approve",
      decisionNote:
        "Reviewed draft locally; grounding and style checks look correct for this cycle."
    });
  }

  const editRequired = (byType.get("edit_required") ?? []).at(0);
  if (editRequired) {
    plan.push({
      approvalId: editRequired.id,
      decision: "request_edit",
      decisionNote:
        "Sentence-length and first-person ratio drift — need a voice-anchor-aligned revision."
    });
  }

  const missingInput = (byType.get("missing_input") ?? []).at(0);
  if (missingInput) {
    plan.push({
      approvalId: missingInput.id,
      decision: "approve",
      decisionNote:
        "User attests missing input will be supplied manually before portal submission (data-capture flow is a later block)."
    });
  }

  return plan;
}

function printResolution(
  step: number,
  plan: DecisionPlanItem,
  result: ApprovalResolutionResult,
  events: readonly WorkflowEvent[]
): void {
  const approval = result.approvalRequest;
  console.log(
    `--- Decision ${String(step).padStart(2, "0")}: ${plan.decision.toUpperCase()} ${approval.id} ---`
  );
  console.log(`  action_type:             ${approval.actionType}`);
  console.log(
    `  approval: ${approval.status}   application: ${result.previousApplicationStatus} → ${result.application.status}${result.applicationStatusChanged ? " (changed)" : " (unchanged)"}`
  );
  console.log(`  pending_after:           ${result.pendingApprovalsAfter}`);
  if (result.artifact) {
    console.log(
      `  artifact_after:          ${result.artifact.id} status=${result.artifact.status}${result.artifact.approvedByUserAt ? ` approvedAt=${result.artifact.approvedByUserAt}` : ""}`
    );
  }
  console.log(`  decision_note:           ${approval.decisionNote ?? "(none)"}`);
  console.log(`  emitted_events:          ${events.map((e) => e.name).join(", ")}`);
  console.log("");
}

function printPendingQueue(userId: string): void {
  const actionable = listActionableApprovals(userId);
  console.log(`--- Pending approval queue (user=${userId}) ---`);
  if (actionable.length === 0) {
    console.log("  (none pending)");
    console.log("");
    return;
  }
  const byApp = new Map<string, typeof actionable>();
  for (const row of actionable) {
    const bucket = byApp.get(row.request.applicationId) ?? [];
    bucket.push(row);
    byApp.set(row.request.applicationId, bucket);
  }
  for (const [applicationId, bucket] of byApp) {
    console.log(`  [application ${applicationId}] pending=${bucket.length}`);
    for (const row of bucket) {
      const gate = row.readyToResolve
        ? "ready"
        : `blocked-by=${row.blockedByCount}`;
      console.log(
        `    - ${row.request.id.padEnd(48)} action=${row.request.actionType.padEnd(22)} (${gate})`
      );
    }
  }
  console.log("");
}

function printResumeSnapshots(userId: string, allEvents: WorkflowEvent[]): void {
  const applications = applicationQueries.listForUser(userId);
  console.log("--- Workflow resume ---");
  for (const app of applications) {
    const { snapshot, events } = resumeApplication(app.id);
    allEvents.push(...events);
    console.log(`  [application ${snapshot.application.id}]`);
    console.log(`      program_id:       ${snapshot.application.programId}`);
    console.log(`      status:           ${snapshot.status}`);
    console.log(`      pending:          ${snapshot.pendingApprovals.length}`);
    console.log(`      resolved:         ${snapshot.resolvedApprovals.length}`);
    console.log(
      `      ready_for_submission_approval: ${
        snapshot.readyForSubmission?.id ?? "(none)"
      } status=${snapshot.readyForSubmission?.status ?? "-"}`
    );
    console.log(
      `      blocked_by_pending_siblings:   ${snapshot.blockedByApprovalIds.length}`
    );
    console.log(
      `      isReadyForSubmission:          ${snapshot.isReadyForSubmission ? "yes" : "no"}`
    );
  }
  console.log("");
}

function saveSnapshots(
  outDir: string,
  labels: readonly string[],
  snapshots: readonly {
    applications: ApplicationRecord[];
    artifacts: ApplicationArtifactRecord[];
    approvals: ApprovalRequestRecord[];
  }[]
): string[] {
  mkdirSync(outDir, { recursive: true });
  const saved: string[] = [];
  labels.forEach((label, index) => {
    const path = resolve(outDir, `snapshot__${label}.json`);
    writeFileSync(path, JSON.stringify(snapshots[index], null, 2), "utf8");
    saved.push(path);
  });
  return saved;
}

function captureFullSnapshot(userId: string) {
  const applications = applicationQueries.listForUser(userId);
  const artifacts = applications.flatMap((app) =>
    applicationArtifactQueries.listForApplication(app.id)
  );
  const approvals = applications.flatMap((app) =>
    approvalQueries.listForApplication(app.id)
  );
  return { applications, artifacts, approvals };
}

function printIntegrationAudit(
  userId: string,
  resolutionEvents: readonly WorkflowEvent[]
): number {
  console.log("--- Integration audit: approval resolution + persistence ---");
  const applications = applicationQueries.listForUser(userId);
  const approvals = applications.flatMap((app) =>
    approvalQueries.listForApplication(app.id)
  );
  const artifacts = applications.flatMap((app) =>
    applicationArtifactQueries.listForApplication(app.id)
  );

  let failures = 0;

  const allApprovalsHaveApplication = approvals.every((row) =>
    applications.some((app) => app.id === row.applicationId)
  );
  if (!allApprovalsHaveApplication) failures += 1;

  const approvalsWithArtifactRef = approvals.filter((row) => row.artifactId);
  const artifactIds = new Set(artifacts.map((row) => row.id));
  const approvalsWithOrphanArtifactRef = approvalsWithArtifactRef.filter(
    (row) => row.artifactId && !artifactIds.has(row.artifactId)
  );
  if (approvalsWithOrphanArtifactRef.length > 0) failures += 1;

  const pendingSubmitsWithoutBlockers = approvals.filter(
    (row) =>
      row.actionType === "ready_for_submission" &&
      row.blockingSiblings.length === 0 &&
      approvals.filter(
        (sibling) =>
          sibling.applicationId === row.applicationId && sibling.id !== row.id
      ).length > 0
  );
  if (pendingSubmitsWithoutBlockers.length > 0) failures += 1;

  const resolvedApprovals = approvals.filter((row) => row.status !== "pending");
  const approvalsWithoutDecisionTimestamp = resolvedApprovals.filter(
    (row) => !row.decidedByUserAt
  );
  if (approvalsWithoutDecisionTimestamp.length > 0) failures += 1;

  const decidedEvents = resolutionEvents.filter(
    (event) => event.name === workflowEvents.approvalDecided
  );
  if (decidedEvents.length !== resolvedApprovals.length) failures += 1;

  const sideEffectActions = new Set([
    "submit_application",
    "pay_fee",
    "send_email",
    "send_linkedin_msg",
    "approve_outreach"
  ]);
  const sideEffectApprovals = approvals.filter((row) =>
    sideEffectActions.has(row.actionType as string)
  );
  if (sideEffectApprovals.length > 0) failures += 1;

  console.log(`  applications_persisted:            ${applications.length}`);
  console.log(`  application_artifacts_persisted:   ${artifacts.length}`);
  console.log(`  approvals_persisted:               ${approvals.length}`);
  console.log(`  approvals_resolved:                ${resolvedApprovals.length}`);
  console.log(`  approval.decided events emitted:   ${decidedEvents.length}`);
  console.log(
    `  approvals_with_orphan_artifact_ref: ${approvalsWithOrphanArtifactRef.length}`
  );
  console.log(
    `  ready_for_submission_without_blockers: ${pendingSubmitsWithoutBlockers.length}`
  );
  console.log(
    `  approvals_missing_decidedByUserAt: ${approvalsWithoutDecisionTimestamp.length}`
  );
  console.log(
    `  side_effect_approvals_persisted:   ${sideEffectApprovals.length}`
  );

  if (failures === 0) {
    console.log(
      "  result: OK — persistence is consistent, resolution is observable, no side-effect approvals persisted (CLAUDE.md §8 invariants 1–3)."
    );
  } else {
    console.log(`  result: FAIL — ${failures} audit check(s) did not pass.`);
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

  const onboardingResult = await runLocalOnboardingMemoryFlow(
    loadOnboardingFixture(onboardingPath)
  );
  printOnboardingSummary(onboardingResult);

  const researchFixture = loadResearchFixture(researchPath);
  const researchInput: LocalResearchSweepInput = {
    ...researchFixture,
    userId: onboardingResult.userId,
    revisionId: onboardingResult.revisionId
  };
  const researchResult = await runLocalResearchSweep(researchInput);
  printResearchSummary(researchResult);

  const targets = pickTargets(researchResult);
  if (targets.length === 0) {
    console.error(
      "Approval-cycle harness: no viable target programs in the research sweep."
    );
    process.exitCode = 1;
    return;
  }

  const writingResult = await runLocalWritingCycle({
    userId: onboardingResult.userId,
    revisionId: onboardingResult.revisionId,
    requests: buildWritingPlanForTargets(targets)
  });
  printWritingSummary(writingResult);

  const appPrep = await runLocalApplicationPrep({
    userId: onboardingResult.userId,
    revisionId: onboardingResult.revisionId,
    writingArtifacts: writingResult.artifacts as readonly WritingArtifact[],
    programIds: targets.map((target) => target.programId)
  });

  printPrepPersistedSummary(appPrep);

  const beforeSnapshot = captureFullSnapshot(onboardingResult.userId);

  printPendingQueue(onboardingResult.userId);

  const plan = planDecisions(appPrep);
  if (plan.length === 0) {
    console.error("Approval-cycle harness: no approvals to resolve.");
    process.exitCode = 1;
    return;
  }

  const resolutionEvents: WorkflowEvent[] = [];
  plan.forEach((item, index) => {
    const { result, events } = resolveApproval({
      approvalRequestId: item.approvalId,
      decision: item.decision,
      decisionNote: item.decisionNote,
      decisionActorHint: "harness:run-approval-cycle"
    });
    resolutionEvents.push(...events);
    printResolution(index + 1, item, result, events);
  });

  printPendingQueue(onboardingResult.userId);

  printResumeSnapshots(onboardingResult.userId, resolutionEvents);

  const afterSnapshot = captureFullSnapshot(onboardingResult.userId);

  const savedFiles = saveSnapshots(
    outDir,
    ["before-decisions", "after-decisions"],
    [beforeSnapshot, afterSnapshot]
  );
  writeFileSync(
    resolve(outDir, "resolution-events.json"),
    JSON.stringify(resolutionEvents, null, 2),
    "utf8"
  );
  savedFiles.push(resolve(outDir, "resolution-events.json"));
  console.log(`--- Files saved (${savedFiles.length}) ---`);
  for (const file of savedFiles) {
    console.log(`  ${file}`);
  }
  console.log("");

  const failures = printIntegrationAudit(onboardingResult.userId, resolutionEvents);
  if (failures > 0) {
    console.error(
      `Approval-cycle integration audit FAILED — ${failures} check(s) did not pass.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Done. Persisted ${afterSnapshot.applications.length} application(s), ${afterSnapshot.artifacts.length} artifact(s), ${afterSnapshot.approvals.length} approval(s); resolved ${plan.length} decision(s) with workflow resume.`
  );
  console.log(`  snapshots saved under: ${outDir}`);
}

main().catch((error) => {
  console.error("[run-approval-cycle] fatal error:", error);
  process.exit(1);
});
