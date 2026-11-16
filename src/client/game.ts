import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { TARGET_FPS, WINDOW_HEIGHT, WINDOW_WIDTH } from '../shared/constants';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#000000',
  disableContextMenu: true,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  fps: {
    target: TARGET_FPS,
    forceSetTimeOut: false,
  },
  scale: {
    // Keep a fixed game resolution but automatically scale it to fit within the available
    // web-view / device while maintaining aspect ratio.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  scene: [Boot, Preloader, MainGame],
};

const StartGame = (parent: string) => {
  return new Game({ ...GAME_CONFIG, parent });
};

document.addEventListener('DOMContentLoaded', () => {
  StartGame('game-container');
});
