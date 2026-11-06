import { verdictSchema, type Verdict } from "../schemas/verdict.js";

export type VerdictParseResult =
  | { readonly ok: true; readonly verdict: Verdict }
  | { readonly ok: false; readonly error: string };

const FENCED_JSON = /```(?:json)?\s*\n([\s\S]*?)```/g;

/** Takes the last fenced code block, or else the outermost braces. */
export function extractJson(output: string): string | null {
  const lastBlock = [...output.matchAll(FENCED_JSON)].at(-1)?.[1];
  if (lastBlock !== undefined) return lastBlock.trim();
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  return start === -1 || end < start ? null : output.slice(start, end + 1);
}

function parseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch (error: unknown) {
    return { ok: false, error: `Invalid JSON (${String(error)})` };
  }
}

/** Extracts and validates the reviewer's verdict from its answer. */
export function parseVerdict(output: string): VerdictParseResult {
  const json = extractJson(output);
  if (json === null)
    return { ok: false, error: "No JSON object found in the answer." };
  const parsed = parseJson(json);
  if (!parsed.ok) return parsed;
  const result = verdictSchema.safeParse(parsed.value);
  if (result.success) return { ok: true, verdict: result.data };
  const problems = result.error.issues.map(
    (issue) =>
      `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`,
  );
  return {
    ok: false,
    error: `The JSON does not match the format. ${problems.join("; ")}`,
  };
}
