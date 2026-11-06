import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { startOpencodeServer } from "./server.js";

function node(script: string): readonly string[] {
  return [process.execPath, "-e", script];
}

const LISTEN = `
if (!process.env.OPENCODE_SERVER_PASSWORD) process.exit(3);
console.log("server listening on http://127.0.0.1:4321");
setInterval(() => {}, 1000);
`;

describe("startOpencodeServer", () => {
  it("returns the announced URL and a basic auth header", async () => {
    const server = await startOpencodeServer({
      directory: tmpdir(),
      startupTimeoutMs: 5000,
      command: node(LISTEN),
    });
    try {
      expect(server.url).toBe("http://127.0.0.1:4321");
      const token = server.authorization.replace(/^Basic /, "");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toMatch(/^opencode:[\w-]{43}$/);
    } finally {
      await server.stop();
    }
  });

  it("can be stopped more than once", async () => {
    const server = await startOpencodeServer({
      directory: tmpdir(),
      startupTimeoutMs: 5000,
      command: node(LISTEN),
    });
    await server.stop();
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it("fails with the output when the process exits early", async () => {
    await expect(
      startOpencodeServer({
        directory: tmpdir(),
        startupTimeoutMs: 5000,
        command: node(`console.error("boom"); process.exit(2);`),
      }),
    ).rejects.toThrow(/exited with code 2\nboom/);
  });

  it("fails when the server does not announce itself in time", async () => {
    await expect(
      startOpencodeServer({
        directory: tmpdir(),
        startupTimeoutMs: 200,
        command: node(`setInterval(() => {}, 1000);`),
      }),
    ).rejects.toThrow(/did not start within 200 ms/);
  });

  it("fails when the command cannot be spawned", async () => {
    await expect(
      startOpencodeServer({
        directory: tmpdir(),
        startupTimeoutMs: 5000,
        command: ["/nonexistent/opencode"],
      }),
    ).rejects.toThrow(/failed to start: .*ENOENT/);
  });
});
