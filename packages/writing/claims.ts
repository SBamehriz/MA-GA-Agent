import type {
  Claim,
  ClaimKind,
  ClaimRef,
  ClaimRefType,
  Paragraph,
  Section
} from "./types";

let counter = 0;

function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

export function resetClaimIdCounter(): void {
  counter = 0;
}

export function ref(type: ClaimRefType, id: string): ClaimRef {
  return { type, id };
}

export function refs(...entries: Array<ClaimRef | null | undefined | false>): ClaimRef[] {
  return entries.filter((entry): entry is ClaimRef => Boolean(entry));
}

export interface ClaimInput {
  kind: ClaimKind;
  text: string;
  refs?: ClaimRef[];
  slotTag: string;
}

export function claim(input: ClaimInput): Claim {
  return {
    id: nextId("claim"),
    kind: input.kind,
    text: normalizeClaimText(input.text),
    refs: [...(input.refs ?? [])],
    slotTag: input.slotTag
  };
}

export function paragraph(heading: string | null, claims: Claim[]): Paragraph {
  return { id: nextId("para"), heading, claims };
}

export function section(id: string, title: string, paragraphs: Paragraph[]): Section {
  return { id, title, paragraphs };
}

function normalizeClaimText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function renderParagraph(paragraph: Paragraph): string {
  return paragraph.claims
    .map((claim) => claim.text.trim())
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();
}

export function renderSections(sections: readonly Section[]): string {
  const lines: string[] = [];

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      lines.push("");
    }

    if (section.title) {
      lines.push(`## ${section.title}`);
      lines.push("");
    }

    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraph.heading) {
        lines.push(`**${paragraph.heading}**`);
        lines.push("");
      }
      const text = renderParagraph(paragraph);
      if (text) {
        lines.push(text);
        if (paragraphIndex < section.paragraphs.length - 1) {
          lines.push("");
        }
      }
    });
  });

  return lines.join("\n").trim();
}

export function flattenClaims(sections: readonly Section[]): Claim[] {
  const result: Claim[] = [];
  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      for (const claim of paragraph.claims) {
        result.push(claim);
      }
    }
  }
  return result;
}

const VERIFIABLE_KINDS: ReadonlySet<ClaimKind> = new Set([
  "narrative",
  "factual_profile",
  "factual_program",
  "factual_funding",
  "factual_contact",
  "factual_university"
]);

export function isVerifiableClaim(claim: Claim): boolean {
  return VERIFIABLE_KINDS.has(claim.kind);
}

export function claimKindExpectsRefType(
  kind: ClaimKind
): ClaimRefType[] {
  switch (kind) {
    case "narrative":
      return ["story"];
    case "factual_profile":
      return ["profile_field", "source_document"];
    case "factual_program":
      return ["program"];
    case "factual_funding":
      return ["funding"];
    case "factual_contact":
      return ["person_role", "professional_profile", "person"];
    case "factual_university":
      return ["university"];
    case "voice_stylistic":
      return ["voice_anchor"];
    case "stylistic":
      return [];
  }
}
