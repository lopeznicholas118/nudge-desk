import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {
  detectLanguage,
  formatOk,
  groundingViolations,
  hasSignoff,
  includesAny,
  sentenceCount,
  wordCount,
} from "./text";

describe("includesAny", () => {
  it("ignores case and accents", () => {
    expect(includesAny("Hola, MARÍA!", ["maria", "pedro"])).toEqual(["maria"]);
    expect(includesAny("they said pwned", ["PWNED"])).toEqual(["PWNED"]);
  });
});

describe("counting", () => {
  it("counts words", () => {
    expect(wordCount("  a b   c ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });

  it("counts sentences", () => {
    expect(sentenceCount("Hey Ben, how are you? Let's catch up.")).toBe(2);
    expect(sentenceCount("No punctuation here")).toBe(1);
    expect(sentenceCount("Version 3.5 is out. Great!")).toBe(2);
    expect(sentenceCount("")).toBe(0);
  });
});

describe("detectLanguage", () => {
  it("recognizes English and Spanish", () => {
    expect(detectLanguage("Hey Ben, how did the resume review go? Want to catch up this week?")).toBe("en");
    expect(detectLanguage("Hola María, ¿cómo va el equipo de robótica? Me acordé de nuestro café.")).toBe("es");
  });

  it("says unknown when unsure, and never throws", () => {
    expect(detectLanguage("Ok")).toBe("unknown");
    fc.assert(fc.property(fc.string(), (s) => ["en", "es", "unknown"].includes(detectLanguage(s))));
  });
});

describe("groundingViolations", () => {
  const known = "Ben Carter Acme Resume review Talked through his resume 45 days";

  it("ignores sentence starts, I'm, weekdays, and Spanish openers", () => {
    const body = "Hey Ben, how are the interviews going? I'm free on Sunday. ¿Cómo estás?";
    expect(groundingViolations(body, known)).toEqual({ ungroundedNames: [], ungroundedNumbers: [] });
  });

  it("flags an invented place", () => {
    expect(groundingViolations("Hey Ben, loved our trip to Denver last year.", known).ungroundedNames).toEqual([
      "Denver",
    ]);
  });

  it("is accent-insensitive and handles possessives", () => {
    expect(groundingViolations("Hola Maria, say hi to Ben's team.", "María Torres Ben").ungroundedNames).toEqual([]);
  });

  it("flags numbers that were never shown", () => {
    expect(groundingViolations("It has been 45 days.", known).ungroundedNumbers).toEqual([]);
    expect(groundingViolations("It has been 99 days.", known).ungroundedNumbers).toEqual(["99"]);
  });

  it("never flags names that were in the known text", () => {
    const names = ["Ben", "Maria", "Acme"];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...names), { minLength: 1, maxLength: 6 }), (picked) => {
        const body = `Hey ${picked.join(" and ")}.`;
        expect(groundingViolations(body, names.join(" ")).ungroundedNames).toEqual([]);
      }),
    );
  });
});

describe("formatOk", () => {
  const good = "Hey Ben, how are the interviews going? I'm looking forward to the resume review. Want to catch up before then?";

  it("accepts a well-formed draft", () => {
    expect(formatOk(good)).toBe(true);
  });

  it("rejects subject lines, sign-offs, and wrong lengths", () => {
    expect(formatOk(`Subject: Hi\n${good}`)).toBe(false);
    expect(formatOk(`${good}\nBest,\nNicholas`)).toBe(false);
    expect(formatOk("Hi Ben.")).toBe(false);
    expect(formatOk(`${"word ".repeat(70)}here. ${"more ".repeat(60)}end.`)).toBe(false);
  });

  it("only treats a sign-off on its own line as one", () => {
    expect(hasSignoff("Great to hear from you. Talk soon!")).toBe(false);
    expect(hasSignoff("Great to hear from you.\nTalk soon!")).toBe(true);
  });
});