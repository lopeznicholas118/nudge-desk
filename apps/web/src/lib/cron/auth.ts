import {createHash, timingSafeEqual} from "node:crypto";

const MIN_SECRET_LENGTH = 16;
const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Checks "Authorization: Bearer <secret>". Fails closed: with no secret configured
 * (or a short one) nothing is authorized. Hashing both sides first makes the
 * constant-time comparison independent of the input length.
 */
export function isAuthorizedCron(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  const token = /^Bearer (.+)$/.exec(authorizationHeader ?? "")?.[1];
  if (!token) return false;
  return timingSafeEqual(digest(token), digest(secret));
}