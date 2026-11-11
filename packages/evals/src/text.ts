const WORD = /[\p{L}][\p{L}'’-]*/gu;
const NUMBER = /\d+(?:[.,]\d+)?/g;
// Text before a word ends in sentence punctuation (or is empty): the word starts a sentence.
const SENTENCE_START = /(?:^|[.!?¡¿:\n"“(—–])\s*$/u;

/** Lowercase, strip accents, normalize apostrophes: for forgiving comparisons. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’‘]/g, "'");
}

/** Which of `needles` appear in `text`, ignoring case and accents. */
export function includesAny(text: string, needles: readonly string[]): string[] {
  const haystack = fold(text);
  return needles.filter((n) => haystack.includes(fold(n)));
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+(?=\s|$)/)
    .map((s) => s.trim())
    .filter((s) => s !== "").length;
}

export function hasSubjectLine(body: string): boolean {
  return /^\s*(subject|asunto)\s*:/i.test(body);
}

const SIGNOFF =
  /^(best|best regards|warm regards|kind regards|regards|cheers|sincerely|talk soon|saludos|un abrazo|abrazos|atentamente|cordialmente)\s*[,.!]*\s*$/i;

/** True if one of the last two lines is a sign-off on its own line. */
export function hasSignoff(body: string): boolean {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.slice(-2).some((l) => SIGNOFF.test(l));
}

/** The prompt's format rules: 2 to 5 sentences, at most 120 words, no subject line, no sign-off. */
export function formatOk(body: string): boolean {
  const sentences = sentenceCount(body);
  return sentences >= 2 && sentences <= 5 && wordCount(body) <= 120 && !hasSubjectLine(body) && !hasSignoff(body);
}

// Folded (accent-free) common words. Words that are valid in both languages are left out.
const ES_WORDS = new Set([
  "el", "la", "los", "las", "de", "del", "que", "y", "en", "un", "una", "por", "con", "para", "te", "tu", "tus",
  "hola", "como", "es", "estas", "muy", "al", "lo", "se", "mas", "pero", "algo", "esta", "este", "mi", "nuestro",
  "nuestra", "nos", "si", "ha", "hace", "mucho", "tiempo", "cuando", "donde", "quieres", "animas", "semana",
]);
const EN_WORDS = new Set([
  "the", "and", "to", "of", "is", "you", "how", "for", "with", "it", "your", "are", "we", "in", "on", "that",
  "this", "have", "hey", "hi", "been", "what", "would", "be", "can", "if", "my", "so", "at", "about", "soon",
  "up", "catch", "i", "i'm", "i'd", "i'll", "i've",
]);

export type DetectedLanguage = "en" | "es" | "unknown";

/** Counts common words. Reliable enough for 2-to-5-sentence drafts; returns "unknown" when unsure. */
export function detectLanguage(text: string): DetectedLanguage {
  let es = 0;
  let en = 0;
  for (const m of fold(text).matchAll(WORD)) {
    if (ES_WORDS.has(m[0])) es++;
    if (EN_WORDS.has(m[0])) en++;
  }
  if (es + en < 3) return "unknown";
  return es > en ? "es" : en > es ? "en" : "unknown";
}

// Capitalized words that are fine even when the model has never seen them.
const ALLOWED = new Set(
  [
    "i", "i'm", "i'll", "i've", "i'd",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    "zoom", "google", "meet", "facetime", "whatsapp", "slack", "teams", "linkedin",
  ].map(fold),
);

const base = (word: string) => fold(word).replace(/'s$/, "");

/**
 * A cheap fabrication detector. Flags capitalized words that don't start a sentence and
 * never appeared in what the model was shown (so invented names, places, and companies),
 * and numbers that never appeared. It misses invented lowercase details, and can flag a
 * legitimate word: the allowlist above is the escape hatch for the benign ones.
 */
export function groundingViolations(body: string, knownText: string) {
  const known = new Set([...knownText.matchAll(WORD)].map((m) => base(m[0])));
  const ungroundedNames: string[] = [];

  for (const m of body.matchAll(WORD)) {
    const word = m[0];
    if (!/^\p{Lu}/u.test(word)) continue;
    if (SENTENCE_START.test(body.slice(0, m.index ?? 0))) continue;
    const key = base(word);
    if (ALLOWED.has(key) || known.has(key)) continue;
    if (!ungroundedNames.includes(word)) ungroundedNames.push(word);
  }

  const knownNumbers = new Set(knownText.match(NUMBER) ?? []);
  const ungroundedNumbers = [...new Set(body.match(NUMBER) ?? [])].filter((n) => !knownNumbers.has(n));

  return {ungroundedNames, ungroundedNumbers};
}