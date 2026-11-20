import "server-only";
import * as Sentry from "@sentry/nextjs";
import {describeError} from "@/lib/errors";

/** Logs and reports an error. Tags must be opaque ids only: never names, emails, or draft text. */
export function reportError(context: string, err: unknown, tags: Record<string, string> = {}) {
  console.error(`${context}:`, describeError(err));
  // Supabase errors are plain objects, so wrap them for Sentry.
  Sentry.captureException(err instanceof Error ? err : new Error(describeError(err)), {
    tags: {context, ...tags},
  });
}