import type {
  FundingClass,
  StipendPeriod,
  TuitionCoverage
} from "../db";

/**
 * Deterministic funding-class classifier per agents.md §4.6 and §8.
 * Rule order matters: more specific patterns must be matched first.
 *
 * Every positive classification returns the phrases that matched so the
 * agent can pass them through as `taxonomyMatches` on the funding row and
 * attach them to evidence.
 *
 * An LLM fallback is intentionally NOT wired here — per CLAUDE.md §10
 * ("deterministic first, LLM fallback at lower confidence") and agents.md
 * §8 ("deterministic match > LLM inference > guess"). When no pattern
 * matches, we return `unclear` with confidence 0.4 — an LLM fallback can
 * later be slotted in at the agent layer without touching this file.
 */

export interface FundingClassificationInput {
  title: string;
  description: string;
}

export interface FundingClassificationResult {
  fundingClass: FundingClass;
  tuitionCoverage: TuitionCoverage;
  confidence: number;
  matchedPhrases: string[];
  notes: string[];
  stipendAmount: number | null;
  stipendPeriod: StipendPeriod;
  ftePct: number | null;
}

interface Pattern {
  label: string;
  regex: RegExp;
}

interface Rule {
  fundingClass: FundingClass;
  tuitionCoverage: TuitionCoverage;
  confidence: number;
  /**
   * Every pattern in `allOf` must match. `noneOf` must not match. Rules are
   * evaluated top-to-bottom; first matching rule wins.
   */
  allOf: Pattern[];
  noneOf?: Pattern[];
}

const TUITION_FULL: Pattern = {
  label: "tuition_full",
  regex:
    /(full[- ]?tuition|(?<!partial[- ])(?<!reduced\s)(?<!in[- ]state\s)tuition\s*(waiver|remission)|tuition\s*is\s*(fully\s*)?covered|tuition\s*and\s*fees\s*covered|complete\s*tuition\s*coverage)/i
};

const TUITION_PARTIAL: Pattern = {
  label: "tuition_partial",
  regex:
    /(partial[- ]?tuition|in[- ]?state\s*tuition\s*(rate|waiver)|reduced\s*tuition|tuition\s*discount)/i
};

const STIPEND_NEGATED: Pattern = {
  label: "stipend_negated",
  regex:
    /(do(?:es)?\s+not\s+include\s+(?:a\s+)?stipend|no\s+stipend|without\s+(?:a\s+)?stipend|unpaid|stipend\s+is\s+not\s+(?:included|provided))/i
};

const FEE_WAIVER_ONLY: Pattern = {
  label: "fee_waiver",
  regex: /(fee\s*(waiver|reduction)|application\s*fee\s*waived)/i
};

const STIPEND_POSITIVE: Pattern = {
  label: "stipend_positive",
  regex:
    /(stipend|monthly\s*pay|bi[- ]?weekly\s*pay|assistantship\s*pay|hourly\s*rate)/i
};

const CASE_BY_CASE: Pattern = {
  label: "case_by_case",
  regex:
    /(case[- ]by[- ]case|may\s+include|dependent\s+on\s+(funding|availability)|subject\s+to\s+availability|on\s+a\s+competitive\s+basis)/i
};

const GA_TA_RA_ROLE: Pattern = {
  label: "assistantship_role",
  regex: /(graduate\s*(assistant(ship)?|ta|ra)|teaching\s*assistant|research\s*assistant|GTA|GRA|\bGA\b)/i
};

const FELLOWSHIP_FULL: Pattern = {
  label: "fellowship_full",
  regex:
    /(fellowship\s*(includes|provides|covers)\s*(full\s*)?tuition)|(prestigious\s*fellowship)/i
};

