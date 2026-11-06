import type {
  Publisher,
  PublishRequest,
} from "../../src/core/ports/publisher.types.js";
import type {
  Reporter,
  RunEvent,
} from "../../src/core/ports/reporter.types.js";

export class FakePublisher implements Publisher {
  readonly published: PublishRequest[] = [];

  publish(request: PublishRequest): Promise<void> {
    this.published.push(request);
    return Promise.resolve();
  }
}

export class FakeReporter implements Reporter {
  readonly events: RunEvent[] = [];

  report(event: RunEvent): void {
    this.events.push(event);
  }

  ofType<T extends RunEvent["type"]>(
    type: T,
  ): Extract<RunEvent, { type: T }>[] {
    return this.events.filter(
      (event): event is Extract<RunEvent, { type: T }> => event.type === type,
    );
  }
}
