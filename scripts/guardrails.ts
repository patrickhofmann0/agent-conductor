/**
 * Files that define how this project is verified. Changing them can silently
 * weaken every other check, so they are protected (see docs/adr/0010).
 */
const GUARDRAIL_PATTERNS: readonly RegExp[] = [
  /^tsconfig[^/]*\.json$/,
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.prettierrc[^/]*$/,
  /^\.prettierignore$/,
  /^\.dependency-cruiser\.[cm]?js$/,
  /^knip\.jsonc?$/,
  /^vitest\.config\.[cm]?[jt]s$/,
  /^stryker\.config\.[^/]+$/,
  /^lefthook\.ya?ml$/,
  /^commitlint\.config\.[cm]?[jt]s$/,
  /^\.github\//,
  /^scripts\//,
  /^AGENTS\.md$/,
];

const CODE_PATTERN = /^(src|test)\//;

export function isGuardrailPath(path: string): boolean {
  return GUARDRAIL_PATTERNS.some((pattern) => pattern.test(path));
}

export interface GuardrailInput {
  readonly changedFiles: readonly string[];
  readonly packageScriptsChanged: boolean;
  readonly approved: boolean;
}

export interface GuardrailResult {
  readonly ok: boolean;
  readonly guardrailChanges: readonly string[];
  readonly messages: readonly string[];
}

export function evaluateGuardrails(input: GuardrailInput): GuardrailResult {
  const guardrailChanges = input.changedFiles.filter(isGuardrailPath);
  if (input.packageScriptsChanged)
    guardrailChanges.push("package.json#scripts");

  if (guardrailChanges.length === 0) {
    return {
      ok: true,
      guardrailChanges,
      messages: ["No guardrail files changed."],
    };
  }

  const messages: string[] = [];
  if (!input.approved) {
    messages.push(
      "Guardrail files changed without approval. A maintainer must add the `guardrails-change` label.",
    );
  }
  const codeChanges = input.changedFiles.filter((file) =>
    CODE_PATTERN.test(file),
  );
  if (codeChanges.length > 0) {
    messages.push(
      `Guardrail changes must not be combined with code changes. Split the PR. Code files: ${codeChanges.join(", ")}`,
    );
  }

  return { ok: messages.length === 0, guardrailChanges, messages };
}

export function scriptsDiffer(
  basePackageJson: string,
  headPackageJson: string,
): boolean {
  return (
    JSON.stringify(readScripts(basePackageJson)) !==
    JSON.stringify(readScripts(headPackageJson))
  );
}

function readScripts(packageJson: string): unknown {
  if (packageJson.trim() === "") return null;
  const parsed: unknown = JSON.parse(packageJson);
  if (typeof parsed !== "object" || parsed === null || !("scripts" in parsed))
    return null;
  return parsed.scripts;
}
