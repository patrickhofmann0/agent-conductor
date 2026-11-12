import { createGh } from "../adapters/github-cli/gh.js";
import { createGhForge } from "../adapters/github-cli/gh-forge.js";
import { verifyGh } from "../adapters/github-cli/preflight.js";

import type { Forge } from "../core/ports/forge.types.js";

/** Connects to the forge of the repository in `directory`. */
export type OpenForge = (directory: string) => Promise<Forge>;

/** GitHub through the `gh` CLI; fails before any agent runs (ADR 0013). */
export function createOpenGithub(binary = "gh"): OpenForge {
  return async (directory) => {
    const gh = createGh({ cwd: directory, binary });
    await verifyGh(gh);
    return createGhForge(gh);
  };
}

export const openGithub = createOpenGithub();
