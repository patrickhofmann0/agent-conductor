import type {
  EffectivePermissions,
  Permission,
  PermissionOverrides,
} from "../schemas/permissions.js";
import type { Role } from "../schemas/role.js";

type BashSetting = Permission | Readonly<Record<string, Permission>>;

interface RolePermissionDefaults {
  readonly edit: Permission;
  readonly bash: BashSetting;
  readonly webfetch: Permission;
}

const READ_ONLY: RolePermissionDefaults = {
  edit: "deny",
  bash: "deny",
  webfetch: "deny",
};
const WRITER: RolePermissionDefaults = {
  edit: "allow",
  bash: "allow",
  webfetch: "deny",
};

const DEFAULT_PERMISSIONS: Readonly<Record<Role, RolePermissionDefaults>> = {
  po: { ...READ_ONLY, webfetch: "allow" },
  planner: { ...READ_ONLY, webfetch: "allow" },
  coder: WRITER,
  tester: WRITER,
  reviewer: READ_ONLY,
};

/**
 * Commands no agent may run, regardless of configuration (ADR 0006). They are
 * appended last so they take precedence over any user pattern.
 */
export const HARD_DENIED_COMMANDS: Readonly<Record<string, Permission>> = {
  git: "deny",
  "git *": "deny",
  gh: "deny",
  "gh *": "deny",
};

function bashPatterns(setting: BashSetting): Record<string, Permission> {
  const patterns =
    typeof setting === "string" ? { "*": setting } : { ...setting };
  for (const command of Object.keys(HARD_DENIED_COMMANDS)) {
    Reflect.deleteProperty(patterns, command);
  }
  return { ...patterns, ...HARD_DENIED_COMMANDS };
}

export function effectivePermissions(
  role: Role,
  overrides: PermissionOverrides = {},
): EffectivePermissions {
  const defaults = DEFAULT_PERMISSIONS[role];
  return {
    edit: overrides.edit ?? defaults.edit,
    bash: bashPatterns(overrides.bash ?? defaults.bash),
    webfetch: overrides.webfetch ?? defaults.webfetch,
  };
}
