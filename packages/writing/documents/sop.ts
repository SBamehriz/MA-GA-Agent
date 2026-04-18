import { claim, paragraph, ref, refs, section } from "../claims";
import type {
  Section,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingTargetContext
} from "../types";
import { profileValue, summaryAsSentence, topStoriesByThemes } from "./helpers";

/**
 * Deterministic Statement of Purpose skeleton.
 *
 * Structure (agents.md §4.13 "templated skeleton with agentic personalization"):
 *   1. Opening — voice anchor line + motivation profile field + target degree/intake
 *   2. Research background — two top verified stories whose themes overlap
 *      with the program's concentration / keyword hits
 *   3. Program fit — program relevance + university + (optional) PI role
 *   4. Funding / ask — (optional) funding opportunity grounding + close
 *
 * Every factual claim carries its ref[] so grounding.ts can verify it.
 */
export function buildSopSections(
  _request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): Section[] {
  const motivation = profile.attestedFieldsByKey.get("motivation_statement");
  const targetDegree = profile.attestedFieldsByKey.get("target_degree");
  const targetIntake = profile.attestedFieldsByKey.get("target_intake");
  const targetFocus = profile.attestedFieldsByKey.get("target_focus_areas");
  const fullName = profile.attestedFieldsByKey.get("full_name");
  const undergraduateInstitution = profile.attestedFieldsByKey.get(
    "undergraduate_institution"
  );
  const undergraduateDegree = profile.attestedFieldsByKey.get("undergraduate_degree");
  const undergraduateGpa = profile.attestedFieldsByKey.get("undergraduate_gpa");

  const programThemes = [
    target.program.concentration ?? "",
    ...target.program.keywordHits,
    ...(target.personRole?.researchAreas ?? [])
  ].filter((theme) => theme.length > 0);

  const stories = topStoriesByThemes(profile.verifiedStories, programThemes, 2);

  const opening = paragraph(null, [
    claim({
      kind: "voice_stylistic",
      text: "I try to write about my work the way I think about it — plainly, and grounded in what I actually built or measured.",
      refs: [ref("voice_anchor", profile.voiceAnchor.id)],
      slotTag: "opening_voice"
    }),
    claim({
      kind: "factual_profile",
      text: `I am ${profileValue(fullName)}, applying to the ${target.program.title} at ${target.university.canonicalName} for ${profileValue(targetIntake) || "the next intake"}.`,
      refs: refs(
        fullName ? ref("profile_field", fullName.id) : null,
        targetIntake ? ref("profile_field", targetIntake.id) : null
      ),
      slotTag: "opening_identity"
    }),
    claim({
      kind: "factual_program",
      text: `The program's concentration in ${target.program.concentration ?? target.program.title} and its ${target.program.relevanceClass}-fit curriculum match where I want to spend the next two years.`,
      refs: [ref("program", target.program.id)],
      slotTag: "opening_program_hook"
    }),
    claim({
      kind: "factual_university",
      text: `${target.university.canonicalName} is where this work lives at the scale I need.`,
      refs: [ref("university", target.university.id)],
      slotTag: "opening_university_hook"
    }),
    claim({
      kind: "factual_profile",
      text: motivation
        ? summaryAsSentence(profileValue(motivation))
        : "I want two focused years to go from enthusiastic researcher to someone who can own a non-trivial project end to end.",
      refs: motivation ? [ref("profile_field", motivation.id)] : [],
      slotTag: "opening_motivation"
    })
  ]);

  const backgroundParagraphs = stories.map((story, index) =>
    paragraph(null, [
      claim({
        kind: "narrative",
        text: `${summaryAsSentence(story.summary)}`,
        refs: [ref("story", story.id)],
        slotTag: `background_story_${index + 1}_summary`
      }),
      ...story.proof_points.slice(0, 2).map((proof, proofIndex) =>
        claim({
          kind: "narrative",
          text: summaryAsSentence(proof),
          refs: [ref("story", story.id)],
          slotTag: `background_story_${index + 1}_proof_${proofIndex + 1}`
        })
      )
    ])
  );

  const credentialClaims = [
    undergraduateInstitution && undergraduateDegree
      ? claim({
          kind: "factual_profile",
          text: `I completed my ${profileValue(undergraduateDegree)} at ${profileValue(undergraduateInstitution)}.`,
          refs: refs(
            ref("profile_field", undergraduateInstitution.id),
            ref("profile_field", undergraduateDegree.id)
          ),
          slotTag: "background_credentials"
        })
      : null,
    undergraduateGpa
      ? claim({
          kind: "factual_profile",
          text: `My cumulative GPA was ${profileValue(undergraduateGpa)}.`,
          refs: [ref("profile_field", undergraduateGpa.id)],
          slotTag: "background_credentials_gpa"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (credentialClaims.length > 0) {
    backgroundParagraphs.unshift(paragraph(null, credentialClaims));
  }

  const fitClaims = [
    claim({
      kind: "factual_program",
      text: `The ${target.program.title} is structured around the coursework and research I want to be inside of: ${target.program.keywordHits.slice(0, 4).join(", ") || "machine learning and related areas"}.`,
      refs: [ref("program", target.program.id)],
      slotTag: "fit_program_curriculum"
    }),
    targetFocus
      ? claim({
          kind: "factual_profile",
          text: `My own focus areas — ${profileValue(targetFocus)} — map directly onto that menu.`,
          refs: [ref("profile_field", targetFocus.id)],
          slotTag: "fit_focus_areas"
        })
      : null,
    target.personRole
      ? claim({
          kind: "factual_contact",
          text: `I am specifically interested in working with ${target.personRole.roleTitle}${
            target.personRole.researchAreas.length > 0
              ? `, whose research in ${target.personRole.researchAreas.slice(0, 3).join(", ")} overlaps with the problems I want to work on`
              : ""
          }.`,
          refs: [ref("person_role", target.personRole.id)],
          slotTag: "fit_pi"
        })
      : null,
    target.professionalProfile
      ? claim({
          kind: "factual_contact",
          text: `Their published work${target.professionalProfile.researchAreaOverlap > 0 ? ` in ${target.personRole?.researchAreas[0] ?? "this area"}` : ""} is part of what convinced me the fit was real.`,
          refs: [ref("professional_profile", target.professionalProfile.id)],
          slotTag: "fit_pi_profile"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const fitParagraph = paragraph(null, fitClaims);

  const closingClaims = [
    target.funding
      ? claim({
          kind: "factual_funding",
          text: `I am also applying to the ${target.funding.title}, which (per its posting) supports this kind of work and is essential to my plan.`,
          refs: [ref("funding", target.funding.id)],
          slotTag: "closing_funding"
        })
      : null,
    claim({
      kind: "voice_stylistic",
      text: "I want the next two years to be focused and checkable, and I want advisors who make room for scope-limited experiments over broad, thin projects.",
      refs: [ref("voice_anchor", profile.voiceAnchor.id)],
      slotTag: "closing_voice"
    }),
    claim({
      kind: "factual_profile",
      text: `I am applying for ${profileValue(targetDegree) || "the MS program"} and I am ready to contribute to the lab on day one.`,
      refs: refs(targetDegree ? ref("profile_field", targetDegree.id) : null),
      slotTag: "closing_ask"
    })
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return [
    section("opening", "Opening", [opening]),
    section("background", "Research background", backgroundParagraphs),
    section("fit", "Why this program", [fitParagraph]),
    section("closing", "Closing", [paragraph(null, closingClaims)])
  ];
}
