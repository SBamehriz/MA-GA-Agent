import type {
  ProfessionalProfileProvider,
  ProfessionalProfileType
} from "../../db/enums";
import { contactQueries } from "../../db/queries/contact";
import { dbClient } from "../../db/client";
import { createExternalSourceEvidenceBatch } from "../../evidence/external";
import type { ProfessionalProfileRecord } from "../../db/schema";

import type { ContactCandidateEnrichmentRequest } from "../contact-discovery/contract";
import {
  contract,
  type ProfileEnrichmentInput,
  type ProfileEnrichmentOutput,
  type ProfileEnrichmentResult
} from "./contract";
import { SYSTEM_PROMPT } from "./prompt";

export { contract, SYSTEM_PROMPT };
export * from "./contract";

interface ProfileSignal {
  type: ProfessionalProfileType;
  url: string;
  provider: ProfessionalProfileProvider;
  sourceType: "directory" | "scholar" | "linkedin_profile";
  sourceLabel: string;
  quotedText: string;
}

function collectSignals(
  req: ContactCandidateEnrichmentRequest
): ProfileSignal[] {
  const signals: ProfileSignal[] = [];

  if (req.facultyPageUrl) {
    signals.push({
      type: "faculty_page",
      url: req.facultyPageUrl,
      provider: "directory",
      sourceType: "directory",
      sourceLabel: `${req.canonicalName} faculty page`,
      quotedText: `Faculty directory entry for ${req.canonicalName} (${req.roleTitle}).`
    });
  }

  if (req.scholarUrl) {
    signals.push({
      type: "scholar",
      url: req.scholarUrl,
      provider: "directory",
      sourceType: "scholar",
      sourceLabel: `${req.canonicalName} Google Scholar`,
      quotedText: `Google Scholar profile for ${req.canonicalName}.`
    });
  }

  if (req.personalUrl) {
    signals.push({
      type: "personal",
      url: req.personalUrl,
      provider: "directory",
      sourceType: "directory",
      sourceLabel: `${req.canonicalName} personal site`,
      quotedText: `Personal site for ${req.canonicalName}.`
    });
  }

  if (req.attestedLinkedinUrl) {
    signals.push({
      type: "linkedin",
      url: req.attestedLinkedinUrl,
      provider: "user_attested",
      sourceType: "linkedin_profile",
      sourceLabel: `${req.canonicalName} LinkedIn (user_attested)`,
      quotedText: `LinkedIn URL attested by the user for ${req.canonicalName} (${req.roleTitle}). Not scraped.`
    });
  }

  return signals;
}

function computeConfidence(
  signal: ProfileSignal,
  req: ContactCandidateEnrichmentRequest
): { confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let confidence = 0;

  if (req.institutionMatch) {
    confidence += 0.25;
    reasons.push("institution_match+0.25");
  }

  if (req.titleMatch) {
    confidence += 0.2;
    reasons.push("title_match+0.20");
  }

  const overlap = Math.min(1, req.researchAreas.length / 4);
  const overlapBonus = Number((0.3 * overlap).toFixed(2));

  if (overlapBonus > 0) {
    confidence += overlapBonus;
    reasons.push(`research_area_overlap(${req.researchAreas.length})+${overlapBonus.toFixed(2)}`);
  }

  confidence += 0.1;
  reasons.push("provider_quality_base+0.10");

  if (signal.provider === "user_attested") {
    confidence += 0.2;
    reasons.push("provider=user_attested+0.20");
  } else if (signal.provider === "approved_provider_stub") {
    confidence += 0.15;
    reasons.push("provider=approved_provider_stub+0.15");
  }

  const bounded = Math.min(1, Number(confidence.toFixed(2)));
  return { confidence: bounded, reasons };
}

export async function run(
  input: ProfileEnrichmentInput
): Promise<ProfileEnrichmentOutput> {
  const results: ProfileEnrichmentResult[] = [];
  const skipped: ProfileEnrichmentOutput["skipped"] = [];
  const notes: string[] = [];
  const createdProfileIds: string[] = [];

  for (const req of input.requests) {
    const signals = collectSignals(req);

    if (signals.length === 0) {
      skipped.push({
        personId: req.personId,
        canonicalName: req.canonicalName,
        reason: "no profile URLs provided — enrichment skipped"
      });
      continue;
    }

    for (const signal of signals) {
      if (signal.type === "linkedin" && signal.provider === "directory") {
        skipped.push({
          personId: req.personId,
          canonicalName: req.canonicalName,
          reason:
            "LinkedIn profile refused — provider must be user_attested or approved_provider_stub (CLAUDE.md §8.10)."
        });
        continue;
      }

      const alloc = contactQueries.allocateProfessionalProfileId(
        req.personId,
        signal.url
      );

      const evidenceIds = createExternalSourceEvidenceBatch([
        {
          sourceUrl: signal.url,
          sourceType: signal.sourceType,
          sourceLabel: signal.sourceLabel,
          quotedText: signal.quotedText,
          subjectType: "professional_profile",
          subjectId: alloc.id,
          sourceQualityScore:
            signal.provider === "user_attested" ? 0.95 : 0.7
        }
      ]);

      const { confidence, reasons } = computeConfidence(signal, req);

      const profile = contactQueries.upsertProfessionalProfile({
        id: alloc.id,
        personId: req.personId,
        type: signal.type,
        url: signal.url,
        provider: signal.provider,
        confidence,
        verificationSignals: reasons,
        institutionMatch: req.institutionMatch,
        titleMatch: req.titleMatch,
        researchAreaOverlap: Math.min(1, req.researchAreas.length / 4),
        evidenceIds
      });

      createdProfileIds.push(profile.id);

      results.push({
        personId: profile.personId,
        canonicalName: req.canonicalName,
        profileId: profile.id,
        profileType: profile.type,
        provider: profile.provider,
        url: profile.url,
        confidence: profile.confidence,
        verificationSignals: profile.verificationSignals,
        outreachReady: profile.type === "linkedin" && profile.confidence >= 0.85,
        reason:
          profile.type === "linkedin" && profile.confidence < 0.85
            ? "held from outreach binding: confidence < 0.85 (agents.md §4.10)"
            : "persisted"
      });
    }
  }

  const profileIdSet = new Set(createdProfileIds);
  const profiles = dbClient
    .list("professionalProfile")
    .filter((row: ProfessionalProfileRecord) => profileIdSet.has(row.id));

  notes.push(
    `requests=${input.requests.length}  profiles_persisted=${results.length}  skipped=${skipped.length}`
  );

  return { profiles, results, skipped, notes };
}
