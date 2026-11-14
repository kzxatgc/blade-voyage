import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: resolve(projectRoot, 'src/client'),
  publicDir: resolve(projectRoot, 'public'),
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
