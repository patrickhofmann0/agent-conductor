/** Version control operations. Only the framework uses git, never the agents. */
export interface Vcs {
  /** Creates and checks out `name` from `base`; returns the base commit. */
  createBranch(name: string, base: string): Promise<string>;
  head(): Promise<string>;
  /**
   * Fingerprint of everything agents must not change: HEAD, branch, refs,
   * git config and hooks.
   */
  integritySnapshot(): Promise<string>;
  /** Files changed since `commit`, including uncommitted and untracked files. */
  changedFiles(since: string): Promise<readonly string[]>;
  /** Unified diff of all changes since `commit`. */
  diff(since: string): Promise<string>;
  /** Restores `paths` to their state at `commit`; deletes files that did not exist. */
  revertPaths(paths: readonly string[], commit: string): Promise<void>;
  /** Commits all changes (also when empty) and returns the new commit. */
  commit(message: string): Promise<string>;
  /** Replaces all commits since `since`, plus uncommitted changes, with one commit. */
  squash(request: SquashRequest): Promise<string>;
}

export interface SquashRequest {
  readonly since: string;
  readonly message: string;
}
