// Starts the server on 127.0.0.1 only, so nothing else on the network can reach it.
import { createApp, HOSTNAME, PORT } from './app.ts';
import { serve } from './http/serve.ts';

const server = serve(createApp().fetch, HOSTNAME, PORT, (port) => {
  console.log(`Listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
