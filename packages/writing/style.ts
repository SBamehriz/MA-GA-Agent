import type { StyleReport, WritingProfileContext } from "./types";

/**
 * Deterministic style-check.
 *
 * The voice anchor is authoritative for tone per agents.md §4.13. Rather than
 * asking an LLM to "sound like the user", we extract measurable signals from
 * the anchor and require the draft to stay inside a neighborhood of them.
 *
 * Signals:
 *   - mean sentence length (characters in words) within ±6 words of anchor
 *   - first-person ratio ≥ 0.5 of anchor's (avoid third-person drift)
 *   - zero banned hype phrases (generic "world-class", "passionate", etc.)
 *
 * These are cheap and boring on purpose. The next block can layer an LLM
 * critic on top; for now we don't ship style heuristics we can't explain.
 */
const BANNED_PHRASES: readonly string[] = [
  "world-class",
  "world class",
  "revolutionary",
  "passionate about",
  "i am passionate",
  "cutting-edge",
  "cutting edge",
  "game-changing",
  "game changing",
  "synergy",
  "leverage synergies",
  "best of the best",
  "rockstar",
  "ninja",
  "guru"
];

const FIRST_PERSON_TOKENS: readonly string[] = [
  "i ",
  "i'm",
  "im ",
  "my ",
  "mine ",
  "myself",
  "me ",
  "we ",
  "our "
];

const MAX_SENTENCE_LENGTH_DELTA = 6;
const MIN_FIRST_PERSON_RATIO_FLOOR = 0.05;

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function meanWordsPerSentence(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return 0;
  }
  const totalWords = sentences
    .map((sentence) => sentence.split(/\s+/).filter((word) => word.length > 0).length)
    .reduce((acc, count) => acc + count, 0);
  return totalWords / sentences.length;
}

function firstPersonRatio(text: string): number {
  const lowered = ` ${text.toLowerCase()} `;
  const words = lowered.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return 0;
  }

  let hits = 0;
  for (const token of FIRST_PERSON_TOKENS) {
    const needle = token.endsWith(" ") ? token : `${token} `;
    let index = lowered.indexOf(needle);
    while (index !== -1) {
      hits += 1;
      index = lowered.indexOf(needle, index + needle.length);
    }
  }
  return hits / words.length;
}

function scanBannedPhrases(text: string): StyleReport["bannedPhraseHits"] {
  const lowered = text.toLowerCase();
  const hits: StyleReport["bannedPhraseHits"] = [];
  for (const phrase of BANNED_PHRASES) {
    const needle = phrase.toLowerCase();
    let count = 0;
    let index = lowered.indexOf(needle);
    while (index !== -1) {
      count += 1;
      index = lowered.indexOf(needle, index + needle.length);
    }
    if (count > 0) {
      hits.push({ phrase, count });
    }
  }
  return hits;
}

export function runStyleCheck(
  text: string,
  profile: WritingProfileContext
): StyleReport {
  const voiceAnchor = profile.voiceAnchor;
  const anchorText = voiceAnchor.sampleText;

  const anchorMean = meanWordsPerSentence(anchorText);
  const draftMean = meanWordsPerSentence(text);
  const sentenceLengthDelta = Math.abs(anchorMean - draftMean);

  const anchorFirstPersonRatio = firstPersonRatio(anchorText);
  const draftFirstPersonRatio = firstPersonRatio(text);
  const requiredFirstPersonRatio = Math.max(
    MIN_FIRST_PERSON_RATIO_FLOOR,
    anchorFirstPersonRatio * 0.5
  );

  const bannedPhraseHits = scanBannedPhrases(text);

  const notes: string[] = [];
  if (sentenceLengthDelta > MAX_SENTENCE_LENGTH_DELTA) {
    notes.push(
      `mean sentence length ${draftMean.toFixed(1)} words is ${sentenceLengthDelta.toFixed(
        1
      )} words off voice anchor (${anchorMean.toFixed(1)}); allowed ±${MAX_SENTENCE_LENGTH_DELTA}.`
    );
  }
  if (draftFirstPersonRatio < requiredFirstPersonRatio) {
    notes.push(
      `first-person ratio ${draftFirstPersonRatio.toFixed(
        3
      )} below required ${requiredFirstPersonRatio.toFixed(
        3
      )} (voice anchor ratio ${anchorFirstPersonRatio.toFixed(3)}).`
    );
  }
  if (bannedPhraseHits.length > 0) {
    const summary = bannedPhraseHits
      .map((hit) => `"${hit.phrase}" (${hit.count})`)
      .join(", ");
    notes.push(`banned hype phrases present: ${summary}`);
  }

  const passed = notes.length === 0;
  return {
    voiceAnchorId: voiceAnchor.id,
    meanSentenceLength: roundTo(draftMean, 2),
    voiceAnchorMeanSentenceLength: roundTo(anchorMean, 2),
    sentenceLengthDelta: roundTo(sentenceLengthDelta, 2),
    firstPersonRatio: roundTo(draftFirstPersonRatio, 4),
    bannedPhraseHits,
    passed,
    notes
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
