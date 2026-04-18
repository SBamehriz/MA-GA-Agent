import { claim, paragraph, ref, refs, section } from "../claims";
import type {
  Section,
  WritingDocumentRequest,
  WritingProfileContext,
  WritingTargetContext
} from "../types";
import { profileValue } from "./helpers";

/**
 * First scaffolding for tailored-resume output. Intentionally minimal per
 * the task spec: a structured outline — not a finished resume. Each
 * resume bullet is still a grounded Claim with refs back to the verified
 * story / attested profile field that supports it.
 *
 * Later blocks can: render this outline to LaTeX / DOCX, inject layout,
 * and produce a full resume file. For now the outline is the artifact.
 */
export function buildResumeTailoringSections(
  _request: WritingDocumentRequest,
  profile: WritingProfileContext,
  target: WritingTargetContext
): Section[] {
  const fullName = profile.attestedFieldsByKey.get("full_name");
  const primaryEmail = profile.attestedFieldsByKey.get("primary_email");
  const undergradInstitution = profile.attestedFieldsByKey.get("undergraduate_institution");
  const undergradDegree = profile.attestedFieldsByKey.get("undergraduate_degree");
  const undergradGpa = profile.attestedFieldsByKey.get("undergraduate_gpa");
  const graduationYear = profile.attestedFieldsByKey.get("graduation_year");
  const targetFocus = profile.attestedFieldsByKey.get("target_focus_areas");

  const header = paragraph(null, [
    fullName
      ? claim({
          kind: "factual_profile",
          text: `# ${profileValue(fullName)}`,
          refs: [ref("profile_field", fullName.id)],
          slotTag: "resume_header_name"
        })
      : null,
    primaryEmail
      ? claim({
          kind: "factual_profile",
          text: profileValue(primaryEmail),
          refs: [ref("profile_field", primaryEmail.id)],
          slotTag: "resume_header_contact"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  const education = paragraph(null, [
    undergradInstitution && undergradDegree
      ? claim({
          kind: "factual_profile",
          text: `${profileValue(undergradDegree)}, ${profileValue(undergradInstitution)}${
            graduationYear ? ` (${profileValue(graduationYear)})` : ""
          }${undergradGpa ? ` — GPA ${profileValue(undergradGpa)}` : ""}.`,
          refs: refs(
            ref("profile_field", undergradInstitution.id),
            ref("profile_field", undergradDegree.id),
            graduationYear ? ref("profile_field", graduationYear.id) : null,
            undergradGpa ? ref("profile_field", undergradGpa.id) : null
          ),
          slotTag: "resume_education_entry"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  const tailoringClaims = [
    claim({
      kind: "factual_program",
      text: `Tailored for the ${target.program.title} at ${target.university.canonicalName}.`,
      refs: [ref("program", target.program.id)],
      slotTag: "resume_tailoring_target"
    }),
    targetFocus
      ? claim({
          kind: "factual_profile",
          text: `Emphasis: ${profileValue(targetFocus)}.`,
          refs: [ref("profile_field", targetFocus.id)],
          slotTag: "resume_tailoring_focus"
        })
      : null,
    target.personRole
      ? claim({
          kind: "factual_contact",
          text: `Secondary emphasis: alignment with ${target.personRole.roleTitle}${
            target.personRole.researchAreas.length > 0
              ? ` (${target.personRole.researchAreas.slice(0, 2).join(", ")})`
              : ""
          }.`,
          refs: [ref("person_role", target.personRole.id)],
          slotTag: "resume_tailoring_role"
        })
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const tailoringParagraph = paragraph(null, tailoringClaims);

  const experienceParagraphs = profile.verifiedStories.map((story, index) =>
    paragraph(null, [
      claim({
        kind: "narrative",
        text: `- **${story.title}.** ${story.summary}`,
        refs: [ref("story", story.id)],
        slotTag: `resume_experience_${index + 1}_header`
      }),
      ...story.proof_points.map((proof, proofIndex) =>
        claim({
          kind: "narrative",
          text: `  - ${proof}`,
          refs: [ref("story", story.id)],
          slotTag: `resume_experience_${index + 1}_bullet_${proofIndex + 1}`
        })
      )
    ])
  );

  return [
    section("header", "Header", [header]),
    section("education", "Education", [education]),
    section("tailoring", "Tailoring summary", [tailoringParagraph]),
    section("experience", "Selected experience & projects", experienceParagraphs)
  ];
}
