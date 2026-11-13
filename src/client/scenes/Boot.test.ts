/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const bootSource = readFileSync(new URL('./Boot.ts', import.meta.url), 'utf8');
const preloaderSource = readFileSync(
  new URL('./Preloader.ts', import.meta.url),
  'utf8'
);

void describe('Scene keys', () => {
  void it('exports the Boot scene key', () => {
    assert.match(bootSource, /export const BOOT_KEY\s*=\s*['"]Boot['"]/);
  });

  void it('exports the Preloader scene key', () => {
    assert.match(preloaderSource, /export const PRELOADER_KEY\s*=\s*['"]Preloader['"]/);
  });
});
