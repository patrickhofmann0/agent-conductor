import { describe, expect, it } from "vitest";

import { FakeForge } from "../../../test/fakes/fake-forge.js";

import { createForgePublisher } from "./forge-publisher.js";

import type { PublishRequest } from "../ports/publisher.types.js";

function publisher(forge: FakeForge): {
  publish: (request: PublishRequest) => Promise<void>;
  pushed: () => number;
} {
  let pushes = 0;
  const created = createForgePublisher({
    forge,
    push: () => {
      pushes += 1;
      return Promise.resolve();
    },
    baseBranch: "main",
    needsHumanLabel: "conductor:needs-human",
  });
  return { publish: (r) => created.publish(r), pushed: () => pushes };
}

function request(overrides: Partial<PublishRequest>): PublishRequest {
  return {
    runId: "run",
    stage: "gate",
    title: "Add CSV export",
    body: "BODY",
    branch: "conductor/run",
    issueRef: "o/r#42",
    ...overrides,
  };
}

describe("createForgePublisher", () => {
  it("pushes and opens a draft pull request at a gate", async () => {
    const forge = new FakeForge();
    const pub = publisher(forge);

    await pub.publish(request({}));

    expect(pub.pushed()).toBe(1);
    expect(forge.pullRequests).toEqual([
      expect.objectContaining({
        branch: "conductor/run",
        base: "main",
        title: "Add CSV export",
        body: "BODY",
        draft: true,
      }),
    ]);
  });

  it("updates the pull request and marks it ready when done", async () => {
    const forge = new FakeForge();
    const pub = publisher(forge);
    await pub.publish(request({}));

    await pub.publish(request({ stage: "final", body: "DONE", title: "T2" }));

    expect(forge.pullRequests).toEqual([
      expect.objectContaining({
        title: "T2",
        body: "DONE\n\nCloses o/r#42",
        draft: false,
      }),
    ]);
    expect(pub.pushed()).toBe(2);
  });

  it("creates a ready pull request directly when done", async () => {
    const forge = new FakeForge();

    await publisher(forge).publish(request({ stage: "final", issueRef: null }));

    expect(forge.pullRequests[0]).toEqual(
      expect.objectContaining({ body: "BODY", draft: false }),
    );
  });

  it("keeps a draft with a label when a human must take over", async () => {
    const forge = new FakeForge();
    const pub = publisher(forge);
    await pub.publish(request({}));

    await pub.publish(request({ stage: "needs_human" }));

    expect(forge.pullRequests[0]).toEqual(
      expect.objectContaining({
        draft: true,
        labels: ["conductor:needs-human"],
      }),
    );
  });
});
