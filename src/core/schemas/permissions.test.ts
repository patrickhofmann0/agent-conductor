import { describe, expect, it } from "vitest";

import {
  bashPermissionSchema,
  permissionOverridesSchema,
} from "./permissions.js";

describe("bashPermissionSchema", () => {
  it.each(["allow", "deny"])("accepts the shorthand %s", (value) => {
    expect(bashPermissionSchema.parse(value)).toBe(value);
  });

  it("accepts a pattern map", () => {
    expect(
      bashPermissionSchema.parse({ "*": "deny", "ls *": "allow" }),
    ).toEqual({
      "*": "deny",
      "ls *": "allow",
    });
  });

  it.each([["ask"], [{ "*": "ask" }], [{ "": "allow" }]])(
    "rejects %j",
    (value) => {
      expect(bashPermissionSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("permissionOverridesSchema", () => {
  it("accepts partial overrides", () => {
    expect(permissionOverridesSchema.parse({ webfetch: "allow" })).toEqual({
      webfetch: "allow",
    });
  });

  it("rejects unknown tools", () => {
    expect(
      permissionOverridesSchema.safeParse({ shell: "allow" }).success,
    ).toBe(false);
  });
});
