export type ResponseStyle = "one-word" | "brief" | "detailed" | "default";

const ONE_WORD_PATTERNS = [
  /\bin one word\b/i,
  /\bone[\s-]?word(?:\s+only)?\b/i,
  /\bdefine in one (?:line|sentence)\b/i,
  /\bone[\s-]?line definition\b/i,
  /\bjust one (?:word|line)\b/i,
];

const BRIEF_PATTERNS = [
  /\bbriefly\b/i,
  /\bin brief\b/i,
  /\bshort answer\b/i,
  /\bkeep it short\b/i,
  /\bsummarize briefly\b/i,
  /\bquick answer\b/i,
  /\btl;?dr\b/i,
];

const DETAILED_PATTERNS = [
  /\bin detail\b/i,
  /\bdetailed(?:\s+answer|\s+explanation)?\b/i,
  /\bexplain fully\b/i,
  /\bcomprehensive(?:\s+answer)?\b/i,
  /\belaborate\b/i,
  /\bfull explanation\b/i,
];

const STYLE_PHRASE =
  /\s*[,.]?\s*(?:please\s+)?(?:answer\s+)?(?:in one word|one[\s-]?word(?:\s+only)?|briefly|in brief|short answer|keep it short|in detail|detailed(?:\s+answer)?|explain fully|comprehensive(?:\s+answer)?|elaborate)\s*[?.!]?\s*$/i;

export function parseResponseStyle(rawQuery: string): {
  style: ResponseStyle;
  coreQuery: string;
} {
  const query = rawQuery.trim();
  let style: ResponseStyle = "default";

  if (ONE_WORD_PATTERNS.some((p) => p.test(query))) {
    style = "one-word";
  } else if (BRIEF_PATTERNS.some((p) => p.test(query))) {
    style = "brief";
  } else if (DETAILED_PATTERNS.some((p) => p.test(query))) {
    style = "detailed";
  }

  const coreQuery = query.replace(STYLE_PHRASE, "").trim() || query;
  return { style, coreQuery };
}

export function responseStyleLabel(style: ResponseStyle): string | null {
  switch (style) {
    case "one-word":
      return "One line";
    case "brief":
      return "Brief";
    case "detailed":
      return "Detailed";
    default:
      return null;
  }
}

export function getStyleInstructions(style: ResponseStyle): string {
  switch (style) {
    case "one-word":
      return `
LENGTH: ONE LINE ONLY
  • Give exactly ONE short sentence (max 20 words) — a crisp definition or direct answer.
  • No bullet points. No sub-sections. No preamble.
  • Still use the best available source above; cite it on the Source line only.`;
    case "brief":
      return `
LENGTH: BRIEF
  • Maximum 3 bullet points; each bullet is one short sentence.
  • Pull facts from EVERY relevant section above (document, live API, image) — do not skip a source that applies.
  • Prefer numbers and names from sources over general knowledge.`;
    case "detailed":
      return `
LENGTH: DETAILED
  • Use 5–8 bullet points; add sub-bullets when comparing sources or listing steps.
  • Synthesize document, live API, and image data where all apply.
  • Include context, caveats, and practical implications.`;
    default:
      return `
LENGTH: STANDARD
  • Answer directly; use plain bullet points starting with "- " when listing facts.
  • Keep answers focused; use sub-bullets only when comparing multiple sources.`;
  }
}
