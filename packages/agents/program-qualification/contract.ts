import type {
  DegreeType,
  EvidenceSourceType,
  ProgramModality,
  RelevanceClass,
  ThesisOption
} from "../../db/enums";
import type {
  DepartmentRecord,
  GraduateProgramRecord
} from "../../db/schema";
import type { AgentContract } from "../types";

export interface ProgramQualificationEvidenceInput {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  quotedText: string;
  sourceQualityScore?: number;
}

export interface ProgramQualificationDepartmentInput {
  name: string;
  website?: string | null;
  admissionsUrl?: string | null;
  staffDirectoryUrl?: string | null;
  evidence: ProgramQualificationEvidenceInput[];
}

export interface ProgramQualificationCandidate {
  title: string;
  aliases?: string[];
  department: ProgramQualificationDepartmentInput;
  degreeType: DegreeType;
  modality: ProgramModality;
  concentration?: string | null;
  curriculumUrl?: string | null;
  admissionsUrl?: string | null;
  thesisOption: ThesisOption;
  curriculumExcerpt: string;
  facultyAlignmentExcerpt: string;
  evidence: ProgramQualificationEvidenceInput[];
}

export interface ProgramQualificationInput {
  universityId: string;
  primaryDomain: string;
  researchThemes: string[];
  candidates: ProgramQualificationCandidate[];
}

export interface ProgramQualificationResult {
  programId: string;
  departmentId: string;
  title: string;
  relevanceClass: RelevanceClass;
  fitScore: number;
  keywordHits: string[];
  reason: string;
  evidenceIds: string[];
}

export interface ProgramQualificationOutput {
  departments: DepartmentRecord[];
  programs: GraduateProgramRecord[];
  results: ProgramQualificationResult[];
  flaggedForReview: ProgramQualificationResult[];
  notes: string[];
}

export const contract: AgentContract = {
  name: "ProgramQualificationAgent",
  version: "0.1.0",
  inputs: {
    description:
      "Per-university program candidates with department + curriculum evidence; produces graduate_program rows with relevance_class and fit score.",
    typeName: "ProgramQualificationInput"
  },
  outputs: {
    description:
      "Persisted department + graduate_program records; relevance_class assigned via deterministic AI keyword taxonomy plus faculty alignment excerpt.",
    typeName: "ProgramQualificationOutput"
  },
  tools: ["site.search", "crawl.page", "keyword.classifier"],
  model:
    "deterministic keyword taxonomy + faculty alignment heuristic; llm fallback intentionally not wired in this slice",
  invariants: [
    "Every program row carries at least one evidence row with a URL and quoted snippet.",
    "A program classified `core` must have at least 2 strong AI keyword hits in curriculum/faculty excerpts.",
    "A program classified `rejected` is still persisted with its evidence — the rejection reason is part of the research trail.",
    "Data-science-only programs without ML/AI curriculum signal are never classified `core`."
  ],
  failureModes: [
    "Data-science misclassified as core.",
    "Missing newly-named programs because alias coverage is thin.",
    "Program evidence missing URL or quoted snippet."
  ],
  escalation:
    "If a candidate matches 1 AI keyword but curriculum excerpt contradicts it, classify `tangential` and flag for review rather than classifying `core`.",
  confidence:
    "Weighted from keyword density + faculty alignment excerpt matches; core requires >=2 strong hits plus a faculty overlap signal.",
  idempotency: "{university_id, department_name, title}"
};
