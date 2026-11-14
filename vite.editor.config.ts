import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

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
  plugins: [editorRootEntry],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});
