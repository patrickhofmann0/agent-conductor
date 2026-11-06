/**
 * GUARDRAIL FILE. Changes require the `guardrails-change` label and must not
 * be combined with changes in src/ or test/. See docs/adr/0009 and 0010.
 *
 * Architecture: ports & adapters.
 *   src/core      pure orchestration logic, no I/O, no SDKs
 *   src/adapters  implementations of core ports, isolated from each other
 *   src/cli       entry point, wires adapters into core
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "error",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
          "\\.d\\.ts$",
          "(^|/)tsconfig\\.json$",
          "\\.test\\.ts$",
          "^scripts/[^/]+\\.ts$",
          "^src/cli/index\\.ts$",
        ],
      },
      to: {},
    },
    {
      name: "core-is-pure",
      comment: "core must not depend on adapters, cli, or any I/O module.",
      severity: "error",
      from: { path: "^src/core/", pathNot: "\\.test\\.ts$" },
      to: {
        pathNot: ["^src/core/", "^node_modules/zod/", "^node:path$", "^path$"],
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "core-no-io-types",
      comment: "core may only reference types from core or zod.",
      severity: "error",
      from: { path: "^src/core/" },
      to: { path: "^src/(adapters|cli)/" },
    },
    {
      name: "adapters-isolated",
      comment: "An adapter may not import another adapter.",
      severity: "error",
      from: { path: "^src/adapters/([^/]+)/" },
      to: { path: "^src/adapters/", pathNot: "^src/adapters/$1/" },
    },
    {
      name: "adapters-only-ports-and-schemas",
      comment: "Adapters may only use core ports and schemas.",
      severity: "error",
      from: { path: "^src/adapters/" },
      to: { path: "^src/core/", pathNot: "^src/core/(ports|schemas)/" },
    },
    {
      name: "nothing-depends-on-cli",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/cli/" },
      to: { path: "^src/cli/" },
    },
    {
      name: "src-not-to-test",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^test/" },
    },
    {
      name: "fakes-only-core",
      severity: "error",
      from: { path: "^test/fakes/" },
      to: { path: "^src/", pathNot: "^src/core/" },
    },
    {
      name: "no-dev-deps-in-src",
      severity: "error",
      from: { path: "^src/", pathNot: "\\.test\\.ts$" },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(dist|coverage|reports|\\.stryker-tmp)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".js", ".json"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
