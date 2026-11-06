export interface ModelRef {
  readonly providerID: string;
  readonly id: string;
  readonly variant?: string;
}

/**
 * Parses "provider/model" or "provider/model#variant". The model ID may itself
 * contain slashes (for example "openrouter/anthropic/claude").
 */
export function parseModel(model: string): ModelRef {
  const [path = "", variant] = model.split("#", 2);
  const slash = path.indexOf("/");
  const providerID = path.slice(0, slash);
  const id = path.slice(slash + 1);
  if (slash <= 0 || id === "" || variant === "") {
    throw new Error(
      `Invalid model "${model}", expected "provider/model" or "provider/model#variant"`,
    );
  }
  return variant === undefined
    ? { providerID, id }
    : { providerID, id, variant };
}
