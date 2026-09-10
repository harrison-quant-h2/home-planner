import { defineConfig, loadEnv } from 'vite';
import { zillowBridge } from './server/zillow-mcp.js';
export default defineConfig(({ mode }) => ({
  base: './',
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4173, strictPort: true, host: '127.0.0.1' },
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [
    {
      name: 'local-zillow-mcp',
      configureServer(server) {
        server.middlewares.use(
          zillowBridge({
            enabled: mode === 'zillow',
            env: loadEnv(mode, process.cwd(), 'ZILLOW_'),
          }),
        );
      },
    },
  ],
}));
