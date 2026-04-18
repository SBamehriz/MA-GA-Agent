import { dbClient } from "../db/client";

import { WritingResourceError } from "./resources";
import type { WritingDocumentRequest, WritingTargetContext } from "./types";

/**
 * Loads the "target" side of a writing request — the external-world
 * opportunity the document is directed at. All fields are evidence-backed
 * per the research sweep integration audit (CLAUDE.md §8 invariant 4).
 *
 * Throws WritingResourceError with a specific `code` if a referenced row
 * does not exist so the harness/client can surface a concrete reason.
 */
export function loadWritingTargetContext(
  request: WritingDocumentRequest
): WritingTargetContext {
  const university = dbClient.get("university", request.universityId);
  if (!university) {
    throw new WritingResourceError(
      "missing_university",
      `WritingAgent cannot load target: university ${request.universityId} not found.`
    );
  }

  const program = dbClient.get("graduateProgram", request.programId);
  if (!program) {
    throw new WritingResourceError(
      "missing_program",
      `WritingAgent cannot load target: graduate program ${request.programId} not found.`
    );
  }
  if (program.universityId !== university.id) {
    throw new WritingResourceError(
      "program_university_mismatch",
      `Program ${program.id} belongs to ${program.universityId}, not target university ${university.id}.`
    );
  }

  const funding = request.fundingId
    ? dbClient.get("fundingOpportunity", request.fundingId) ?? null
    : null;
  if (request.fundingId && !funding) {
    throw new WritingResourceError(
      "missing_funding",
      `WritingAgent cannot load target: funding opportunity ${request.fundingId} not found.`
    );
  }

  const personRole = request.personRoleId
    ? dbClient.get("personRole", request.personRoleId) ?? null
    : null;
  if (request.personRoleId && !personRole) {
    throw new WritingResourceError(
      "missing_person_role",
      `WritingAgent cannot load target: person_role ${request.personRoleId} not found.`
    );
  }

  const person = personRole
    ? dbClient.get("person", personRole.personId) ?? null
    : null;

  const professionalProfile = request.professionalProfileId
    ? dbClient.get("professionalProfile", request.professionalProfileId) ?? null
    : null;
  if (request.professionalProfileId && !professionalProfile) {
    throw new WritingResourceError(
      "missing_professional_profile",
      `WritingAgent cannot load target: professional_profile ${request.professionalProfileId} not found.`
    );
  }

  return {
    university,
    program,
    funding,
    personRole,
    person,
    professionalProfile
  };
}
