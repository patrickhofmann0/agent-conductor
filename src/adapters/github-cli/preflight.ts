import type { Gh } from "./gh.js";

/** `gh pr ready --undo` and `--jq` on `gh api --paginate` need this. */
const MIN_GH_VERSION = "2.40.0";

function parts(version: string): number[] {
  return version.split(".").map(Number);
}

export function isAtLeast(version: string, minimum: string): boolean {
  const have = parts(version);
  const need = parts(minimum);
  for (const [index, wanted] of need.entries()) {
    const actual = have[index] ?? 0;
    if (actual !== wanted) return actual > wanted;
  }
  return true;
}

/**
 * Fails early, before any agent runs, when gh is missing, too old or not
 * authenticated.
 */
export async function verifyGh(gh: Gh): Promise<void> {
  const output = await gh({ args: ["--version"] });
  const version = /gh version (\d+\.\d+\.\d+)/.exec(output)?.[1];
  if (version === undefined || !isAtLeast(version, MIN_GH_VERSION)) {
    throw new Error(
      `gh ${MIN_GH_VERSION} or newer is required; found: ${output.split("\n")[0] ?? ""}`,
    );
  }
  await gh({ args: ["auth", "status"] });
}
