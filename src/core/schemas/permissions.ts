import { z } from "zod";

const permissionSchema = z.enum(["allow", "deny"]);

export type Permission = z.infer<typeof permissionSchema>;

/** Either one permission for all commands, or command patterns mapped to permissions. */
export const bashPermissionSchema = z.union([
  permissionSchema,
  z.record(z.string().min(1), permissionSchema),
]);

/** Permission overrides for a role, as written in conductor.yaml. */
export const permissionOverridesSchema = z.strictObject({
  edit: permissionSchema.optional(),
  bash: bashPermissionSchema.optional(),
  webfetch: permissionSchema.optional(),
});

export type PermissionOverrides = z.infer<typeof permissionOverridesSchema>;

/**
 * Fully resolved permissions passed to the agent harness.
 * `bash` patterns are ordered; later entries take precedence.
 */
export interface EffectivePermissions {
  readonly edit: Permission;
  readonly bash: Readonly<Record<string, Permission>>;
  readonly webfetch: Permission;
}
