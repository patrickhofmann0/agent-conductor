import { describe, expect, it } from "vitest";

import { ROLES, roleSchema, routeSchema } from "./role.js";

describe("roleSchema", () => {
  it("lists the pipeline roles in execution order", () => {
    expect(ROLES).toEqual(["po", "planner", "coder", "tester", "reviewer"]);
  });

  it.each(ROLES)("accepts %s", (role) => {
    expect(roleSchema.parse(role)).toBe(role);
  });

  it("rejects unknown roles", () => {
    expect(roleSchema.safeParse("architect").success).toBe(false);
  });
});

describe("routeSchema", () => {
  it.each(["coder", "tester", "both"])("accepts %s", (route) => {
    expect(routeSchema.parse(route)).toBe(route);
  });

  it("rejects other roles", () => {
    expect(routeSchema.safeParse("reviewer").success).toBe(false);
  });
});
