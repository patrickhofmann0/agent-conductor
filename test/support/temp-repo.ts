import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface TempRepo {
  readonly dir: string;
  /** Runs git synchronously in the repository and returns trimmed stdout. */
  git(...args: string[]): string;
  write(path: string, content: string): Promise<void>;
}

/** A fresh git repository on branch `main` with one commit containing README.md. */
export async function createTempRepo(): Promise<TempRepo> {
  const dir = await mkdtemp(join(tmpdir(), "conductor-repo-"));
  const repo: TempRepo = {
    dir,
    git: (...args) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim(),
    write: async (path, content) => {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), content);
    },
  };
  repo.git("init", "-q", "-b", "main");
  repo.git("config", "user.name", "Test");
  repo.git("config", "user.email", "test@example.com");
  repo.git("config", "commit.gpgsign", "false");
  await repo.write("README.md", "# Test\n");
  repo.git("add", "-A");
  repo.git("commit", "-q", "-m", "chore: initial");
  return repo;
}
