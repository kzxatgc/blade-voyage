import { getRequestListener } from '@hono/node-server';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { editorApi } from './src/server/routes/editorApi';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const apiRequestListener = getRequestListener(editorApi.fetch);

const editorMapApi: Plugin = {
  name: 'editor-map-api',
  configureServer(server) {
    server.middlewares.use('/api', apiRequestListener);
  },
};

const editorRootEntry: Plugin = {
  name: 'editor-root-entry',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === '/') {
        request.url = '/editor.html';
      }

      next();
    });
  },
};

export default defineConfig({
  root: resolve(projectRoot, 'src/client'),
  publicDir: resolve(projectRoot, 'public'),
  plugins: [editorMapApi, editorRootEntry],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});
