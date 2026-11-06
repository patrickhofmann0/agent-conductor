import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
  readonly body: unknown;
}

export interface MockOpencode {
  readonly url: string;
  readonly requests: RecordedRequest[];
  /** Sends one event to every connected `/api/event` stream. */
  emit(event: object): void;
  close(): Promise<void>;
}

/** Route key "METHOD /path"; the handler's return value is sent as JSON. */
export type MockRoutes = Record<
  string,
  (body: unknown, mock: MockOpencode) => unknown
>;

interface Context {
  readonly routes: MockRoutes;
  readonly mock: MockOpencode;
  readonly streams: ServerResponse[];
}

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => {
      raw += chunk.toString();
    });
    request.on("end", () => {
      resolve(raw === "" ? undefined : JSON.parse(raw));
    });
  });
}

function sendEvent(response: ServerResponse, event: object): void {
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function handle(
  context: Context,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const path = (request.url ?? "").split("?")[0] ?? "";
  const method = request.method ?? "GET";
  const body = await readBody(request);
  const { authorization } = request.headers;
  context.mock.requests.push({ method, path, authorization, body });
  if (path === "/api/event") {
    response.writeHead(200, { "content-type": "text/event-stream" });
    sendEvent(response, { type: "server.connected", id: "e0", created: 0 });
    context.streams.push(response);
    return;
  }
  const handler = context.routes[`${method} ${path}`];
  if (handler === undefined) {
    sendJson(response, 404, {
      _tag: "NotFoundError",
      message: `No route ${path}`,
    });
    return;
  }
  const result = handler(body, context.mock);
  if (result === undefined) {
    response.writeHead(204).end();
    return;
  }
  sendJson(response, 200, result);
}

/** A stand-in for the OpenCode V2 HTTP API, for adapter contract tests. */
export async function startMockOpencode(
  routes: MockRoutes,
): Promise<MockOpencode> {
  const streams: ServerResponse[] = [];
  const server = createServer((request, response) => {
    void handle({ routes, mock, streams }, request, response);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 0;
  const mock: MockOpencode = {
    url: `http://127.0.0.1:${String(port)}`,
    requests: [],
    emit: (event) => {
      for (const stream of streams) sendEvent(stream, event);
    },
    close: () =>
      new Promise((resolve) => {
        for (const stream of streams) stream.end();
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
  return mock;
}
