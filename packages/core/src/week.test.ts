import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {weekStart} from "./week";

describe("weekStart", () => {
  it.each([
    ["2026-10-09T12:00:00Z", "2026-10-05"], // Friday
    ["2026-10-05T00:00:00Z", "2026-10-05"], // Monday, first instant
    ["2026-10-11T23:59:59Z", "2026-10-05"], // Sunday, last instant
    ["2026-10-12T00:00:00Z", "2026-10-12"], // next Monday
    ["2026-10-20T08:00:00Z", "2026-10-19"], // Tuesday
    ["2026-01-01T10:00:00Z", "2025-12-29"], // week spanning the new year
  ])("%s -> %s", (input, expected) => {
    expect(weekStart(new Date(input))).toBe(expected);
  });

  it("throws on an invalid date", () => {
    expect(() => weekStart(new Date("nope"))).toThrow(RangeError);
  });
});

describe("weekStart properties", () => {
  const dateArb = fc.date({
    min: new Date("2020-01-01T00:00:00Z"),
    max: new Date("2030-01-01T00:00:00Z"),
    noInvalidDate: true,
  });

  it("is always a Monday within the previous 7 days, and idempotent", () => {
    fc.assert(
      fc.property(dateArb, (d) => {
        const start = weekStart(d);
        const startMs = new Date(`${start}T00:00:00Z`).getTime();
        expect(new Date(startMs).getUTCDay()).toBe(1);
        expect(startMs).toBeLessThanOrEqual(d.getTime());
        expect(d.getTime() - startMs).toBeLessThan(7 * 86_400_000);
        expect(weekStart(new Date(startMs))).toBe(start);
      }),
    );
  });
});