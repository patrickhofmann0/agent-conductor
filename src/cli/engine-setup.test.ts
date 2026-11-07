import { describe, expect, it } from "vitest";

import { archiveDirectory } from "./engine-setup.js";

describe("archiveDirectory", () => {
  it("prefers XDG_DATA_HOME", () => {
    expect(archiveDirectory({ XDG_DATA_HOME: "/data", HOME: "/home/a" })).toBe(
      "/data/agent-conductor/runs",
    );
  });

  it("falls back to ~/.local/share", () => {
    expect(archiveDirectory({ HOME: "/home/a" })).toBe(
      "/home/a/.local/share/agent-conductor/runs",
    );
  });

  it("uses the current directory without HOME", () => {
    expect(archiveDirectory({})).toBe(".local/share/agent-conductor/runs");
  });
});
