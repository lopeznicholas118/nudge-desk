import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {sanitizeUntrusted} from "./untrusted";

describe("sanitizeUntrusted", () => {
  it("returns null for missing or blank input", () => {
    expect(sanitizeUntrusted(null, 50)).toBeNull();
    expect(sanitizeUntrusted(undefined, 50)).toBeNull();
    expect(sanitizeUntrusted("  \n ", 50)).toBeNull();
  });

  it("strips control characters and collapses blank lines", () => {
    expect(sanitizeUntrusted("a\u0000b\n\n\n\nc", 50)).toBe("ab\n\nc");
  });

  it("truncates to the limit", () => {
    expect(sanitizeUntrusted("x".repeat(500), 200)).toHaveLength(200);
  });

  it("is bounded, control-free, and idempotent for any input", () => {
    const textArb = fc
      .array(fc.constantFrom("a", "B", " ", "\n", "\r", "\t", "\u0000", "\u0007", "\u001f", "\u007f"))
      .map((chars) => chars.join(""));
    fc.assert(
      fc.property(textArb, fc.integer({ min: 1, max: 40 }), (text, max) => {
        const out = sanitizeUntrusted(text, max);
        if (out === null) return;
        expect(out.length).toBeLessThanOrEqual(max);
        expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(out)).toBe(false);
        expect(sanitizeUntrusted(out, max)).toBe(out);
      }),
    );
  });
});