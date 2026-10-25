import {describe, expect, it} from "vitest";
import {isAuthorizedCron} from "./auth";

const SECRET = "a".repeat(32);

describe("isAuthorizedCron", () => {
  it("accepts the exact bearer token", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects a wrong token, whatever its length", () => {
    expect(isAuthorizedCron(`Bearer ${"b".repeat(32)}`, SECRET)).toBe(false);
    expect(isAuthorizedCron(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCron("Bearer x", SECRET)).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    for (const header of [null, "", SECRET, `Basic ${SECRET}`, `bearer ${SECRET}`, `Bearer  ${SECRET}`, "Bearer "]) {
      expect(isAuthorizedCron(header, SECRET)).toBe(false);
    }
  });

  it("fails closed when no usable secret is configured", () => {
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer short", "short")).toBe(false);
  });
});