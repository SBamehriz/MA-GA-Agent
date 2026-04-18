import { claim, paragraph, ref, refs, section } from "../claims";
import type {
  Section,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingTargetContext
} from "../types";
import { profileValue, summaryAsSentence, topStoriesByThemes } from "./helpers";

/**
 * Deterministic Personal Statement skeleton. Shorter and more biographical
 * than SOP; still fully grounded in attested profile fields + verified
 * stories + voice anchor, and still cites program/university to avoid a
 * generic essay.
 */
export function buildPersonalStatementSections(
  _request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): Section[] {
  const fullName = profile.attestedFieldsByKey.get("full_name");
  const motivation = profile.attestedFieldsByKey.get("motivation_statement");
  const undergradInstitution = profile.attestedFieldsByKey.get("undergraduate_institution");
  const targetFocus = profile.attestedFieldsByKey.get("target_focus_areas");

  const programThemes = [
    target.program.concentration ?? "",
    ...target.program.keywordHits
  ].filter((theme) => theme.length > 0);
  const story = topStoriesByThemes(profile.verifiedStories, programThemes, 1)[0] ?? null;

  const opening = paragraph(null, [
    claim({
      kind: "voice_stylistic",
      text: "I write about my own work the way I think about it: one argument per paragraph, nothing said that cannot be shown.",
      refs: [ref("voice_anchor", profile.voiceAnchor.id)],
      slotTag: "ps_opening_voice"
    }),
    claim({
      kind: "factual_profile",
      text: `My name is ${profileValue(fullName)}, and my path to the ${target.program.title} started with small, concrete projects that forced me to be specific about what I actually changed.`,
      refs: refs(fullName ? ref("profile_field", fullName.id) : null),
      slotTag: "ps_opening_identity"
    })
  ]);

  const middle = paragraph(null, [
    undergradInstitution
      ? claim({
          kind: "factual_profile",
          text: `I trained at ${profileValue(undergradInstitution)}, and the projects that stuck with me were the ones where I had to defend the choices I made.`,
          refs: [ref("profile_field", undergradInstitution.id)],
          slotTag: "ps_background"
        })
      : null,
    story
      ? claim({
          kind: "narrative",
          text: summaryAsSentence(story.summary),
          refs: [ref("story", story.id)],
          slotTag: "ps_story"
        })
      : null,
    story && story.proof_points[0]
      ? claim({
          kind: "narrative",
          text: summaryAsSentence(story.proof_points[0]),
          refs: [ref("story", story.id)],
          slotTag: "ps_story_proof"
        })
      : null,
    motivation
      ? claim({
          kind: "factual_profile",
          text: summaryAsSentence(profileValue(motivation)),
          refs: [ref("profile_field", motivation.id)],
          slotTag: "ps_motivation"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  const closing = paragraph(null, [
    targetFocus
      ? claim({
          kind: "factual_profile",
          text: `The next two years are about focused work on ${profileValue(targetFocus)}.`,
          refs: [ref("profile_field", targetFocus.id)],
          slotTag: "ps_focus"
        })
      : null,
    claim({
      kind: "factual_program",
      text: `The ${target.program.title} is where that kind of scoped, checkable work lives.`,
      refs: [ref("program", target.program.id)],
      slotTag: "ps_program_return"
    }),
    claim({
      kind: "factual_university",
      text: `That is why I am applying to ${target.university.canonicalName}.`,
      refs: [ref("university", target.university.id)],
      slotTag: "ps_university_return"
    })
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  return [section("body", "Personal statement", [opening, middle, closing])];
}
