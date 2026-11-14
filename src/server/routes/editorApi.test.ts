/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { MapData } from '../../shared/types.js';

const editorApiUrl = new URL('./editorApi.ts', import.meta.url).href;
const getCreateEditorApi = async () =>
  (await import(editorApiUrl)).createEditorApi;

const validMap: MapData = {
  tiles: {
    '2;3': { type: 'grass', variant: 4, loc: [2, 3] },
  },
  off_grid_tiles: [
    {
      type: 'palm_tree/front/right',
      depth: 'front',
      status: 'animated',
      pos: [64, 96],
    },
  ],
};

void describe('Editor map save API', () => {
  void it('writes valid map data to a named JSON filename', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'blade-voyage-map-'));
    const mapsDirectory = join(temporaryDirectory, 'public', 'assets', 'maps');

    try {
      const createEditorApi = await getCreateEditorApi();
      const api = createEditorApi(mapsDirectory);
      const response = await api.request('/save-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: 'blade-voyage_2.json',
          data: validMap,
        }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(
        JSON.parse(
          readFileSync(join(mapsDirectory, 'blade-voyage_2.json'), 'utf8')
        ),
        validMap
      );

      const replacementMap: MapData = { tiles: {}, off_grid_tiles: [] };
      const conflictResponse = await api.request('/save-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: 'blade-voyage_2.json',
          data: replacementMap,
        }),
      });
      assert.equal(conflictResponse.status, 409);
      assert.deepEqual(
        JSON.parse(
          readFileSync(join(mapsDirectory, 'blade-voyage_2.json'), 'utf8')
        ),
        validMap
      );

      const overwriteResponse = await api.request('/save-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: 'blade-voyage_2.json',
          data: replacementMap,
          overwrite: true,
        }),
      });
      assert.equal(overwriteResponse.status, 200);
      assert.deepEqual(
        JSON.parse(
          readFileSync(join(mapsDirectory, 'blade-voyage_2.json'), 'utf8')
        ),
        replacementMap
      );
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  void it('rejects invalid filenames and malformed map data', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'blade-voyage-map-'));
    const mapsDirectory = join(temporaryDirectory, 'maps');

    try {
      const createEditorApi = await getCreateEditorApi();
      const api = createEditorApi(mapsDirectory);
      const invalidFilenameResponse = await api.request('/save-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: '../0.json', data: validMap }),
      });
      const invalidDataResponse = await api.request('/save-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: '0.json',
          data: { tiles: [], off_grid_tiles: [] },
        }),
      });

      assert.equal(invalidFilenameResponse.status, 400);
      assert.equal(invalidDataResponse.status, 400);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
