import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {editDistance, editRatio} from "./edit-ratio";

describe("editDistance", () => {
  it("matches known values", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
  });

  it("is symmetric, bounded by the longer string, and zero only for equal strings", () => {
    fc.assert(
      fc.property(fc.string({maxLength: 30}), fc.string({maxLength: 30}), (a, b) => {
        const d = editDistance(a, b);
        expect(d).toBe(editDistance(b, a));
        expect(d).toBeLessThanOrEqual(Math.max(a.length, b.length));
        expect(d === 0).toBe(a === b);
      }),
    );
  });
});

describe("editRatio", () => {
  it("is 0 for untouched, 1 for fully different, and handles empties", () => {
    expect(editRatio("hello there", "hello there")).toBe(0);
    expect(editRatio("aaaa", "bbbb")).toBe(1);
    expect(editRatio("", "")).toBe(0);
  });

  it("always lies in [0, 1]", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), fc.string({ maxLength: 30 }), (a, b) => {
        const r = editRatio(a, b);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }),
    );
  });
});