// Blocks requests that don't come from the app itself. The server binds to
// 127.0.0.1, but any web page the seller visits can still send requests to
// localhost; checking Host stops DNS rebinding and checking Origin stops
// cross-site requests (SPEC.md → Security).
import type { MiddlewareHandler } from 'hono';

export interface LocalOnlyOptions {
  hosts: readonly string[]; // allowed Host values, e.g. "localhost:3003"
  origins: readonly string[]; // allowed Origin values, e.g. "http://localhost:3003"
}

export function isLocalRequest(host: string, origin: string | undefined, options: LocalOnlyOptions): boolean {
  if (!options.hosts.includes(host.toLowerCase())) return false;
  // Same-origin GET navigations often send no Origin header; that's fine because Host already matched.
  return origin === undefined || options.origins.includes(origin.toLowerCase());
}

export function localOnly(options: LocalOnlyOptions): MiddlewareHandler {
  return async (c, next) => {
    // node-server builds the request URL from the Host header, so the URL's host is the Host the client sent.
    const host = new URL(c.req.url).host;
    if (!isLocalRequest(host, c.req.header('origin'), options)) {
      return c.json({ error: 'forbidden' }, 403);
    }
    return next();
  };
}
