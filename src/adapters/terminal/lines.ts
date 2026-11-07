import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

export interface LineReader {
  /** The next line, or undefined when the input has ended. */
  next(): Promise<string | undefined>;
  close(): void;
}

/** Reads lines one at a time; lines that arrive early are buffered, not lost. */
export function createLineReader(input: Readable): LineReader {
  const lines = createInterface({ input, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  return {
    next: async () => {
      const result = await iterator.next();
      return result.done === true ? undefined : result.value;
    },
    close: () => {
      lines.close();
    },
  };
}
