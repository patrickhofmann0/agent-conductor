const EXEMPT = [/(^|\/)index\.ts$/, /\.test\.ts$/, /\.d\.ts$/, /\.types\.ts$/];

export function findSourcesWithoutTests(files: readonly string[]): string[] {
  const normalized = new Set(files.map((file) => file.replaceAll("\\", "/")));
  return [...normalized]
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !EXEMPT.some((pattern) => pattern.test(file)))
    .filter((file) => !normalized.has(file.replace(/\.ts$/, ".test.ts")))
    .sort();
}
