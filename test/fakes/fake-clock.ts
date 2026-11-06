import type { Clock } from "../../src/core/ports/clock.types.js";

export class FakeClock implements Clock {
  constructor(private time = 1_000_000) {}

  now(): number {
    return this.time;
  }

  advance(ms: number): void {
    this.time += ms;
  }
}
