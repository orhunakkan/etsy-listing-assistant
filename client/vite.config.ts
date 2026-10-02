// Builds the React client into client/dist, which the server serves in production.
// Type-checked by tsc (tsconfig.node.json), not by Vite.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
