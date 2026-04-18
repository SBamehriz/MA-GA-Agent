export const EVIDENCE_PACKAGE = "@ma-ga-agent/evidence";

export {
  createExternalSourceEvidence,
  createExternalSourceEvidenceBatch,
  type CreateExternalSourceEvidenceInput
} from "./external";

export {
  assertEvidenceBinding,
  auditEvidenceBindings,
  MissingEvidenceError,
  type AuditMissingEvidenceReport,
  type EvidenceAuditInput,
  type EvidenceBinding
} from "./validator";
