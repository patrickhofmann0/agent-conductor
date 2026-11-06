const TOKEN = /\*\*\/|\*\*|\*|\?|\{[^{}]*\}|[.+^$()|[\]\\]/g;

const WILDCARDS: Readonly<Record<string, string>> = {
  "**/": "(?:.*/)?",
  "**": ".*",
  "*": "[^/]*",
  "?": "[^/]",
};

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function translate(token: string): string {
  const wildcard = WILDCARDS[token];
  if (wildcard !== undefined) return wildcard;
  if (token.startsWith("{")) {
    const alternatives = token.slice(1, -1).split(",").map(escapeLiteral);
    return `(?:${alternatives.join("|")})`;
  }
  return `\\${token}`;
}

/**
 * Converts a glob to a regular expression matching whole repository-relative
 * paths. Supports `**`, `*`, `?` and `{a,b}`; a leading `./` is ignored.
 */
export function globToRegExp(glob: string): RegExp {
  const normalized = glob.startsWith("./") ? glob.slice(2) : glob;
  return new RegExp(`^${normalized.replace(TOKEN, translate)}$`);
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(path));
}
