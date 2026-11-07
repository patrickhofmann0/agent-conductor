import { stripVTControlCharacters } from "node:util";

/** Share of the budget kept from the start; failures usually show at the end. */
const HEAD_SHARE = 0.25;

/**
 * Removes terminal colors and shortens `text` to at most `maxChars` characters
 * plus a marker, keeping the beginning and, with most of the budget, the end.
 */
export function truncateOutput(text: string, maxChars: number): string {
  const clean = stripVTControlCharacters(text);
  if (clean.length <= maxChars) return clean;
  const head = Math.floor(maxChars * HEAD_SHARE);
  const tail = maxChars - head;
  const omitted = clean.length - head - tail;
  return `${clean.slice(0, head)}\n… ${String(omitted)} characters omitted …\n${clean.slice(clean.length - tail)}`;
}
