export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Wrong command-line arguments; leads to exit code 2. */
export class UsageError extends Error {
  override name = "UsageError";
}
