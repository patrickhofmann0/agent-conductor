import { z } from "zod";

const DURATION_PATTERN = /^(?:(?<h>\d+)h)?(?:(?<m>\d+)m)?(?:(?<s>\d+)s)?$/;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

function amount(value: string | undefined): number {
  return value === undefined ? 0 : Number(value);
}

/** Parses durations like "90s", "20m", "2h" or "1h30m" into milliseconds. */
export function parseDuration(text: string): number | null {
  const groups = DURATION_PATTERN.exec(text)?.groups;
  if (groups === undefined) return null;
  const total =
    amount(groups["h"]) * MS_PER_HOUR +
    amount(groups["m"]) * MS_PER_MINUTE +
    amount(groups["s"]) * MS_PER_SECOND;
  return total > 0 ? total : null;
}

/** A duration string in the config file, parsed to milliseconds. */
export const durationSchema = z
  .string()
  .regex(
    /^(\d+h)?(\d+m)?(\d+s)?$/,
    'Use a duration like "90s", "20m" or "1h30m".',
  )
  .transform((text, ctx) => {
    const ms = parseDuration(text);
    if (ms === null) {
      ctx.addIssue({
        code: "custom",
        message: "Duration must be greater than zero.",
      });
      return z.NEVER;
    }
    return ms;
  });
