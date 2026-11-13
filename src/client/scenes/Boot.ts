import { Scene } from 'phaser';

export const BOOT_KEY = 'Boot';

export class Boot extends Scene {
  constructor() {
    super(BOOT_KEY);
  }

  preload() {
    //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
    //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

    this.load.image('background', '../assets/img/background/background.png');
  }

  create() {
    this.scene.start('Preloader');
  }
}
