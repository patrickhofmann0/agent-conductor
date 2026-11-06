import type { CheckResult } from "../schemas/check-result.js";
import type { Finding, Verdict } from "../schemas/verdict.js";

/**
 * The reviewer may not approve while a required check fails (ADR 0004). Such
 * an approval is turned into a change request for the coder.
 */
export function enforceRequiredChecks(
  verdict: Verdict,
  results: readonly CheckResult[],
): Verdict {
  const failed = results.filter((result) => result.required && !result.passed);
  if (verdict.verdict !== "approve" || failed.length === 0) return verdict;
  const finding: Finding = {
    id: "required-checks-failed",
    severity: "high",
    target: "coder",
    message: `Required checks failed: ${failed.map((result) => result.name).join(", ")}. The run cannot be approved until they pass.`,
    source: "framework",
  };
  return {
    ...verdict,
    verdict: "changes_requested",
    route: "coder",
    findings: [...verdict.findings, finding],
  };
}

/** Merges findings, keeping the first occurrence of each id. */
export function mergeFindings(
  ...lists: readonly (readonly Finding[])[]
): Finding[] {
  const byId = new Map<string, Finding>();
  for (const finding of lists.flat()) {
    if (!byId.has(finding.id)) byId.set(finding.id, finding);
  }
  return [...byId.values()];
}
