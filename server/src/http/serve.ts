// Serves a fetch-style handler (such as a Hono app) over node:http, using
// Node's built-in Request/Response. Replaces @hono/node-server, whose type
// definitions need browser-only types and fail the strict typecheck
// (SPEC.md → Tech stack).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type FetchHandler = (request: Request) => Response | Promise<Response>;

export function toRequest(req: IncomingMessage): Request {
  // The URL keeps the Host header the client sent, so middleware can check it.
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'invalid.host'}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method ?? 'GET',
    headers,
    ...(hasBody && { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half' }),
  });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of response.headers) {
    if (name !== 'set-cookie') headers[name] = value;
  }
  // Headers iteration joins Set-Cookie values with commas, which breaks cookies; send them one by one.
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  if (response.body) await pipeline(Readable.fromWeb(response.body), res);
  else res.end();
}

export function serve(handler: FetchHandler, hostname: string, port: number, onListening?: (port: number) => void): Server {
  const server = createServer((req, res) => {
    Promise.resolve()
      .then(() => handler(toRequest(req)))
      .then((response) => send(res, response))
      .catch((error: unknown) => {
        console.error('Request failed:', error instanceof Error ? error.message : error);
        // If the response already started streaming, all we can do is end it.
        if (res.headersSent) return void res.end();
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
      });
  });
  server.listen(port, hostname, () => {
    const address = server.address();
    if (onListening && typeof address === 'object' && address) onListening(address.port);
  });
  return server;
}
