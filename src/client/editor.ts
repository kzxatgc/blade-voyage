import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { WINDOW_HEIGHT, WINDOW_WIDTH } from '../shared/constants';
import { EditorScene } from './scenes/EditorScene';

export const EDITOR_CONFIG: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'editor-container',
  backgroundColor: '#ffffff',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  scene: [EditorScene],
};

document.addEventListener('DOMContentLoaded', () => {
  new Game(EDITOR_CONFIG);
});
