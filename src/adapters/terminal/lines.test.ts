import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLineReader } from "./lines.js";

describe("createLineReader", () => {
  it("returns buffered lines in order, then undefined at the end", async () => {
    const input = new PassThrough();
    input.end("first\r\nsecond\n");
    const reader = createLineReader(input);
    expect(await reader.next()).toBe("first");
    expect(await reader.next()).toBe("second");
    expect(await reader.next()).toBeUndefined();
  });

  it("returns undefined after close", async () => {
    const input = new PassThrough();
    const reader = createLineReader(input);
    reader.close();
    expect(await reader.next()).toBeUndefined();
  });
});
