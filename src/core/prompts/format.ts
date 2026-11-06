import type { CheckResult } from "../schemas/check-result.js";
import type { Finding } from "../schemas/verdict.js";

export function section(title: string, content: string): string {
  const body = content.trim();
  return `## ${title}\n\n${body === "" ? "(empty)" : body}`;
}

export function joinSections(sections: readonly (string | null)[]): string {
  return sections.filter((part): part is string => part !== null).join("\n\n");
}

function location(finding: Finding): string {
  if (finding.file === undefined) return "";
  return finding.line === undefined
    ? ` (${finding.file})`
    : ` (${finding.file}:${String(finding.line)})`;
}

export function formatFindings(findings: readonly Finding[]): string {
  if (findings.length === 0) return "None.";
  return findings
    .map((finding) => {
      const suggestion =
        finding.suggestion === undefined
          ? ""
          : `\n  Suggestion: ${finding.suggestion}`;
      return `- [${finding.severity}] ${finding.id}${location(finding)}: ${finding.message}${suggestion}`;
    })
    .join("\n");
}

export function formatCheckResults(results: readonly CheckResult[]): string {
  if (results.length === 0) return "No checks are configured.";
  return results
    .map((result) => {
      const status = result.passed
        ? "passed"
        : result.timedOut
          ? "timed out"
          : "FAILED";
      const kind = result.required ? "required" : "optional";
      const header = `- ${result.name} (${kind}): ${status}`;
      if (result.passed || result.output.trim() === "") return header;
      return `${header}\n\n\`\`\`text\n${result.output.trim()}\n\`\`\``;
    })
    .join("\n");
}
