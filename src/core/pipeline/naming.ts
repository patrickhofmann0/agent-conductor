const MAX_SLUG_LENGTH = 40;

/** Turns a title into a lowercase, dash-separated branch-name fragment. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug === "" ? "feature" : slug;
}

/**
 * Builds a sortable run id like "20261106-213045-k3x9" from a timestamp and a
 * random suffix provided by the caller.
 */
export function formatRunId(timestampMs: number, suffix: string): string {
  if (!/^[a-z0-9]{4,8}$/.test(suffix)) {
    throw new Error(
      `Run id suffix must be 4-8 lowercase letters or digits, got "${suffix}".`,
    );
  }
  const iso = new Date(timestampMs).toISOString();
  const date = iso.slice(0, 10).replaceAll("-", "");
  const time = iso.slice(11, 19).replaceAll(":", "");
  return `${date}-${time}-${suffix}`;
}

export function branchName(
  prefix: string,
  runId: string,
  title: string,
): string {
  return `${prefix}${runId}-${slugify(title)}`;
}
