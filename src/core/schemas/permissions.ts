import { z } from "zod";

/**
 * Effects conductor accepts. OpenCode also knows "ask", but there is no human
 * to answer during a run, so it is not allowed here.
 */
const permissionEffectSchema = z.enum(["allow", "deny"]);

/**
 * One OpenCode V2 permission rule. `action` is a tool permission action such
 * as "shell", "edit", "read" or "webfetch"; `resource` is the command, path or
 * URL pattern. In a rule list the last matching rule wins.
 */
export const permissionRuleSchema = z.strictObject({
  action: z.string().min(1),
  resource: z.string().min(1),
  effect: permissionEffectSchema,
});

export type PermissionRule = z.infer<typeof permissionRuleSchema>;

/** Ordered rules; later rules take precedence. */
export type PermissionRuleset = readonly PermissionRule[];
