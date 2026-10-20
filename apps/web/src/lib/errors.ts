/** Safe-to-log description of an unknown error (message and code only, never the full object). */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const {code, message} = err as {code?: unknown; message?: unknown};
    return [code, message].filter(Boolean).map(String).join(" ");
  }
  return "unknown error";
}