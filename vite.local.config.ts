import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

const localGameRootEntry: Plugin = {
  name: 'local-game-root-entry',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === '/') {
        request.url = '/game.html';
      }

      next();
    });
  },
};

export default defineConfig({
  root: resolve(projectRoot, 'src/client'),
  publicDir: resolve(projectRoot, 'public'),
  plugins: [localGameRootEntry],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
