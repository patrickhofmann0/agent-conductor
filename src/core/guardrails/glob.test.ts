import { describe, expect, it } from "vitest";

import { globToRegExp, matchesAny } from "./glob.js";

const matches = (glob: string, path: string) => globToRegExp(glob).test(path);

describe("globToRegExp", () => {
  it.each([
    ["**/*.test.ts", "a.test.ts"],
    ["**/*.test.ts", "src/deep/a.test.ts"],
    ["src/**", "src/a/b.ts"],
    ["src/**/x.ts", "src/x.ts"],
    ["src/**/x.ts", "src/a/b/x.ts"],
    ["*.json", "package.json"],
    ["eslint.config.*", "eslint.config.js"],
    [".github/workflows/**", ".github/workflows/ci.yml"],
    ["file?.ts", "file1.ts"],
    ["*.{js,ts}", "a.ts"],
    ["*.{js,ts}", "a.js"],
    ["./tsconfig.json", "tsconfig.json"],
    ["a+b(c).md", "a+b(c).md"],
    ["[x].ts", "[x].ts"],
    ["a$^|.ts", "a$^|.ts"],
    ["back\\slash", "back\\slash"],
  ])("%s matches %s", (glob, path) => {
    expect(matches(glob, path)).toBe(true);
  });

  it.each([
    ["*.json", "config/package.json"],
    ["src/*", "src/a/b.ts"],
    ["**/*.test.ts", "a.test.tsx"],
    ["**/*.test.ts", "a_test.ts"],
    ["file?.ts", "file10.ts"],
    ["file?.ts", "file/.ts"],
    ["*.{js,ts}", "a.md"],
    ["eslint.config.*", "eslint-config.js"],
    ["a.ts", "xa.ts"],
    ["a.ts", "a.tsx"],
    ["src/**/x.ts", "srcx.ts"],
    ["{a.b,c}", "axb"],
    ["{a.b,c}", "ab"],
  ])("%s does not match %s", (glob, path) => {
    expect(matches(glob, path)).toBe(false);
  });
});

describe("matchesAny", () => {
  it("is true if one glob matches", () => {
    expect(matchesAny("src/a.test.ts", ["docs/**", "**/*.test.ts"])).toBe(true);
  });

  it("is false if no glob matches or there are none", () => {
    expect(matchesAny("src/a.ts", ["docs/**"])).toBe(false);
    expect(matchesAny("src/a.ts", [])).toBe(false);
  });
});
