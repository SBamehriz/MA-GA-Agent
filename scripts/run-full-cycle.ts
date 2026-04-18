/**
 * Full end-to-end pipeline:
 *
 *   [1/5] onboarding
 *   [2/5] research sweep
 *   [3/5] writing
 *   [4/5] application prep
 *   [5/5] approval cycle
 *
 * Then runs a post-cycle audit that:
 *   - reads the persisted snapshot (out/approval-cycle/snapshot__after-decisions.json),
 *   - reads the onboarding fixture to resolve the user's resume PDF path,
 *   - builds a "ready-to-apply" sidecar packet per application under
 *     out/full-cycle/packets/<applicationId>/, including tailored resume,
 *     cover letter, SOP, personal statement, and short-answer markdown,
 *   - prints a final summary block.
 *
 * This script is pure orchestration + post-run audit. It spawns the existing
 * `scripts/run-*.ts` scripts as child processes and never re-implements their
 * logic. The five canonical scripts remain the source of truth.
 *
 * Usage:
 *   pnpm run:full-cycle
 *   pnpm run:full-cycle -- --fixture=fixtures/seeds/me.json
 *   pnpm run:full-cycle -- --resume=/absolute/path/to/my-resume.pdf
 *   pnpm run:full-cycle -- --skip-onboarding --skip-research
 *
 * Flags (all optional):
 *   --fixture=<path>    alternative onboarding fixture (passed to step 1)
 *   --resume=<path>     explicit resume PDF path, overrides fixture's storageRef
 *   --skip-onboarding   skip step 1
 *   --skip-research     skip step 2
 *   --skip-writing      skip step 3
 *   --skip-prep         skip step 4
 *   --skip-approval     skip step 5 (audit will fall back to application-prep output)
 *   --no-audit          skip the final audit + sidecar packets
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_FIXTURE = "fixtures/seeds/onboarding-sample.json";
const OUT_DIR = "out/full-cycle";
const SNAPSHOT_PATH = "out/approval-cycle/snapshot__after-decisions.json";
const APP_PREP_DIR = "out/application-prep";

interface ParsedArgs {
  fixture: string;
  resumeOverride: string | null;
  skipOnboarding: boolean;
  skipResearch: boolean;
  skipWriting: boolean;
  skipPrep: boolean;
  skipApproval: boolean;
  noAudit: boolean;
}

interface StepPlan {
  index: number;
  label: string;
  script: string;
  extraArgs: string[];
  skipped: boolean;
}

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let fixture = DEFAULT_FIXTURE;
  let resumeOverride: string | null = null;
  let skipOnboarding = false;
  let skipResearch = false;
  let skipWriting = false;
  let skipPrep = false;
  let skipApproval = false;
  let noAudit = false;

  for (const raw of argv) {
    if (raw.startsWith("--fixture=")) {
      fixture = raw.slice("--fixture=".length);
    } else if (raw.startsWith("--resume=")) {
      resumeOverride = raw.slice("--resume=".length);
    } else if (raw === "--skip-onboarding") skipOnboarding = true;
    else if (raw === "--skip-research") skipResearch = true;
    else if (raw === "--skip-writing") skipWriting = true;
    else if (raw === "--skip-prep") skipPrep = true;
    else if (raw === "--skip-approval") skipApproval = true;
    else if (raw === "--no-audit") noAudit = true;
    else if (raw === "--help" || raw === "-h") {
      printUsageAndExit(0);
    } else if (raw.length > 0) {
      process.stderr.write(`unknown flag: ${raw}\n`);
      printUsageAndExit(2);
    }
  }

  return {
    fixture,
    resumeOverride,
    skipOnboarding,
    skipResearch,
    skipWriting,
    skipPrep,
    skipApproval,
    noAudit,
  };
}

function printUsageAndExit(code: number): never {
  process.stdout.write(
    [
      "pnpm run:full-cycle -- [flags]",
      "",
      "  --fixture=<path>     alternative onboarding fixture (default: fixtures/seeds/onboarding-sample.json)",
      "  --resume=<path>      explicit resume PDF path, overrides the fixture's storageRef",
      "  --skip-onboarding    skip step 1 (onboarding)",
      "  --skip-research      skip step 2 (research sweep)",
      "  --skip-writing       skip step 3 (writing)",
      "  --skip-prep          skip step 4 (application prep)",
      "  --skip-approval      skip step 5 (approval cycle)",
      "  --no-audit           skip the post-run sidecar packet audit",
      "",
      "Chains the five canonical scripts in strict order. Stops immediately on failure.",
      "",
    ].join("\n"),
  );
  process.exit(code);
}

function buildPlan(args: ParsedArgs): StepPlan[] {
  return [
    {
      index: 1,
      label: "onboarding",
      script: "scripts/run-onboarding.ts",
      extraArgs: [args.fixture],
      skipped: args.skipOnboarding,
    },
    {
      index: 2,
      label: "research sweep",
      script: "scripts/run-research-sweep.ts",
      extraArgs: [],
      skipped: args.skipResearch,
    },
    {
      index: 3,
      label: "writing",
      script: "scripts/run-writing.ts",
      extraArgs: [],
      skipped: args.skipWriting,
    },
    {
      index: 4,
      label: "application prep",
      script: "scripts/run-application-prep.ts",
      extraArgs: [],
      skipped: args.skipPrep,
    },
    {
      index: 5,
      label: "approval cycle",
      script: "scripts/run-approval-cycle.ts",
      extraArgs: [],
      skipped: args.skipApproval,
    },
  ];
}

async function runStep(step: StepPlan, root: string): Promise<number> {
  const scriptAbs = resolve(root, step.script);
  const tsxAbs = resolve(root, "node_modules/tsx/dist/cli.mjs");
  if (!existsSync(tsxAbs)) {
    process.stderr.write(
      `tsx runner not found at ${tsxAbs}. Did you run \`pnpm install\`?\n`,
    );
    return 99;
  }

  const header = `\n[${step.index}/5] Running ${step.label}...`;
  process.stdout.write(`${header}\n${"-".repeat(header.length)}\n`);

  return await new Promise<number>((resolvePromise) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [tsxAbs, scriptAbs, ...step.extraArgs],
      {
        cwd: root,
        stdio: "inherit",
        env: process.env,
      },
    );
    child.on("error", (err) => {
      process.stderr.write(`\nFAIL [${step.label}] spawn error: ${err.message}\n`);
      resolvePromise(98);
    });
    child.on("exit", (code, signal) => {
      const elapsedMs = Date.now() - started;
      if (signal) {
        process.stderr.write(`\nFAIL [${step.label}] killed by signal ${signal} after ${elapsedMs}ms\n`);
        resolvePromise(97);
        return;
      }
      const exit = code ?? 0;
      if (exit === 0) {
        process.stdout.write(`OK  ${step.label} complete (${formatDuration(elapsedMs)})\n`);
      } else {
        process.stderr.write(`\nFAIL [${step.label}] exited ${exit} after ${formatDuration(elapsedMs)}\n`);
      }
      resolvePromise(exit);
    });
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${rem.toString().padStart(2, "0")}s`;
}

// ---------------------------------------------------------------------------
// Post-run audit: build per-application ready-to-apply sidecar packets
// ---------------------------------------------------------------------------

interface SnapshotApplication {
  id: string;
  userId: string;
  programId: string;
  universityId: string;
  fundingId: string | null;
  personRoleId: string | null;
  professionalProfileId: string | null;
  status: string;
  readinessJson: {
    status: string;
    readyItems: number;
    warningItems: number;
    missingItems: number;
    userInputItems: number;
    deferredItems: number;
    totalItems: number;
    blockers: string[];
    warnings: string[];
  };
  checklistJson: Array<{
    id: string;
    kind: string;
    category: string;
    label: string;
    required: boolean;
    origin: string;
    status: string;
    notes: string[];
    writingRequestId: string | null;
    writingDocumentType: string | null;
    writingReadiness: string | null;
  }>;
  artifactIds: string[];
  approvalRequestIds: string[];
}

interface SnapshotArtifact {
  id: string;
  applicationId: string;
  kind: string;
  status: string;
  title: string;
  contentText: string;
  wordCount: number;
  writingRequestId: string | null;
}

interface SnapshotApproval {
  id: string;
  applicationId: string;
  artifactId: string | null;
  actionType: string;
  status: string;
  reason: string;
  blockingSiblings: string[];
}

interface SnapshotFile {
  applications: SnapshotApplication[];
  artifacts: SnapshotArtifact[];
  approvals: SnapshotApproval[];
}

interface OnboardingFixture {
  ingestion?: {
    sourceDocuments?: Array<{
      kind?: string;
      label?: string;
      fileName?: string | null;
      storageRef?: string | null;
    }>;
  };
}

interface ResolvedResume {
  originalLabel: string | null;
  originalStorageRef: string | null;
  originalResolvedPath: string | null;
  originalExists: boolean;
  overrideApplied: boolean;
}

interface ProgramPacketSidecar {
  generatedAt: string;
  applicationId: string;
  programId: string;
  universityId: string;
  fundingId: string | null;
  applicationStatus: string;
  readiness: SnapshotApplication["readinessJson"];
  resume: {
    originalFilePath: string | null;
    originalFileExists: boolean;
    originalLabel: string | null;
    tailoredArtifactId: string | null;
    tailoredStatus: string | null;
    tailoredFilePath: string | null;
    version: "tailored" | "original" | "none";
  };
  coverLetter: {
    artifactId: string | null;
    status: string | null;
    filePath: string | null;
  };
  essays: Array<{
    artifactId: string;
    kind: string;
    status: string;
    wordCount: number;
    filePath: string;
  }>;
  checklistStatus: Array<{
    id: string;
    kind: string;
    required: boolean;
    status: string;
    notes: string[];
  }>;
  readinessFlags: {
    resume: "ready" | "ready_with_warnings" | "missing" | "needs_input";
    coverLetter: "ready" | "ready_with_warnings" | "missing" | "needs_input";
    sop: "ready" | "ready_with_warnings" | "missing" | "needs_input";
    personalStatement: "ready" | "ready_with_warnings" | "missing" | "needs_input";
    shortAnswers: "ready" | "ready_with_warnings" | "missing" | "needs_input";
    transcript: "ready" | "needs_input" | "missing";
    testScores: "ready" | "needs_input" | "missing" | "not_required";
    fee: "ready" | "needs_input" | "missing";
    recommenders: "deferred_to_portal";
    overall: "ready_for_user_submission" | "pending_approvals" | "blocked";
  };
  pendingApprovals: Array<{
    id: string;
    artifactId: string | null;
    actionType: string;
    reason: string;
    status: string;
  }>;
}

interface FullCycleSummary {
  generatedAt: string;
  applicationsProcessed: number;
  readyForSubmission: number;
  pendingApprovals: number;
  blockedApplications: number;
  awaitingUser: number;
  resume: {
    linked: boolean;
    originalPath: string | null;
    originalExists: boolean;
    tailoredPrograms: number;
  };
  documents: {
    sops: number;
    personalStatements: number;
    shortAnswers: number;
    coverLetters: number;
    resumeTailorings: number;
    outreachMessages: number;
  };
  stepsRun: string[];
  stepsSkipped: string[];
  auditSource: "persisted-snapshot" | "application-prep-fallback" | "none";
  sidecarDir: string | null;
}

function readSnapshot(root: string): SnapshotFile | null {
  const abs = resolve(root, SNAPSHOT_PATH);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as SnapshotFile;
  } catch (err) {
    process.stderr.write(`warn: could not parse ${SNAPSHOT_PATH}: ${errToMsg(err)}\n`);
    return null;
  }
}

function readFixture(root: string, fixtureRelOrAbs: string): OnboardingFixture | null {
  const abs = resolve(root, fixtureRelOrAbs);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as OnboardingFixture;
  } catch (err) {
    process.stderr.write(`warn: could not parse fixture ${abs}: ${errToMsg(err)}\n`);
    return null;
  }
}

function resolveResume(
  fixture: OnboardingFixture | null,
  override: string | null,
  root: string,
): ResolvedResume {
  if (override !== null) {
    const abs = resolve(root, override);
    return {
      originalLabel: "user-provided override",
      originalStorageRef: override,
      originalResolvedPath: abs,
      originalExists: existsSync(abs),
      overrideApplied: true,
    };
  }
  const docs = fixture?.ingestion?.sourceDocuments ?? [];
  const resumeDoc = docs.find((d) => d.kind === "resume");
  if (!resumeDoc) {
    return {
      originalLabel: null,
      originalStorageRef: null,
      originalResolvedPath: null,
      originalExists: false,
      overrideApplied: false,
    };
  }
  const storageRef = resumeDoc.storageRef ?? null;
  let resolved: string | null = null;
  if (storageRef) {
    const stripped = storageRef.replace(/^local:\/\//, "");
    resolved = resolve(root, stripped);
  }
  return {
    originalLabel: resumeDoc.label ?? resumeDoc.fileName ?? null,
    originalStorageRef: storageRef,
    originalResolvedPath: resolved,
    originalExists: resolved !== null && existsSync(resolved),
    overrideApplied: false,
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function mapArtifactReadiness(status: string): "ready" | "ready_with_warnings" | "missing" | "needs_input" {
  switch (status) {
    case "approved":
    case "ready":
      return "ready";
    case "style_failed":
      return "ready_with_warnings";
    case "needs_user_input":
    case "grounding_failed":
      return "needs_input";
    case "superseded":
    case "draft":
      return "needs_input";
    default:
      return "needs_input";
  }
}

function mapChecklistReadiness(
  item: SnapshotApplication["checklistJson"][number] | undefined,
): "ready" | "needs_input" | "missing" | "not_required" {
  if (!item) return "missing";
  if (!item.required) {
    if (item.status === "complete" || item.status === "ready_with_warnings") return "ready";
    return "not_required";
  }
  if (item.status === "complete") return "ready";
  if (item.status === "needs_user_input") return "needs_input";
  if (item.status === "missing") return "missing";
  return "needs_input";
}

function deriveOverall(
  app: SnapshotApplication,
  pendingApprovals: number,
): ProgramPacketSidecar["readinessFlags"]["overall"] {
  if (app.readinessJson.status === "blocked") return "blocked";
  if (pendingApprovals > 0) return "pending_approvals";
  if (app.status === "ready_for_user_submission") return "ready_for_user_submission";
  return pendingApprovals === 0 && app.readinessJson.blockers.length === 0
    ? "pending_approvals"
    : "blocked";
}

function writeSidecar(
  app: SnapshotApplication,
  snapshot: SnapshotFile,
  resume: ResolvedResume,
  outRoot: string,
): { sidecar: ProgramPacketSidecar; folder: string } {
  const folder = resolve(outRoot, "packets", app.id);
  mkdirSync(folder, { recursive: true });

  const appArtifacts = snapshot.artifacts.filter((a) => a.applicationId === app.id);
  const appApprovals = snapshot.approvals.filter((a) => a.applicationId === app.id);

  const tailoredResume = appArtifacts.find((a) => a.kind === "resume_tailoring") ?? null;
  const coverLetter = appArtifacts.find((a) => a.kind === "cover_letter") ?? null;
  const sop = appArtifacts.find((a) => a.kind === "sop") ?? null;
  const personalStatement = appArtifacts.find((a) => a.kind === "personal_statement") ?? null;
  const shortAnswers = appArtifacts.filter((a) => a.kind === "short_answer");

  let tailoredResumePath: string | null = null;
  if (tailoredResume !== null) {
    tailoredResumePath = resolve(folder, "resume-tailored.md");
    writeFileSync(tailoredResumePath, tailoredResume.contentText, "utf8");
  }

  let coverLetterPath: string | null = null;
  if (coverLetter !== null) {
    coverLetterPath = resolve(folder, "cover-letter.md");
    writeFileSync(coverLetterPath, coverLetter.contentText, "utf8");
  }

  const essays: ProgramPacketSidecar["essays"] = [];
  if (sop !== null) {
    const path = resolve(folder, "sop.md");
    writeFileSync(path, sop.contentText, "utf8");
    essays.push({ artifactId: sop.id, kind: sop.kind, status: sop.status, wordCount: sop.wordCount, filePath: path });
  }
  if (personalStatement !== null) {
    const path = resolve(folder, "personal-statement.md");
    writeFileSync(path, personalStatement.contentText, "utf8");
    essays.push({
      artifactId: personalStatement.id,
      kind: personalStatement.kind,
      status: personalStatement.status,
      wordCount: personalStatement.wordCount,
      filePath: path,
    });
  }
  for (const sa of shortAnswers) {
    const slug = slugify(sa.writingRequestId ?? sa.id);
    const path = resolve(folder, `short-answer__${slug}.md`);
    writeFileSync(path, sa.contentText, "utf8");
    essays.push({
      artifactId: sa.id,
      kind: sa.kind,
      status: sa.status,
      wordCount: sa.wordCount,
      filePath: path,
    });
  }

  const checklistByKind = new Map<string, SnapshotApplication["checklistJson"][number]>();
  for (const item of app.checklistJson) checklistByKind.set(item.kind, item);

  const pendingApprovals = appApprovals.filter((a) => a.status === "pending");

  const readinessFlags: ProgramPacketSidecar["readinessFlags"] = {
    resume: tailoredResume !== null
      ? mapArtifactReadiness(tailoredResume.status)
      : (checklistByKind.get("resume") ? mapArtifactReadiness(checklistByKind.get("resume")!.writingReadiness ?? "draft") : "missing"),
    coverLetter: coverLetter !== null
      ? mapArtifactReadiness(coverLetter.status)
      : "missing",
    sop: sop !== null ? mapArtifactReadiness(sop.status) : "missing",
    personalStatement: personalStatement !== null
      ? mapArtifactReadiness(personalStatement.status)
      : (checklistByKind.get("personal_statement") && !checklistByKind.get("personal_statement")!.required
          ? "ready"
          : "missing"),
    shortAnswers: shortAnswers.length === 0
      ? "ready"
      : shortAnswers.every((s) => mapArtifactReadiness(s.status) === "ready")
        ? "ready"
        : shortAnswers.some((s) => mapArtifactReadiness(s.status) === "needs_input")
          ? "needs_input"
          : "ready_with_warnings",
    transcript: mapChecklistReadiness(checklistByKind.get("transcript")) === "ready" ? "ready" : "needs_input",
    testScores: mapChecklistReadiness(checklistByKind.get("test_score_report")),
    fee: mapChecklistReadiness(checklistByKind.get("application_fee_or_waiver")) === "ready" ? "ready" : "needs_input",
    recommenders: "deferred_to_portal",
    overall: deriveOverall(app, pendingApprovals.length),
  };

  const sidecar: ProgramPacketSidecar = {
    generatedAt: new Date().toISOString(),
    applicationId: app.id,
    programId: app.programId,
    universityId: app.universityId,
    fundingId: app.fundingId,
    applicationStatus: app.status,
    readiness: app.readinessJson,
    resume: {
      originalFilePath: resume.originalResolvedPath,
      originalFileExists: resume.originalExists,
      originalLabel: resume.originalLabel,
      tailoredArtifactId: tailoredResume?.id ?? null,
      tailoredStatus: tailoredResume?.status ?? null,
      tailoredFilePath: tailoredResumePath,
      version: tailoredResume !== null ? "tailored" : resume.originalResolvedPath !== null ? "original" : "none",
    },
    coverLetter: {
      artifactId: coverLetter?.id ?? null,
      status: coverLetter?.status ?? null,
      filePath: coverLetterPath,
    },
    essays,
    checklistStatus: app.checklistJson.map((item) => ({
      id: item.id,
      kind: item.kind,
      required: item.required,
      status: item.status,
      notes: item.notes,
    })),
    readinessFlags,
    pendingApprovals: pendingApprovals.map((a) => ({
      id: a.id,
      artifactId: a.artifactId,
      actionType: a.actionType,
      reason: a.reason,
      status: a.status,
    })),
  };

  const sidecarJson = resolve(folder, "packet.json");
  writeFileSync(sidecarJson, JSON.stringify(sidecar, null, 2), "utf8");

  const sidecarMd = resolve(folder, "packet.md");
  writeFileSync(sidecarMd, renderSidecarMarkdown(sidecar), "utf8");

  return { sidecar, folder };
}

function renderSidecarMarkdown(s: ProgramPacketSidecar): string {
  const lines: string[] = [];
  lines.push(`# Ready-to-apply packet — ${s.applicationId}`);
  lines.push("");
  lines.push(`- Program: \`${s.programId}\``);
  lines.push(`- University: \`${s.universityId}\``);
  lines.push(`- Funding: ${s.fundingId ? `\`${s.fundingId}\`` : "(none)"}`);
  lines.push(`- Application status: **${s.applicationStatus}**`);
  lines.push(`- Overall readiness: **${s.readinessFlags.overall}**`);
  lines.push("");
  lines.push("## Resume");
  lines.push("");
  lines.push(`- Version: **${s.resume.version}**`);
  lines.push(`- Original PDF: ${s.resume.originalFilePath ? `\`${s.resume.originalFilePath}\`` : "_not linked_"}`);
  lines.push(`- Original PDF exists on disk: ${s.resume.originalFileExists ? "yes" : "no"}`);
  if (s.resume.tailoredArtifactId) {
    lines.push(`- Tailored artifact: \`${s.resume.tailoredArtifactId}\` (status=${s.resume.tailoredStatus})`);
    lines.push(`- Tailored file: \`${s.resume.tailoredFilePath}\``);
  } else {
    lines.push(`- Tailored artifact: _none generated for this program_`);
  }
  lines.push("");
  lines.push("## Cover letter");
  lines.push("");
  if (s.coverLetter.artifactId) {
    lines.push(`- Artifact: \`${s.coverLetter.artifactId}\` (status=${s.coverLetter.status})`);
    lines.push(`- File: \`${s.coverLetter.filePath}\``);
  } else {
    lines.push("_No cover letter artifact for this application._");
  }
  lines.push("");
  lines.push("## Essays");
  lines.push("");
  if (s.essays.length === 0) {
    lines.push("_No essay artifacts for this application._");
  } else {
    for (const e of s.essays) {
      lines.push(`- **${e.kind}** — status=${e.status}, ${e.wordCount} words — \`${e.filePath}\``);
    }
  }
  lines.push("");
  lines.push("## Readiness flags");
  lines.push("");
  for (const [k, v] of Object.entries(s.readinessFlags)) {
    lines.push(`- ${k}: **${v}**`);
  }
  lines.push("");
  lines.push("## Checklist");
  lines.push("");
  for (const c of s.checklistStatus) {
    const req = c.required ? "required" : "optional";
    lines.push(`- [${c.status}] ${c.kind} (${req})${c.notes.length ? ` — ${c.notes.join(" | ")}` : ""}`);
  }
  lines.push("");
  lines.push("## Pending approvals");
  lines.push("");
  if (s.pendingApprovals.length === 0) {
    lines.push("_None pending — all approvals on this application have been decided._");
  } else {
    for (const a of s.pendingApprovals) {
      lines.push(`- ${a.id} — action=${a.actionType} — ${a.reason}`);
    }
  }
  lines.push("");
  lines.push(`_Generated: ${s.generatedAt}_`);
  lines.push("");
  return lines.join("\n");
}

function auditFromSnapshot(
  snapshot: SnapshotFile,
  fixture: OnboardingFixture | null,
  args: ParsedArgs,
  root: string,
): FullCycleSummary {
  const outRoot = resolve(root, OUT_DIR);
  mkdirSync(outRoot, { recursive: true });

  const resume = resolveResume(fixture, args.resumeOverride, root);
  const sidecars: ProgramPacketSidecar[] = [];
  for (const app of snapshot.applications) {
    sidecars.push(writeSidecar(app, snapshot, resume, outRoot).sidecar);
  }

  const docs = {
    sops: snapshot.artifacts.filter((a) => a.kind === "sop").length,
    personalStatements: snapshot.artifacts.filter((a) => a.kind === "personal_statement").length,
    shortAnswers: snapshot.artifacts.filter((a) => a.kind === "short_answer").length,
    coverLetters: snapshot.artifacts.filter((a) => a.kind === "cover_letter").length,
    resumeTailorings: snapshot.artifacts.filter((a) => a.kind === "resume_tailoring").length,
    outreachMessages: snapshot.artifacts.filter((a) => a.kind === "outreach_message").length,
  };

  const pendingApprovals = snapshot.approvals.filter((a) => a.status === "pending").length;
  const readyForSubmission = sidecars.filter((s) => s.readinessFlags.overall === "ready_for_user_submission").length;
  const blocked = sidecars.filter((s) => s.readinessFlags.overall === "blocked").length;
  const awaitingUser = snapshot.applications.filter((a) => a.status === "awaiting_user").length;

  return {
    generatedAt: new Date().toISOString(),
    applicationsProcessed: snapshot.applications.length,
    readyForSubmission,
    pendingApprovals,
    blockedApplications: blocked,
    awaitingUser,
    resume: {
      linked: resume.originalResolvedPath !== null,
      originalPath: resume.originalResolvedPath,
      originalExists: resume.originalExists,
      tailoredPrograms: docs.resumeTailorings,
    },
    documents: docs,
    stepsRun: [],
    stepsSkipped: [],
    auditSource: "persisted-snapshot",
    sidecarDir: outRoot,
  };
}

function auditFromPrepFallback(root: string): FullCycleSummary {
  const outRoot = resolve(root, OUT_DIR);
  mkdirSync(outRoot, { recursive: true });

  let sops = 0;
  let personalStatements = 0;
  let shortAnswers = 0;
  let coverLetters = 0;
  let resumeTailorings = 0;
  let outreachMessages = 0;
  let applications = 0;
  let blocked = 0;

  const prepDir = resolve(root, APP_PREP_DIR);
  if (existsSync(prepDir)) {
    // Best-effort count from saved packets without touching IDs.
    const fs = readFileSync;
    for (const entry of readDirNames(prepDir)) {
      if (!entry.startsWith("packet__") || !entry.endsWith(".json")) continue;
      try {
        const pkt = JSON.parse(fs(resolve(prepDir, entry), "utf8")) as {
          readiness?: { status?: string };
          artifacts?: Array<{ documentType?: string }>;
        };
        applications += 1;
        if (pkt.readiness?.status === "blocked") blocked += 1;
        for (const a of pkt.artifacts ?? []) {
          switch (a.documentType) {
            case "sop": sops += 1; break;
            case "personal_statement": personalStatements += 1; break;
            case "short_answer": shortAnswers += 1; break;
            case "cover_letter": coverLetters += 1; break;
            case "resume_tailoring": resumeTailorings += 1; break;
            case "outreach_message": outreachMessages += 1; break;
          }
        }
      } catch { /* skip malformed */ }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    applicationsProcessed: applications,
    readyForSubmission: 0,
    pendingApprovals: 0,
    blockedApplications: blocked,
    awaitingUser: 0,
    resume: {
      linked: false,
      originalPath: null,
      originalExists: false,
      tailoredPrograms: resumeTailorings,
    },
    documents: { sops, personalStatements, shortAnswers, coverLetters, resumeTailorings, outreachMessages },
    stepsRun: [],
    stepsSkipped: [],
    auditSource: "application-prep-fallback",
    sidecarDir: null,
  };
}

