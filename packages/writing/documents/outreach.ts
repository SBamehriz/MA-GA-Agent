import { claim, paragraph, ref, refs, section } from "../claims";
import type {
  Section,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingTargetContext
} from "../types";
import { profileValue, summaryAsSentence, topStoriesByThemes } from "./helpers";

/**
 * Deterministic outreach-message skeleton. Per agents.md §4.16 outreach
 * sending is DISABLED in the MVP; this template produces a prepared draft
 * only, with a named recipient (person_role) and one clear ask.
 *
 * Length target ≤180 words (critic does not enforce here; harness does).
 */
export function buildOutreachSections(
  _request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): Section[] {
  const fullName = profile.attestedFieldsByKey.get("full_name");
  const targetFocus = profile.attestedFieldsByKey.get("target_focus_areas");

  const roleThemes = target.personRole?.researchAreas ?? [];
  const story = topStoriesByThemes(profile.verifiedStories, roleThemes, 1)[0] ?? null;

  const salutation = paragraph(null, [
    target.personRole
      ? claim({
          kind: "factual_contact",
          text: `Hi ${target.person?.canonicalName ?? target.personRole.roleTitle},`,
          refs: refs(
            ref("person_role", target.personRole.id),
            target.person ? ref("person", target.person.id) : null
          ),
          slotTag: "outreach_salutation"
        })
      : claim({
          kind: "stylistic",
          text: "Hi,",
          slotTag: "outreach_salutation_generic"
        })
  ]);

  const opener = paragraph(null, [
    claim({
      kind: "factual_profile",
      text: `I'm ${profileValue(fullName)}, applying to the ${target.program.title} at ${target.university.canonicalName}.`,
      refs: refs(fullName ? ref("profile_field", fullName.id) : null),
      slotTag: "outreach_opener_identity"
    }),
    claim({
      kind: "factual_program",
      text: `I'm writing because the program's direction${target.program.concentration ? ` in ${target.program.concentration}` : ""} maps onto the problems I want to work on next.`,
      refs: [ref("program", target.program.id)],
      slotTag: "outreach_opener_program"
    })
  ]);

  const body = paragraph(null, [
    story
      ? claim({
          kind: "narrative",
          text: summaryAsSentence(story.summary),
          refs: [ref("story", story.id)],
          slotTag: "outreach_body_story"
        })
      : null,
    targetFocus
      ? claim({
          kind: "factual_profile",
          text: `What I want to continue in a Master's program sits inside ${profileValue(targetFocus)}.`,
          refs: [ref("profile_field", targetFocus.id)],
          slotTag: "outreach_body_focus"
        })
      : null,
    target.personRole
      ? claim({
          kind: "factual_contact",
          text: `Your work in ${target.personRole.researchAreas.slice(0, 2).join(", ") || "these areas"} is part of why I am applying here.`,
          refs: [ref("person_role", target.personRole.id)],
          slotTag: "outreach_body_role_tie"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  const ask = paragraph(null, [
    claim({
      kind: "voice_stylistic",
      text: "One quick ask: would you be open to a 15-minute conversation about group fit for a research-track MS?",
      refs: [ref("voice_anchor", profile.voiceAnchor.id)],
      slotTag: "outreach_ask_question"
    }),
    claim({
      kind: "factual_profile",
      text: `Happy to share materials in advance if useful.`,
      refs: refs(fullName ? ref("profile_field", fullName.id) : null),
      slotTag: "outreach_ask_followup"
    })
  ]);

  return [section("message", "", [salutation, opener, body, ask])];
}
