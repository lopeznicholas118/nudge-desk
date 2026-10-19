const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Cleans text written by other people (contact notes, meeting titles) 
 * before the model sees it. This limits size and removes junk. 
 * It does NOT make injected instructions safe: 
 * that's what the _untrusted naming and the system prompt are for.
 */
export function sanitizeUntrusted(text: string | null | undefined, maxLength: number): string | null {
  if (text == null) return null;
  const cleaned = text
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const clipped = cleaned.slice(0, maxLength).trimEnd();
  return clipped === "" ? null : clipped;
}