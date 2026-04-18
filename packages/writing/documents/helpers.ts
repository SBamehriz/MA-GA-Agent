import type { VerifiedStoryRecord } from "../../agents/types";
import type { JsonValue, ProfileFieldRecord } from "../../db/schema";

export function stringifyProfileValue(value: JsonValue): string {
  if (value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyProfileValue(entry)).filter(Boolean).join(", ");
  }
  return JSON.stringify(value);
}

export function profileValue(
  field: ProfileFieldRecord | null | undefined
): string {
  if (!field) {
    return "";
  }
  return stringifyProfileValue(field.value);
}

export interface StoryRelevanceScore {
  story: VerifiedStoryRecord;
  score: number;
}

export function scoreStoriesByThemes(
  stories: readonly VerifiedStoryRecord[],
  themes: readonly string[]
): StoryRelevanceScore[] {
  const lowered = themes.map((theme) => theme.toLowerCase());
  return stories
    .map((story) => {
      const pool = [
        ...story.themes.map((theme) => theme.toLowerCase()),
        story.title.toLowerCase(),
        story.summary.toLowerCase()
      ];
      let score = 0;
      for (const theme of lowered) {
        for (const candidate of pool) {
          if (candidate.includes(theme)) {
            score += 1;
            break;
          }
        }
      }
      return { story, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function topStoriesByThemes(
  stories: readonly VerifiedStoryRecord[],
  themes: readonly string[],
  count: number
): VerifiedStoryRecord[] {
  const scored = scoreStoriesByThemes(stories, themes);
  const top = scored.slice(0, count).map((entry) => entry.story);
  if (top.length < count) {
    for (const story of stories) {
      if (top.includes(story)) continue;
      top.push(story);
      if (top.length >= count) break;
    }
  }
  return top;
}

export function summaryAsSentence(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}
