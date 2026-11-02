import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {applyTranslation, DraftBodySchema, planTranslation, type DraftText} from "./draft";
import {LANGUAGES, type Language} from "./schemas";

const other = (l: Language): Language => (l === "en" ? "es" : "en");
const en = (over: Partial<DraftText> = {}): DraftText => ({
  language: "en",
  body: "Hello Ben, long time!",
  altBody: null,
  altLanguage: null,
  ...over,
});

describe("DraftBodySchema", () => {
  it("trims and normalizes line endings", () => {
    expect(DraftBodySchema.parse("  Hola Ben,\r\nquerido amigo.\r\n")).toBe("Hola Ben,\nquerido amigo.");
  });

  it("enforces the length limits", () => {
    expect(DraftBodySchema.safeParse("short").success).toBe(false);
    expect(DraftBodySchema.safeParse("x".repeat(2000)).success).toBe(true);
    expect(DraftBodySchema.safeParse("x".repeat(2001)).success).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(DraftBodySchema.safeParse(null).success).toBe(false);
  });
});

describe("planTranslation", () => {
  it("does nothing when the draft is already in the target language", () => {
    expect(planTranslation(en(), "en")).toEqual({ kind: "noop" });
  });

  it("asks for a translation when no alternate exists", () => {
    expect(planTranslation(en(), "es")).toEqual({ kind: "translate", from: "en", to: "es" });
  });

  it("swaps to the stored alternate instead of translating again", () => {
    const d = en({ altBody: "Hola Ben, ¡cuánto tiempo!", altLanguage: "es" });
    expect(planTranslation(d, "es")).toEqual({
      kind: "swap",
      next: {
        language: "es",
        body: "Hola Ben, ¡cuánto tiempo!",
        altBody: "Hello Ben, long time!",
        altLanguage: "en",
      },
    });
  });

  it("ignores an inconsistent alternate", () => {
    expect(planTranslation(en({altBody: "x", altLanguage: null}), "es")).toMatchObject({ kind: "translate" });
  });
});

describe("applyTranslation", () => {
  it("moves the old text into the alternate slot", () => {
    expect(applyTranslation(en(), "Hola Ben, ¡cuánto tiempo!", "es")).toEqual({
      language: "es",
      body: "Hola Ben, ¡cuánto tiempo!",
      altBody: "Hello Ben, long time!",
      altLanguage: "en",
    });
  });
});

describe("translation toggle properties", () => {
  const languageArb = fc.constantFrom(...LANGUAGES);
  const textArb = fc.string({ minLength: 1, maxLength: 80 });
  const withAltArb = fc
    .record({language: languageArb, body: textArb, alt: textArb})
    .map(({language, body, alt}): DraftText => ({
      language,
      body,
      altBody: alt,
      altLanguage: other(language),
    }));

  it("switching to the stored translation and back restores the draft exactly", () => {
    fc.assert(
      fc.property(withAltArb, (d) => {
        const first = planTranslation(d, other(d.language));
        if (first.kind !== "swap") throw new Error("expected a swap");
        const back = planTranslation(first.next, d.language);
        if (back.kind !== "swap") throw new Error("expected a swap");
        expect(back.next).toEqual(d);
      }),
    );
  });

  it("a fresh translation can always be toggled back without translating again", () => {
    fc.assert(
      fc.property(languageArb, textArb, textArb, (language, body, translated) => {
        const d: DraftText = { language, body, altBody: null, altLanguage: null };
        const target = other(language);
        expect(planTranslation(d, target)).toEqual({kind: "translate", from: language, to: target});

        const t = applyTranslation(d, translated, target);
        expect(t.altLanguage).not.toBe(t.language); // the DB requires this
        const back = planTranslation(t, language);
        if (back.kind !== "swap") throw new Error("expected a swap");
        expect(back.next).toEqual({language, body, altBody: translated, altLanguage: target});
      }),
    );
  });
});