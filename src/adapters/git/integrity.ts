import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { git } from "./exec.js";

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "<missing>";
  }
}

async function hooksFingerprint(directory: string): Promise<string> {
  let entries: string[];
  try {
    entries = await readdir(directory, { recursive: true });
  } catch {
    return "<missing>";
  }
  const parts = await Promise.all(
    entries.sort().map(async (entry) => {
      const path = join(directory, entry);
      const info = await stat(path);
      const content = info.isFile() ? await readFile(path, "utf8") : "<dir>";
      return `${entry}\0${info.mode.toString(8)}\0${content}`;
    }),
  );
  return parts.join("\0\0");
}

async function currentBranch(cwd: string): Promise<string> {
  try {
    return await git({ cwd, args: ["symbolic-ref", "-q", "HEAD"] });
  } catch {
    return "<detached>";
  }
}

async function gitPath(cwd: string, name: string): Promise<string> {
  const path = await git({ cwd, args: ["rev-parse", "--git-path", name] });
  return resolve(cwd, path.trim());
}

/**
 * Hash of everything agents must not change (plan 5.3): HEAD, the checked-out
 * branch, all refs, the repository config and the hooks.
 */
export async function integritySnapshot(cwd: string): Promise<string> {
  const [head, branch, refs, config, hooks] = await Promise.all([
    git({ cwd, args: ["rev-parse", "HEAD"] }),
    currentBranch(cwd),
    git({ cwd, args: ["for-each-ref", "--format=%(refname) %(objectname)"] }),
    gitPath(cwd, "config").then(readOptional),
    gitPath(cwd, "hooks").then(hooksFingerprint),
  ]);
  return createHash("sha256")
    .update([head, branch, refs, config, hooks].join("\0\0\0"))
    .digest("hex");
}
