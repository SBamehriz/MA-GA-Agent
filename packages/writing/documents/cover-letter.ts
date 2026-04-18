import { claim, paragraph, ref, refs, section } from "../claims";
import type {
  Section,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingTargetContext
} from "../types";
import { profileValue, summaryAsSentence, topStoriesByThemes } from "./helpers";

/**
 * Deterministic cover-letter skeleton for a specific funding opportunity
 * (typically a GA / TA / RA posting). Requires:
 *   - a named recipient (person_role) — critic will block otherwise,
 *   - a target funding opportunity with evidence,
 *   - at least one verified story whose themes overlap with the role.
 *
 * No outreach is ever sent from this slice (CLAUDE.md §8 invariant 3);
 * this template produces a prepared draft only.
 */
export function buildCoverLetterSections(
  _request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): Section[] {
  const fullName = profile.attestedFieldsByKey.get("full_name");
  const primaryEmail = profile.attestedFieldsByKey.get("primary_email");
  const targetDegree = profile.attestedFieldsByKey.get("target_degree");
  const targetIntake = profile.attestedFieldsByKey.get("target_intake");

  const roleThemes = target.personRole?.researchAreas ?? [];
  const programThemes = [
    target.program.concentration ?? "",
    ...target.program.keywordHits
  ].filter((theme) => theme.length > 0);

  const story =
    topStoriesByThemes(profile.verifiedStories, [...roleThemes, ...programThemes], 1)[0] ?? null;

  const addressBlock = paragraph(null, [
    target.personRole
      ? claim({
          kind: "factual_contact",
          text: `Dear ${target.person?.canonicalName ?? target.personRole.roleTitle},`,
          refs: refs(
            ref("person_role", target.personRole.id),
            target.person ? ref("person", target.person.id) : null
          ),
          slotTag: "address_greeting"
        })
      : claim({
          kind: "stylistic",
          text: "Dear Hiring Committee,",
          slotTag: "address_greeting_generic"
        })
  ]);

  const openingClaims = [
    claim({
      kind: "voice_stylistic",
      text: "I am writing in plain sentences because I want the ask to be easy to check.",
      refs: [ref("voice_anchor", profile.voiceAnchor.id)],
      slotTag: "opening_voice"
    }),
    target.funding
      ? claim({
          kind: "factual_funding",
          text: `I am applying to the ${target.funding.title} at ${target.university.canonicalName}.`,
          refs: [ref("funding", target.funding.id)],
          slotTag: "opening_funding_target"
        })
      : null,
    claim({
      kind: "factual_profile",
      text: `I am ${profileValue(fullName)}, a candidate for the ${target.program.title}${
        targetIntake ? ` starting ${profileValue(targetIntake)}` : ""
      }.`,
      refs: refs(
        fullName ? ref("profile_field", fullName.id) : null,
        targetIntake ? ref("profile_field", targetIntake.id) : null
      ),
      slotTag: "opening_identity"
    }),
    claim({
      kind: "factual_program",
      text: `The ${target.program.title} concentration is ${target.program.concentration ?? "aligned with my research direction"}, which is what made this funding route the right one to pursue.`,
      refs: [ref("program", target.program.id)],
      slotTag: "opening_program_tie"
    })
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const bodyClaims = [
    target.personRole
      ? claim({
          kind: "factual_contact",
          text: `I am specifically interested in working with the ${target.personRole.roleTitle}${
            target.personRole.researchAreas.length > 0
              ? ` on ${target.personRole.researchAreas.slice(0, 3).join(", ")}`
              : ""
          }.`,
          refs: [ref("person_role", target.personRole.id)],
          slotTag: "body_role_fit"
        })
      : null,
    story
      ? claim({
          kind: "narrative",
          text: summaryAsSentence(story.summary),
          refs: [ref("story", story.id)],
          slotTag: "body_story_summary"
        })
      : null,
    story && story.proof_points[0]
      ? claim({
          kind: "narrative",
          text: summaryAsSentence(story.proof_points[0]),
          refs: [ref("story", story.id)],
          slotTag: "body_story_proof"
        })
      : null,
    target.professionalProfile
      ? claim({
          kind: "factual_contact",
          text: `I have read the group's public work and it is directly connected to the problem I just described.`,
          refs: [ref("professional_profile", target.professionalProfile.id)],
          slotTag: "body_profile_tie"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const askClaims = [
    claim({
      kind: "factual_program",
      text: `I would like to be considered for this assistantship in tandem with my ${target.program.title} application.`,
      refs: [ref("program", target.program.id)],
      slotTag: "ask_program_tie"
    }),
    target.funding
      ? claim({
          kind: "factual_funding",
          text: `I can commit to the funding's time expectation as described on the posting.`,
          refs: [ref("funding", target.funding.id)],
          slotTag: "ask_commitment"
        })
      : null,
    claim({
      kind: "factual_profile",
      text: `I can be reached at ${profileValue(primaryEmail)}.`,
      refs: refs(primaryEmail ? ref("profile_field", primaryEmail.id) : null),
      slotTag: "ask_contact"
    }),
    claim({
      kind: "factual_profile",
      text: `Thank you for considering this application for ${profileValue(targetDegree) || "the MS program"}.`,
      refs: refs(targetDegree ? ref("profile_field", targetDegree.id) : null),
      slotTag: "ask_close"
    })
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return [
    section("address", "", [addressBlock]),
    section("opening", "", [paragraph(null, openingClaims)]),
    section("body", "", [paragraph(null, bodyClaims)]),
    section("ask", "", [paragraph(null, askClaims)])
  ];
}
