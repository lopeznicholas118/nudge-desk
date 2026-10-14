import {createCipheriv, createDecipheriv, randomBytes} from "node:crypto";

const VERSION = "v1";

function assertKey(key: Buffer) {
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes (base64 of 32 random bytes)");
}

/** Returns "v1:<iv>:<authTag>:<ciphertext>", each part base64. */
export function encryptSecret(plaintext: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(payload: string, key: Buffer): string {
  assertKey(key);
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unsupported ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}