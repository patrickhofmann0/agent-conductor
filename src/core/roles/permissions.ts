import type {
  PermissionRule,
  PermissionRuleset,
} from "../schemas/permissions.js";
import type { Role } from "../schemas/role.js";

function rule(
  action: string,
  resource: string,
  effect: PermissionRule["effect"],
): PermissionRule {
  return { action, resource, effect };
}

const READ_ONLY: PermissionRuleset = [
  rule("edit", "*", "deny"),
  rule("shell", "*", "deny"),
  rule("webfetch", "*", "deny"),
  rule("websearch", "*", "deny"),
];

const RESEARCHER: PermissionRuleset = [
  rule("edit", "*", "deny"),
  rule("shell", "*", "deny"),
  rule("webfetch", "*", "allow"),
  rule("websearch", "*", "allow"),
];

const WRITER: PermissionRuleset = [
  rule("edit", "*", "allow"),
  rule("shell", "*", "allow"),
  rule("webfetch", "*", "deny"),
  rule("websearch", "*", "deny"),
];

const DEFAULT_RULES: Readonly<Record<Role, PermissionRuleset>> = {
  po: RESEARCHER,
  planner: RESEARCHER,
  coder: WRITER,
  tester: WRITER,
  reviewer: READ_ONLY,
};

/**
 * Rules appended after everything else, so no configuration can override them
 * (OpenCode uses the last matching rule).
 */
export const HARD_RULES: PermissionRuleset = [
  // Only the framework touches version control (ADR 0006).
  rule("shell", "git *", "deny"),
  rule("shell", "gh *", "deny"),
  // Subagents use their own permissions, not the session's.
  rule("subagent", "*", "deny"),
  // Nobody can answer a question during a run.
  rule("question", "*", "deny"),
  // Secrets stay out of model context.
  rule("read", "*.env", "deny"),
  rule("read", "*.env.*", "deny"),
  // Agents stay inside the repository.
  rule("external_directory", "*", "deny"),
];

/** Role defaults, then the project's rules, then the hard rules. */
export function effectivePermissions(
  role: Role,
  projectRules: PermissionRuleset = [],
): PermissionRuleset {
  return [...DEFAULT_RULES[role], ...projectRules, ...HARD_RULES];
}
