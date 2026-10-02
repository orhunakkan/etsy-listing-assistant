// Serves the built client (client/dist) for `npm start`. Hono's generic serveStatic
// rejects `..`, backslashes and encoded paths; this file only supplies Node file reads.
// Registered after the API routes, so it never shadows them.
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';

const SERVER_PATHS = /^\/(api|oauth)(\/|$)/; // never answered with the client app

async function getContent(path: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    return new Uint8Array(await readFile(path));
  } catch {
    return null; // missing file or a directory
  }
}

async function isDir(path: string): Promise<boolean> {
  return (await stat(path).catch(() => undefined))?.isDirectory() ?? false;
}

export function serveClient(app: Hono, distDir: string): void {
  app.get('*', async (c, next) => (SERVER_PATHS.test(c.req.path) ? c.notFound() : next()));
  app.get('*', serveStatic({ root: distDir, join, getContent, isDir }));
  // Any other path is a client-side page (e.g. /settings), so it gets the app itself.
  app.get('*', serveStatic({ root: distDir, path: 'index.html', join, getContent }));
}
