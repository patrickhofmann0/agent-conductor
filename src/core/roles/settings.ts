import { effectivePermissions } from "./permissions.js";
import {
  defaultRolePrompt,
  languageRule,
  sharedRules,
} from "../prompts/system.js";

import type { Config } from "../schemas/config.js";
import type { EffectivePermissions } from "../schemas/permissions.js";
import type { Role } from "../schemas/role.js";

export interface RoleSettings {
  readonly system: string;
  readonly model?: string;
  readonly permissions: EffectivePermissions;
}

function rolePrompt(config: Config, role: Role): string {
  const custom = config.roles[role];
  if (custom?.prompt === undefined) return defaultRolePrompt(role);
  if (custom.promptMode === "replace") return custom.prompt;
  return `${defaultRolePrompt(role)}\n\nProject-specific instructions:\n${custom.prompt}`;
}

/** Resolves system prompt, model and permissions for a role from the config. */
export function roleSettings(config: Config, role: Role): RoleSettings {
  const system = [
    sharedRules(),
    rolePrompt(config, role),
    languageRule(config.language),
  ].join("\n\n");
  const permissions = effectivePermissions(
    role,
    config.roles[role]?.permissions,
  );
  const model = config.models[role] ?? config.models.default;
  return model === undefined
    ? { system, permissions }
    : { system, model, permissions };
}
