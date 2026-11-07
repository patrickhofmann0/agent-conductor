import { createFileRunStore } from "../../adapters/store/file-run-store.js";
import {
  PLAN,
  REQUIREMENTS,
  reviewArtifact,
} from "../../core/pipeline/steps/artifacts.js";
import { archiveDirectory } from "../engine-setup.js";
import { UsageError } from "../errors.js";
import { formatRunDetails } from "../run-details.js";

import type { RunStore } from "../../core/ports/run-store.types.js";
import type { Command } from "../cli.types.js";

async function readReviews(
  store: RunStore,
  runId: string,
  iterations: number,
): Promise<string[]> {
  const reviews: string[] = [];
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const review = await store.readArtifact(runId, reviewArtifact(iteration));
    if (review === null) break;
    reviews.push(review);
  }
  return reviews;
}

/** `conductor show <run-id>`: prints an open or archived run with all reviews. */
export const showCommand: Command = async ({ args, io }) => {
  const [runId, ...rest] = args;
  if (runId === undefined || rest.length > 0) {
    throw new UsageError("show needs exactly one run ID.");
  }
  const store = createFileRunStore({
    repository: io.cwd,
    archiveDirectory: archiveDirectory(io.env),
  });
  const state = await store.loadState(runId);
  io.stdout(
    formatRunDetails({
      state,
      requirements: await store.readArtifact(runId, REQUIREMENTS),
      plan: await store.readArtifact(runId, PLAN),
      reviews: await readReviews(store, runId, state.iteration),
    }),
  );
  return 0;
};
