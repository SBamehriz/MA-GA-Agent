import { claim, paragraph, ref, section } from "../claims";
import type {
  Section,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingTargetContext
} from "../types";
import { profileValue, summaryAsSentence, topStoriesByThemes } from "./helpers";

/**
 * Deterministic short-answer skeleton.
 *
 * The prompt itself is echoed as a stylistic header (not a claim) so the
 * reader knows what is being answered. The body is built from at most one
 * verified story and one attested profile-field citation. Word limits are
 * enforced by the critic, not truncated here: the drafter's job is to
 * stay terse, and if the template overshoots we want the critic to flag it
 * so a future rewrite pass (or the user) can tighten it.
 */
export function buildShortAnswerSections(
  request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): Section[] {
  const focus = profile.attestedFieldsByKey.get("target_focus_areas");
  const motivation = profile.attestedFieldsByKey.get("motivation_statement");

  const programThemes = [
    target.program.concentration ?? "",
    ...target.program.keywordHits
  ].filter((theme) => theme.length > 0);
  const story = topStoriesByThemes(profile.verifiedStories, programThemes, 1)[0] ?? null;

  const sections: Section[] = [];

  const promptClaim = request.prompt
    ? claim({
        kind: "stylistic",
        text: `_Prompt_: ${request.prompt.trim()}`,
        slotTag: "prompt_echo"
      })
    : null;

  const openingClaims = [
    claim({
      kind: "voice_stylistic",
      text: "I will answer plainly, with specifics that are checkable.",
      refs: [ref("voice_anchor", profile.voiceAnchor.id)],
      slotTag: "opening_voice"
    }),
    focus
      ? claim({
          kind: "factual_profile",
          text: `The research problem I want to work on sits inside ${profileValue(focus)}.`,
          refs: [ref("profile_field", focus.id)],
          slotTag: "opening_focus"
        })
      : null,
    claim({
      kind: "factual_program",
      text: `The ${target.program.title} is exactly where that problem lives in coursework and faculty research.`,
      refs: [ref("program", target.program.id)],
      slotTag: "opening_program_hook"
    })
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const body = paragraph(
    null,
    [
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
      motivation
        ? claim({
            kind: "factual_profile",
            text: summaryAsSentence(profileValue(motivation)),
            refs: [ref("profile_field", motivation.id)],
            slotTag: "body_motivation"
          })
        : null
    ].filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  );

  const closing = paragraph(null, [
    claim({
      kind: "factual_program",
      text: `That is the scoped experiment I would want to continue inside the ${target.program.title}.`,
      refs: [ref("program", target.program.id)],
      slotTag: "closing_program_return"
    })
  ]);

  const openerParagraph = paragraph(null, openingClaims);

  sections.push(section("prompt", "Prompt", promptClaim ? [paragraph(null, [promptClaim])] : []));
  sections.push(section("body", "Response", [openerParagraph, body, closing]));

  return sections;
}
