import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// API_TARGET lets the web dev server talk to an API on another machine (e.g. a teammate's laptop).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_TARGET || 'http://localhost:3000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@educaro/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, ws: true, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
  };
});
