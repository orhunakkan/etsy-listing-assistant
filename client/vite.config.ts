// Builds the React client into client/dist, which the server serves in production.
// Type-checked by tsc (tsconfig.node.json), not by Vite.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// changeOrigin sets Host to the server's own (localhost:3003), which its local-only check
// requires. The browser's Origin (localhost:5173) passes through and is on its allow list.
const SERVER = { target: 'http://localhost:3003', changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': SERVER, '/oauth': SERVER } },
});