const RULES: Rule[] = [
  {
    fundingClass: "partial_tuition",
    tuitionCoverage: "partial",
    confidence: 0.8,
    allOf: [TUITION_PARTIAL]
  },
  {
    fundingClass: "full_tuition_plus_stipend",
    tuitionCoverage: "full",
    confidence: 0.92,
    allOf: [TUITION_FULL, STIPEND_POSITIVE],
    noneOf: [TUITION_PARTIAL, STIPEND_NEGATED]
  },
  {
    fundingClass: "full_tuition_plus_stipend",
    tuitionCoverage: "full",
    confidence: 0.9,
    allOf: [GA_TA_RA_ROLE, TUITION_FULL, STIPEND_POSITIVE],
    noneOf: [TUITION_PARTIAL, STIPEND_NEGATED]
  },
  {
    fundingClass: "full_tuition_plus_stipend",
    tuitionCoverage: "full",
    confidence: 0.88,
    allOf: [FELLOWSHIP_FULL, STIPEND_POSITIVE],
    noneOf: [STIPEND_NEGATED]
  },
  {
    fundingClass: "full_tuition_only",
    tuitionCoverage: "full",
    confidence: 0.82,
    allOf: [TUITION_FULL],
    noneOf: [STIPEND_POSITIVE, TUITION_PARTIAL]
  },
  {
    fundingClass: "stipend_only",
    tuitionCoverage: "none",
    confidence: 0.75,
    allOf: [STIPEND_POSITIVE],
    noneOf: [TUITION_FULL, TUITION_PARTIAL, FEE_WAIVER_ONLY, STIPEND_NEGATED]
  },
  {
    fundingClass: "fee_reduction_only",
    tuitionCoverage: "none",
    confidence: 0.7,
    allOf: [FEE_WAIVER_ONLY],
    noneOf: [TUITION_FULL, TUITION_PARTIAL, STIPEND_POSITIVE]
  },
  {
    fundingClass: "case_by_case",
    tuitionCoverage: "unknown",
    confidence: 0.5,
    allOf: [CASE_BY_CASE]
  }
];

function matchPattern(text: string, pattern: Pattern): string | null {
  const match = pattern.regex.exec(text);

  if (!match) {
    return null;
  }

  return match[0];
}

function extractStipend(
  text: string
): { amount: number | null; period: StipendPeriod; notes: string[] } {
  const notes: string[] = [];
  const amountRegex =
    /\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:\/|per\s*)?\s*(month|monthly|year|annual(?:ly)?|academic\s*year|semester)?/i;
  const match = amountRegex.exec(text);

  if (!match) {
    return { amount: null, period: "unknown", notes };
  }

  const rawAmount = match[1];
  const rawPeriod = (match[2] ?? "").toLowerCase();

  if (!rawAmount) {
    return { amount: null, period: "unknown", notes };
  }

  const amount = Number(rawAmount.replace(/,/g, ""));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { amount: null, period: "unknown", notes };
  }

  let period: StipendPeriod = "unknown";

  if (/monthly|month/.test(rawPeriod)) {
    period = "monthly";
  } else if (/academic\s*year/.test(rawPeriod)) {
    period = "academic_year";
  } else if (/semester/.test(rawPeriod)) {
    period = "per_semester";
  } else if (/annual|year/.test(rawPeriod)) {
    period = "calendar_year";
  } else {
    notes.push(
      `Stipend amount "$${rawAmount}" detected but period unclear — flagged for review.`
    );
  }

  return { amount, period, notes };
}

function extractFtePct(text: string): number | null {
  const pctMatch = /([0-9]{1,3})\s*%\s*(?:FTE|time|appointment)/i.exec(text);

  if (pctMatch?.[1]) {
    const value = Number(pctMatch[1]);

    if (Number.isFinite(value) && value > 0 && value <= 100) {
      return value / 100;
    }
  }

  const halfMatch = /\b(half|quarter|full)[- ]?time\b/i.exec(text);

  if (halfMatch?.[1]) {
    const label = halfMatch[1].toLowerCase();

    if (label === "half") {
      return 0.5;
    }

    if (label === "quarter") {
      return 0.25;
    }

    if (label === "full") {
      return 1.0;
    }
  }

  return null;
}

export function classifyFunding(
  input: FundingClassificationInput
): FundingClassificationResult {
  const text = `${input.title}\n${input.description}`;
  const stipend = extractStipend(text);
  const ftePct = extractFtePct(text);

  for (const rule of RULES) {
    const matched: string[] = [];
    let allMatched = true;

    for (const pattern of rule.allOf) {
      const hit = matchPattern(text, pattern);

      if (!hit) {
        allMatched = false;
        break;
      }

      matched.push(`${pattern.label}:"${hit}"`);
    }

    if (!allMatched) {
      continue;
    }

    if (rule.noneOf?.some((pattern) => matchPattern(text, pattern) !== null)) {
      continue;
    }

    return {
      fundingClass: rule.fundingClass,
      tuitionCoverage: rule.tuitionCoverage,
      confidence: rule.confidence,
      matchedPhrases: matched,
      notes: stipend.notes,
      stipendAmount: stipend.amount,
      stipendPeriod: stipend.period,
      ftePct
    };
  }

  return {
    fundingClass: "unclear",
    tuitionCoverage: "unknown",
    confidence: 0.4,
    matchedPhrases: [],
    notes: [
      "No deterministic funding phrase matched — classifier returned `unclear`. LLM fallback is intentionally not wired in this slice.",
      ...stipend.notes
    ],
    stipendAmount: stipend.amount,
    stipendPeriod: stipend.period,
    ftePct
  };
}