function readDirNames(dir: string): string[] {
  try {
    // Avoid a top-level import for one use.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function printFinalSummary(summary: FullCycleSummary, root: string): void {
  const bar = "-".repeat(40);
  const out: string[] = [];
  out.push("");
  out.push(bar);
  out.push("FULL CYCLE COMPLETE");
  out.push(bar);
  out.push("");
  out.push(`Applications processed:  ${summary.applicationsProcessed}`);
  out.push(`Ready for submission:    ${summary.readyForSubmission}`);
  out.push(`Pending approvals:       ${summary.pendingApprovals}`);
  out.push(`Blocked applications:    ${summary.blockedApplications}`);
  if (summary.awaitingUser > 0) {
    out.push(`Awaiting user:           ${summary.awaitingUser}`);
  }
  out.push("");
  out.push("Resume status:");
  out.push(`  linked:    ${summary.resume.linked ? "yes" : "no"}`);
  if (summary.resume.originalPath) {
    const rel = relative(root, summary.resume.originalPath);
    out.push(`  original:  ${rel.startsWith("..") ? summary.resume.originalPath : rel}  (exists=${summary.resume.originalExists})`);
  }
  out.push(`  tailored:  ${summary.resume.tailoredPrograms} program(s)`);
  out.push("");
  out.push("Documents generated:");
  out.push(`  SOPs:              ${summary.documents.sops}`);
  out.push(`  Personal Stmts:    ${summary.documents.personalStatements}`);
  out.push(`  Short Answers:     ${summary.documents.shortAnswers}`);
  out.push(`  Cover Letters:     ${summary.documents.coverLetters}`);
  out.push(`  Resume Tailorings: ${summary.documents.resumeTailorings}`);
  out.push(`  Outreach Messages: ${summary.documents.outreachMessages}`);
  out.push("");
  if (summary.stepsSkipped.length > 0) {
    out.push(`Skipped steps: ${summary.stepsSkipped.join(", ")}`);
  }
  out.push(`Audit source:  ${summary.auditSource}`);
  if (summary.sidecarDir) {
    const rel = relative(root, summary.sidecarDir);
    out.push(`Sidecar packets: ${rel}${sep}packets${sep}<applicationId>${sep}`);
  }
  out.push("");
  out.push("Next step:");
  if (summary.pendingApprovals > 0) {
    out.push("  → Review pending approvals. Open one of the per-application packets under");
    out.push(`    out/full-cycle/packets/<applicationId>/packet.md and decide.`);
    out.push("  → Or re-run the approval cycle harness:  pnpm run:approval-cycle");
  } else if (summary.blockedApplications > 0) {
    out.push("  → Resolve missing inputs (fee / test scores / etc.) listed in each packet's");
    out.push("    blockers[], then re-run:                pnpm run:full-cycle");
  } else if (summary.readyForSubmission > 0) {
    out.push("  → Applications are ready for YOU to submit manually in each school portal.");
    out.push("    The system does NOT submit, pay fees, or send emails.");
  } else {
    out.push("  → Inspect each packet under out/full-cycle/packets/<applicationId>/packet.md.");
  }
  out.push(bar);
  out.push("");
  process.stdout.write(out.join("\n"));
}

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const plan = buildPlan(args);

  const stepsRun: string[] = [];
  const stepsSkipped: string[] = [];

  const banner = [
    "",
    "===========================================",
    "MA-GA-Agent — full cycle",
    "===========================================",
    `fixture:        ${args.fixture}`,
    `resume override: ${args.resumeOverride ?? "(none — using fixture)"}`,
    `skip:            ${plan.filter((s) => s.skipped).map((s) => s.label).join(", ") || "(none)"}`,
    "",
  ].join("\n");
  process.stdout.write(banner);

  for (const step of plan) {
    if (step.skipped) {
      process.stdout.write(`\n[${step.index}/5] SKIPPED ${step.label}\n`);
      stepsSkipped.push(step.label);
      continue;
    }
    const code = await runStep(step, root);
    if (code !== 0) {
      process.stderr.write(
        `\nFull cycle stopped at step ${step.index}/5 (${step.label}). Fix the error above and re-run.\n`,
      );
      return code;
    }
    stepsRun.push(step.label);
  }

  if (args.noAudit) {
    process.stdout.write("\n(audit skipped via --no-audit)\n");
    return 0;
  }

  const snapshot = args.skipApproval ? null : readSnapshot(root);
  const fixture = readFixture(root, args.fixture);

  let summary: FullCycleSummary;
  if (snapshot !== null) {
    summary = auditFromSnapshot(snapshot, fixture, args, root);
  } else {
    summary = auditFromPrepFallback(root);
  }
  summary.stepsRun = stepsRun;
  summary.stepsSkipped = stepsSkipped;

  const outRoot = resolve(root, OUT_DIR);
  mkdirSync(outRoot, { recursive: true });
  writeFileSync(resolve(outRoot, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  printFinalSummary(summary, root);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`\nUNEXPECTED: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(99);
  });
