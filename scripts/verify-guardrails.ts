import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { evaluateGuardrails, scriptsDiffer } from "./guardrails.js";

const { values } = parseArgs({ options: { base: { type: "string" } } });
const base = values.base ?? "origin/main";
const approved = process.env["GUARDRAILS_APPROVED"] === "true";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function basePackageJson(): string {
  try {
    return git("show", `${base}:package.json`);
  } catch {
    return "";
  }
}

const changedFiles = git("diff", "--name-only", `${base}...HEAD`)
  .split("\n")
  .filter((line) => line !== "");

const result = evaluateGuardrails({
  changedFiles,
  packageScriptsChanged: scriptsDiffer(
    basePackageJson(),
    readFileSync("package.json", "utf8"),
  ),
  approved,
});

if (result.guardrailChanges.length > 0) {
  console.log("Guardrail changes:");
  for (const file of result.guardrailChanges) console.log(`  - ${file}`);
}
for (const message of result.messages) console.log(message);

process.exit(result.ok ? 0 : 1);
