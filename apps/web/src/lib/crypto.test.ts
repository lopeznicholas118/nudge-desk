import {randomBytes} from "node:crypto";
import {describe, expect, it} from "vitest";
import {decryptSecret, encryptSecret} from "./crypto";

const key = randomBytes(32);
const secret = "1//refresh-token-abc";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips", () => {
    expect(decryptSecret(encryptSecret(secret, key), key)).toBe(secret);
  });

  it("uses a fresh IV every time", () => {
    expect(encryptSecret(secret, key)).not.toBe(encryptSecret(secret, key));
  });

  it("does not leak the plaintext", () => {
    expect(encryptSecret(secret, key)).not.toContain("refresh-token");
  });

  it("rejects tampered ciphertext", () => {
    const parts = encryptSecret(secret, key).split(":");
    const data = Buffer.from(parts[3]!, "base64");
    data[0] = data[0]! ^ 1;
    parts[3] = data.toString("base64");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow();
  });

  it("rejects the wrong key", () => {
    expect(() => decryptSecret(encryptSecret(secret, key), randomBytes(32))).toThrow();
  });

  it("rejects keys that aren't 32 bytes", () => {
    expect(() => encryptSecret(secret, randomBytes(16))).toThrow(/32 bytes/);
  });
});