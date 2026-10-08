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
      // 0.0.0.0 so a tunnel (ngrok, cloudflared) or another machine on the wifi can reach it.
      host: true,
      // Vite 7 refuses a request whose Host header it does not recognise, which is every tunnel
      // URL — the browser just gets "Blocked request. This host is not allowed." `true` accepts
      // any host. Safe here because this is a dev server we point at a tunnel deliberately, and
      // it is never how the app is served in production.
      allowedHosts: true,
      // Over a tunnel the page is https but the HMR socket would still try the local ws:// port
      // and fail, which leaves a console full of errors during a demo. Through a tunnel, set
      // TUNNEL_HOST and HMR goes over the same wss:// origin as the page.
      hmr: env.TUNNEL_HOST ? { protocol: 'wss', host: env.TUNNEL_HOST, clientPort: 443 } : undefined,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, ws: true, changeOrigin: true },
      },
    },
    // `npm run build && npm run preview` is the steadier way to show this over a tunnel: the real
    // production bundle, no HMR socket to fail, and the same /api and /socket.io proxying.
    preview: {
      port: 4173,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, ws: true, changeOrigin: true },
      },
    },
  };
});
