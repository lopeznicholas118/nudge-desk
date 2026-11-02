import {z} from "zod";
import type {Language} from "./schemas";

/**
 * Mirrors the drafts.body CHECK (1 to 2000 trimmed characters) with a friendlier floor.
 * Browsers submit textarea newlines as CRLF, so normalize to LF first: otherwise an
 * untouched draft would look "edited" when compared to what's in the database.
 */
export const DraftBodySchema = z
  .string()
  .transform((s) => s.replace(/\r\n?/g, "\n"))
  .pipe(
    z
      .string()
      .trim()
      .min(10, "Drafts need at least 10 characters.")
      .max(2000, "Drafts can be at most 2000 characters."),
  );

export type DraftText = {
  language: Language;
  body: string;
  /** The same message in the other language, kept so the toggle can swap instead of re-translating. */
  altBody: string | null;
  altLanguage: Language | null;
};

export type TranslationPlan =
  | {kind: "noop"}
  | {kind: "swap"; next: DraftText}
  | {kind: "translate"; from: Language; to: Language};

/** Decides what "show this draft in <target>" means, without doing any I/O. */
export function planTranslation(draft: DraftText, target: Language): TranslationPlan {
  if (draft.language === target) return {kind: "noop"};
  if (draft.altBody !== null && draft.altLanguage === target) {
    return {
      kind: "swap",
      next: {language: target, body: draft.altBody, altBody: draft.body, altLanguage: draft.language},
    };
  }
  return {kind: "translate", from: draft.language, to: target};
}

/** The draft after a fresh translation: the old text becomes the stored alternate. */
export function applyTranslation(draft: DraftText, translatedBody: string, target: Language): DraftText {
  return {language: target, body: translatedBody, altBody: draft.body, altLanguage: draft.language};
}