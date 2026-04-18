import { programQueries } from "../../db/queries/program";
import { universityQueries } from "../../db/queries/university";
import { createExternalSourceEvidenceBatch } from "../../evidence/external";
import type { RelevanceClass } from "../../db/enums";

import {
  contract,
  type ProgramQualificationCandidate,
  type ProgramQualificationEvidenceInput,
  type ProgramQualificationInput,
  type ProgramQualificationOutput,
  type ProgramQualificationResult
} from "./contract";
import { SYSTEM_PROMPT } from "./prompt";

export { contract, SYSTEM_PROMPT };
export * from "./contract";

const STRONG_AI_KEYWORDS = [
  "artificial intelligence",
  "machine learning",
  "deep learning",
  "computer vision",
  "natural language processing",
  "nlp",
  "reinforcement learning",
  "neural network",
  "representation learning",
  "foundation model",
  "llm",
  "large language model",
  "generative ai"
];

const ADJACENT_AI_KEYWORDS = [
  "data science",
  "data mining",
  "statistical learning",
  "robotics",
  "multi-agent",
  "ai safety",
  "responsible ai",
  "optimization",
  "bayesian",
  "graph learning"
];

const TANGENTIAL_AI_KEYWORDS = [
  "algorithms",
  "software engineering",
  "computational",
  "systems"
];

function lowerBag(text: string): string {
  return text.toLowerCase();
}

function matchKeywords(text: string, taxonomy: string[]): string[] {
  const bag = lowerBag(text);
  return taxonomy.filter((keyword) => bag.includes(keyword));
}

function classify(
  candidate: ProgramQualificationCandidate,
  researchThemes: string[]
): { relevanceClass: RelevanceClass; fitScore: number; hits: string[]; reason: string } {
  const curriculum = candidate.curriculumExcerpt;
  const faculty = candidate.facultyAlignmentExcerpt;
  const combined = `${candidate.title}\n${candidate.concentration ?? ""}\n${curriculum}\n${faculty}`;

  const strong = matchKeywords(combined, STRONG_AI_KEYWORDS);
  const adjacent = matchKeywords(combined, ADJACENT_AI_KEYWORDS);
  const tangential = matchKeywords(combined, TANGENTIAL_AI_KEYWORDS);
  const themeHits = researchThemes.filter((theme) =>
    combined.toLowerCase().includes(theme.toLowerCase())
  );

  const hits = [
    ...strong.map((h) => `strong:${h}`),
    ...adjacent.map((h) => `adjacent:${h}`),
    ...tangential.map((h) => `tangential:${h}`),
    ...themeHits.map((h) => `theme:${h}`)
  ];

  const facultyStrong = matchKeywords(faculty, STRONG_AI_KEYWORDS).length;

  if (strong.length >= 2 && facultyStrong >= 1) {
    const fit = Math.min(
      1,
      0.65 + strong.length * 0.05 + themeHits.length * 0.05
    );
    return {
      relevanceClass: "core",
      fitScore: Number(fit.toFixed(2)),
      hits,
      reason: `>=2 strong AI keywords in curriculum/faculty (${strong.join(", ")})`
    };
  }

  if (strong.length >= 1 || adjacent.length >= 2) {
    const fit = Math.min(
      0.65,
      0.4 + strong.length * 0.08 + adjacent.length * 0.04 + themeHits.length * 0.05
    );
    return {
      relevanceClass: "adjacent",
      fitScore: Number(fit.toFixed(2)),
      hits,
      reason: `adjacent signal (strong=${strong.length}, adjacent=${adjacent.length})`
    };
  }

  if (adjacent.length >= 1 || tangential.length >= 1 || themeHits.length >= 1) {
    const fit = Math.min(
      0.4,
      0.2 + adjacent.length * 0.05 + tangential.length * 0.03 + themeHits.length * 0.04
    );
    return {
      relevanceClass: "tangential",
      fitScore: Number(fit.toFixed(2)),
      hits,
      reason: `tangential signal only`
    };
  }

  return {
    relevanceClass: "rejected",
    fitScore: 0,
    hits,
    reason: "no AI/ML curriculum or faculty signal detected"
  };
}

function materializeEvidence(
  evidence: readonly ProgramQualificationEvidenceInput[],
  subjectType: "department" | "graduate_program",
  subjectId: string
): string[] {
  return createExternalSourceEvidenceBatch(
    evidence.map((ev) => ({
      sourceUrl: ev.sourceUrl,
      sourceType: ev.sourceType,
      sourceLabel: ev.sourceLabel,
      quotedText: ev.quotedText,
      sourceQualityScore: ev.sourceQualityScore ?? 0.8,
      subjectType,
      subjectId
    }))
  );
}

