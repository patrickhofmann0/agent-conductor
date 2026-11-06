import type { SquashRequest, Vcs } from "../../src/core/ports/vcs.types.js";

interface FakeCommit {
  readonly sha: string;
  readonly message: string;
  readonly files: readonly string[];
}

/** In-memory version control: tracks changed files, commits and integrity. */
export class FakeVcs implements Vcs {
  readonly commits: FakeCommit[] = [];
  readonly branches: { name: string; base: string }[] = [];
  readonly reverts: { paths: readonly string[]; commit: string }[] = [];
  readonly squashes: SquashRequest[] = [];
  diffText =
    "diff --git a/src/export.ts b/src/export.ts\n+export const csv = true;";
  private readonly working = new Set<string>();
  private integrity = "intact";

  /** Simulates file changes in the working tree. */
  change(...paths: string[]): void {
    for (const path of paths) this.working.add(path);
  }

  /** Simulates an agent touching version control. */
  tamper(): void {
    this.integrity = `tampered-${String(this.commits.length)}`;
  }

  get workingChanges(): string[] {
    return [...this.working].sort();
  }

  createBranch(name: string, base: string): Promise<string> {
    this.branches.push({ name, base });
    return Promise.resolve("base");
  }

  head(): Promise<string> {
    return Promise.resolve(this.commits.at(-1)?.sha ?? "base");
  }

  integritySnapshot(): Promise<string> {
    return Promise.resolve(this.integrity);
  }

  changedFiles(since: string): Promise<readonly string[]> {
    const index = this.commits.findIndex((commit) => commit.sha === since);
    const committed = this.commits
      .slice(index + 1)
      .flatMap((commit) => commit.files);
    return Promise.resolve(
      [...new Set([...committed, ...this.working])].sort(),
    );
  }

  diff(): Promise<string> {
    return Promise.resolve(this.diffText);
  }

  revertPaths(paths: readonly string[], commit: string): Promise<void> {
    this.reverts.push({ paths, commit });
    for (const path of paths) this.working.delete(path);
    return Promise.resolve();
  }

  commit(message: string): Promise<string> {
    const sha = `c${String(this.commits.length + 1)}`;
    this.commits.push({ sha, message, files: this.workingChanges });
    this.working.clear();
    return Promise.resolve(sha);
  }

  squash(request: SquashRequest): Promise<string> {
    this.squashes.push(request);
    this.working.clear();
    return Promise.resolve("squashed");
  }
}
