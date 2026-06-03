export type SourceRef = { url: string; title?: string; notes?: string[] };

export type ArticleCheckInput = {
  headline?: string | null;
  lede?: string | null;
  body?: string | null;
  template_type?: string | null;
  sources?: SourceRef[] | null;
};

export type Issue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  suggestion: string;
};

export const REQUIRED_HEADINGS = [
  "Background",
  "Key Details",
  "Quotes",
  "Why it matters",
  "Outlook",
] as const;

const MIN_WORDS_BY_TEMPLATE: Record<string, number> = {
  breaking: 450,
  event_preview: 500,
  profile: 800,
  review: 550,
};

const MIN_PARAGRAPHS = 6;
const MIN_QUOTES = 2;

export function countWords(text: string): number {
  return (text.trim().match(/\b[\w'’-]+\b/g) || []).length;
}

export function extractParagraphs(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^#+\s/.test(p));
}

export function findHeadings(body: string): string[] {
  const lines = body.split(/\n/);
  return lines
    .filter((l) => /^#{1,3}\s+\S/.test(l))
    .map((l) => l.replace(/^#+\s+/, "").trim());
}

/**
 * Find quoted strings that look like real article quotes (≥ 4 words, straight or curly quotes)
 * and detect attribution within ~80 chars after the quote.
 */
export function findAttributedQuotes(body: string): { quote: string; attributed: boolean }[] {
  const re = /[“"]([^“”"]{15,400})[”"]/g;
  const verbs = /\b(said|told|confirmed|announced|noted|explained|added|wrote|stated|asked|argued|insisted)\b/i;
  const results: { quote: string; attributed: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const quoteText = m[1].trim();
    if (countWords(quoteText) < 4) continue;
    const tail = body.slice(m.index + m[0].length, m.index + m[0].length + 140);
    const head = body.slice(Math.max(0, m.index - 80), m.index);
    results.push({ quote: quoteText, attributed: verbs.test(tail) || verbs.test(head) });
  }
  return results;
}

export function validateArticle(input: ArticleCheckInput): Issue[] {
  const issues: Issue[] = [];
  const body = (input.body || "").trim();

  if (!input.headline || input.headline.trim().length < 10) {
    issues.push({
      id: "headline",
      severity: "error",
      message: "Headline missing or too short",
      suggestion: "Write a sharp headline of at least 10 characters that leads with the fact.",
    });
  }

  if (!input.lede || input.lede.trim().length < 30) {
    issues.push({
      id: "lede",
      severity: "error",
      message: "Lede missing or too short",
      suggestion: "Open with one sentence (18–22 words) answering: what happened?",
    });
  }

  if (!body) {
    issues.push({ id: "body", severity: "error", message: "Body is empty", suggestion: "Write the full article in the structured template." });
    return issues;
  }

  // Paragraph count
  const paragraphs = extractParagraphs(body);
  if (paragraphs.length < MIN_PARAGRAPHS) {
    issues.push({
      id: "paragraphs",
      severity: "error",
      message: `Only ${paragraphs.length} paragraphs (minimum ${MIN_PARAGRAPHS})`,
      suggestion: `Add ${MIN_PARAGRAPHS - paragraphs.length} more paragraph${MIN_PARAGRAPHS - paragraphs.length === 1 ? "" : "s"} of context, reaction, or background — no filler.`,
    });
  }

  // Word count
  const minWords = MIN_WORDS_BY_TEMPLATE[input.template_type || "breaking"] ?? 450;
  const words = countWords(body);
  if (words < minWords) {
    issues.push({
      id: "wordcount",
      severity: "error",
      message: `Only ${words} words (target ≥ ${minWords})`,
      suggestion: `Expand background, why-it-matters, and outlook sections by about ${minWords - words} words. Do not invent facts.`,
    });
  }

  // Required headings
  const headings = findHeadings(body).map((h) => h.toLowerCase());
  const missingHeadings = REQUIRED_HEADINGS.filter((h) => !headings.some((existing) => existing.includes(h.toLowerCase())));
  for (const h of missingHeadings) {
    issues.push({
      id: `heading-${h}`,
      severity: "error",
      message: `Missing required section: ${h}`,
      suggestion: `Add a "## ${h}" section in its standard position.`,
    });
  }

  // Quote attribution
  const quotes = findAttributedQuotes(body);
  if (quotes.length < MIN_QUOTES) {
    issues.push({
      id: "quotes-count",
      severity: quotes.length === 0 ? "error" : "warning",
      message: `Only ${quotes.length} direct quote${quotes.length === 1 ? "" : "s"} found (minimum ${MIN_QUOTES})`,
      suggestion: `Add ${MIN_QUOTES - quotes.length} more attributed quote${MIN_QUOTES - quotes.length === 1 ? "" : "s"} in the Quotes section, or paraphrase a source with attribution ("…," said Jane Mwangi).`,
    });
  }
  const unattributed = quotes.filter((q) => !q.attributed);
  for (const q of unattributed) {
    issues.push({
      id: `attribution-${q.quote.slice(0, 20)}`,
      severity: "error",
      message: `Quote lacks attribution: "${q.quote.slice(0, 60)}${q.quote.length > 60 ? "…" : ""}"`,
      suggestion: 'Add an attribution verb within the same sentence: "…," said [name], [role].',
    });
  }

  // Section-quality suggestions
  const sectionBody = (name: string): string => {
    const re = new RegExp(`^#{1,3}\\s*${name}\\s*$([\\s\\S]*?)(?=^#{1,3}\\s|$)`, "im");
    const m = body.match(re);
    return (m?.[1] || "").trim();
  };

  const bg = sectionBody("Background");
  if (bg && countWords(bg) < 40) {
    issues.push({
      id: "background-weak",
      severity: "warning",
      message: "Background section is thin",
      suggestion: "Add 2–3 sentences of context from the last 12–24 months: prior releases, related news, the artist's recent trajectory.",
    });
  }

  const why = sectionBody("Why it matters");
  if (why && countWords(why) < 35) {
    issues.push({
      id: "why-weak",
      severity: "warning",
      message: "‘Why it matters’ is weak",
      suggestion: "Spell out the impact for the Western Kenya / Kenyan audience: ticket access, local venues, scene growth, cultural significance.",
    });
  }

  const outlook = sectionBody("Outlook");
  if (outlook && countWords(outlook) < 25) {
    issues.push({
      id: "outlook-weak",
      severity: "warning",
      message: "Outlook is too short",
      suggestion: "Close with a forward-looking sentence: what's next, when, where, and how readers can act (tickets, dates, venues).",
    });
  }

  // Sources
  const sources = input.sources || [];
  if (sources.length === 0) {
    issues.push({
      id: "sources-missing",
      severity: "error",
      message: "No sources attached",
      suggestion: "Add at least one source link with 2–4 extracted notes so editors can verify the story.",
    });
  } else {
    const noNotes = sources.filter((s) => !s.notes || s.notes.length === 0).length;
    if (noNotes > 0) {
      issues.push({
        id: "sources-notes",
        severity: "warning",
        message: `${noNotes} source${noNotes === 1 ? "" : "s"} missing extracted notes`,
        suggestion: "For each source, add 2–4 bullet notes naming the specific facts used (names, dates, prices, quotes).",
      });
    }
  }

  // Hype words ban
  const banned = /\b(amazing|incredible|stunning|slayed|shook|legendary king|absolutely)\b/i;
  if (banned.test(body)) {
    issues.push({
      id: "hype-words",
      severity: "warning",
      message: "Hype words detected",
      suggestion: "Remove banned hype words (amazing, incredible, stunning, slayed, shook, absolutely). State the fact plainly.",
    });
  }

  return issues;
}

export function canApprove(issues: Issue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}