export async function run(
  input: ProgramQualificationInput
): Promise<ProgramQualificationOutput> {
  const results: ProgramQualificationResult[] = [];
  const flagged: ProgramQualificationResult[] = [];
  const notes: string[] = [];

  const departmentCache = new Map<string, string>();

  for (const candidate of input.candidates) {
    if (candidate.evidence.length === 0) {
      notes.push(
        `rejected program "${candidate.title}" — no evidence provided`
      );
      continue;
    }

    const deptKey = candidate.department.name.trim().toLowerCase();
    let departmentId = departmentCache.get(deptKey);

    if (!departmentId) {
      const deptAlloc = universityQueries.allocateDepartmentId(
        input.universityId,
        candidate.department.name
      );
      departmentId = deptAlloc.id;

      const deptEvidenceIds = materializeEvidence(
        candidate.department.evidence.length > 0
          ? candidate.department.evidence
          : candidate.evidence,
        "department",
        departmentId
      );

      const upsertDeptInput: {
        id: string;
        universityId: string;
        name: string;
        evidenceIds: string[];
        website?: string | null;
        admissionsUrl?: string | null;
        staffDirectoryUrl?: string | null;
      } = {
        id: departmentId,
        universityId: input.universityId,
        name: candidate.department.name,
        evidenceIds: deptEvidenceIds
      };
      if (candidate.department.website !== undefined) {
        upsertDeptInput.website = candidate.department.website;
      }
      if (candidate.department.admissionsUrl !== undefined) {
        upsertDeptInput.admissionsUrl = candidate.department.admissionsUrl;
      }
      if (candidate.department.staffDirectoryUrl !== undefined) {
        upsertDeptInput.staffDirectoryUrl =
          candidate.department.staffDirectoryUrl;
      }

      universityQueries.upsertDepartment(upsertDeptInput);
      departmentCache.set(deptKey, departmentId);
    }

    const classification = classify(candidate, input.researchThemes);
    const programAlloc = programQueries.allocateId(
      departmentId,
      candidate.title
    );

    const programEvidenceIds = materializeEvidence(
      candidate.evidence,
      "graduate_program",
      programAlloc.id
    );

    const upsertProgramInput: {
      id: string;
      universityId: string;
      departmentId: string;
      title: string;
      evidenceIds: string[];
      aliases?: string[];
      degreeType: ProgramQualificationCandidate["degreeType"];
      modality: ProgramQualificationCandidate["modality"];
      concentration?: string | null;
      curriculumUrl?: string | null;
      admissionsUrl?: string | null;
      thesisOption: ProgramQualificationCandidate["thesisOption"];
      relevanceClass: RelevanceClass;
      keywordHits: string[];
      fitScore: number;
    } = {
      id: programAlloc.id,
      universityId: input.universityId,
      departmentId,
      title: candidate.title,
      evidenceIds: programEvidenceIds,
      degreeType: candidate.degreeType,
      modality: candidate.modality,
      thesisOption: candidate.thesisOption,
      relevanceClass: classification.relevanceClass,
      keywordHits: classification.hits,
      fitScore: classification.fitScore
    };
    if (candidate.aliases) upsertProgramInput.aliases = candidate.aliases;
    if (candidate.concentration !== undefined) {
      upsertProgramInput.concentration = candidate.concentration;
    }
    if (candidate.curriculumUrl !== undefined) {
      upsertProgramInput.curriculumUrl = candidate.curriculumUrl;
    }
    if (candidate.admissionsUrl !== undefined) {
      upsertProgramInput.admissionsUrl = candidate.admissionsUrl;
    }

    const program = programQueries.upsert(upsertProgramInput);

    const result: ProgramQualificationResult = {
      programId: program.id,
      departmentId,
      title: program.title,
      relevanceClass: program.relevanceClass,
      fitScore: program.fitScore,
      keywordHits: program.keywordHits,
      reason: classification.reason,
      evidenceIds: program.evidenceIds
    };

    results.push(result);

    if (
      classification.relevanceClass === "core" &&
      classification.hits.filter((h) => h.startsWith("strong:")).length < 2
    ) {
      flagged.push(result);
    }
  }

  const departments = Array.from(
    new Set(results.map((r) => r.departmentId))
  ).map((depId) => {
    const rows = universityQueries
      .listDepartments(input.universityId)
      .filter((d) => d.id === depId);
    return rows[0]!;
  });

  const programs = programQueries.listByUniversity(input.universityId);

  notes.push(
    `candidates=${input.candidates.length}  programs_persisted=${results.length}  flagged=${flagged.length}`
  );

  return {
    departments,
    programs,
    results,
    flaggedForReview: flagged,
    notes
  };
}
