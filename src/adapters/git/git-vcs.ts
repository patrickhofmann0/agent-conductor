import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { SquashRequest, Vcs } from "../../core/ports/vcs.types.js";

import { git, splitNul } from "./exec.js";
import { integritySnapshot } from "./integrity.js";

export interface GitVcs extends Vcs {
  /** True when there are no staged, unstaged or untracked changes. */
  isClean(): Promise<boolean>;
  /** Pushes the current branch, refusing to overwrite unseen remote commits. */
  push(remote: string): Promise<void>;
}

type Env = Readonly<Record<string, string>>;

/**
 * Runs `use` with a temporary index that contains every working tree change,
 * including untracked files, without touching the real index.
 */
async function withFullIndex<T>(
  cwd: string,
  use: (env: Env) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "conductor-index-"));
  try {
    const realIndex = await git({
      cwd,
      args: ["rev-parse", "--git-path", "index"],
    });
    const env = { GIT_INDEX_FILE: join(directory, "index") };
    await copyFile(resolve(cwd, realIndex.trim()), env.GIT_INDEX_FILE).catch(
      () => undefined,
    );
    await git({ cwd, args: ["add", "-A"], env });
    return await use(env);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function commitAll(cwd: string, message: string): Promise<string> {
  await git({ cwd, args: ["add", "-A"] });
  await git({ cwd, args: ["commit", "-q", "--allow-empty", "-m", message] });
  return (await git({ cwd, args: ["rev-parse", "HEAD"] })).trim();
}

async function revertPaths(
  cwd: string,
  paths: readonly string[],
  commit: string,
): Promise<void> {
  if (paths.length === 0) return;
  const literal = ["--literal-pathspecs"];
  const existing = new Set(
    splitNul(
      await git({
        cwd,
        args: [
          ...literal,
          "ls-tree",
          "-r",
          "-z",
          "--name-only",
          commit,
          "--",
          ...paths,
        ],
      }),
    ),
  );
  const restore = paths.filter((path) => existing.has(path));
  if (restore.length > 0) {
    await git({
      cwd,
      args: [
        ...literal,
        "restore",
        `--source=${commit}`,
        "--worktree",
        "--",
        ...restore,
      ],
    });
  }
  const created = paths.filter((path) => !existing.has(path));
  await Promise.all(
    created.map((path) =>
      rm(join(cwd, path), { recursive: true, force: true }),
    ),
  );
}

/** Version control through the git command line in `cwd`. */
export function createGitVcs(cwd: string): GitVcs {
  const head = async (): Promise<string> =>
    (await git({ cwd, args: ["rev-parse", "HEAD"] })).trim();
  return {
    createBranch: async (name, base) => {
      const sha = await git({
        cwd,
        args: ["rev-parse", "--verify", `${base}^{commit}`],
      });
      await git({ cwd, args: ["switch", "-q", "-c", name, sha.trim()] });
      return sha.trim();
    },
    head,
    isClean: async () =>
      (await git({ cwd, args: ["status", "--porcelain"] })).trim() === "",
    integritySnapshot: () => integritySnapshot(cwd),
    changedFiles: (since) =>
      withFullIndex(cwd, async (env) =>
        splitNul(
          await git({
            cwd,
            args: [
              "diff",
              "--cached",
              "--name-only",
              "--no-renames",
              "-z",
              since,
            ],
            env,
          }),
        ),
      ),
    diff: (since) =>
      withFullIndex(cwd, (env) =>
        git({ cwd, args: ["diff", "--cached", "--no-renames", since], env }),
      ),
    revertPaths: (paths, commit) => revertPaths(cwd, paths, commit),
    commit: (message) => commitAll(cwd, message),
    squash: async (request: SquashRequest) => {
      await git({ cwd, args: ["reset", "-q", "--soft", request.since] });
      return commitAll(cwd, request.message);
    },
    push: async (remote) => {
      await git({
        cwd,
        args: ["push", "-q", "--force-with-lease", "-u", remote, "HEAD"],
      });
    },
  };
}
