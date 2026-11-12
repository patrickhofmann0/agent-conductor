import type { Forge, PullRequest } from "../ports/forge.types.js";
import type { Publisher, PublishRequest } from "../ports/publisher.types.js";

export interface ForgePublisherOptions {
  readonly forge: Forge;
  /** Pushes the current branch to the forge. */
  readonly push: () => Promise<void>;
  readonly baseBranch: string;
  readonly needsHumanLabel: string;
}

function body(forge: Forge, request: PublishRequest): string {
  if (request.issueRef === null || request.stage === "gate") {
    return request.body;
  }
  return `${request.body}\n\n${forge.closingReference(request.issueRef)}`;
}

async function upsert(
  options: ForgePublisherOptions,
  request: PublishRequest,
  draft: boolean,
): Promise<PullRequest> {
  const { forge } = options;
  const content = { title: request.title, body: body(forge, request) };
  const existing = await forge.findPullRequest(request.branch);
  if (existing === null) {
    return forge.createPullRequest({
      ...content,
      branch: request.branch,
      base: options.baseBranch,
      draft,
    });
  }
  await forge.updatePullRequest(existing, content);
  if (existing.draft !== draft) await forge.setDraft(existing, draft);
  return existing;
}

/**
 * Pushes the branch and keeps one pull request per run up to date: a draft
 * while waiting at gates or when a human must take over, ready when done.
 */
export function createForgePublisher(
  options: ForgePublisherOptions,
): Publisher {
  return {
    publish: async (request) => {
      await options.push();
      const pr = await upsert(options, request, request.stage !== "final");
      if (request.stage === "needs_human") {
        await options.forge.addLabels(pr, [options.needsHumanLabel]);
      }
    },
  };
}
