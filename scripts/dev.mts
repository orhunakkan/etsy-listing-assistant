// `npm run dev`: runs the server (restarting on changes) and the Vite dev server together.
// Vite proxies /api and /oauth to the server, so open http://localhost:5173. Ctrl+C, or
// either process exiting, stops both. Plain child processes, because `&` in npm scripts
// doesn't work on Windows.
import { type ChildProcess, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = fileURLToPath(new URL('../server', import.meta.url));
const CLIENT_DIR = fileURLToPath(new URL('../client', import.meta.url));
const VITE = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const children: ChildProcess[] = [];
let stopping = false;

function stopAll(exitCode: number): void {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

function start(name: string, args: string[], cwd: string): void {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (!stopping) console.log(`[dev] ${name} exited (${signal ?? code}), stopping the other process.`);
    stopAll(code === 0 ? 0 : 1); // Windows reports a killed process as 4294967295; keep it simple
  });
  children.push(child);
}

start('server', ['--watch', '--env-file-if-exists=../.env', 'src/index.ts'], SERVER_DIR);
start('client', [VITE], CLIENT_DIR);

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stopAll(0));
