import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const defaultMapsDirectory = resolve(projectRoot, 'public', 'assets', 'maps');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createEditorApi(mapsDirectory = defaultMapsDirectory) {
  const api = new Hono();

  api.post('/save-map', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'Request body must be valid JSON.' }, 400);
    }

    if (
      !isRecord(body) ||
      typeof body.filename !== 'string' ||
      !/^[a-zA-Z0-9_-]+\.json$/.test(body.filename)
    ) {
      return context.json({ error: 'Invalid map filename.' }, 400);
    }
    if ('overwrite' in body && typeof body.overwrite !== 'boolean') {
      return context.json({ error: 'Invalid overwrite option.' }, 400);
    }
    if (
      !isRecord(body.data) ||
      !isRecord(body.data.tiles) ||
      !Array.isArray(body.data.off_grid_tiles)
    ) {
      return context.json({ error: 'Invalid map data.' }, 400);
    }

    try {
      mkdirSync(mapsDirectory, { recursive: true });
      writeFileSync(
        resolve(mapsDirectory, body.filename),
        JSON.stringify(body.data, null, 2),
        { flag: body.overwrite === true ? 'w' : 'wx' }
      );
    } catch (error) {
      if (isRecord(error) && error.code === 'EEXIST') {
        return context.json({ error: 'Map already exists.' }, 409);
      }
      console.error(`Failed to save map "${body.filename}".`, error);
      return context.json({ error: 'Failed to save map.' }, 500);
    }

    return context.json({ message: `Map saved to ${body.filename}!` });
  });

  return api;
}

export const editorApi = createEditorApi();
