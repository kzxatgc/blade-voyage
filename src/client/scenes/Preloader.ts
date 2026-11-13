import { Scene } from 'phaser';

export const PRELOADER_KEY = 'Preloader';

export class Preloader extends Scene {
  constructor() {
    super(PRELOADER_KEY);
  }

  init() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.add
      .image(centerX, centerY, 'background')
      .setDisplaySize(this.scale.width, this.scale.height);

    this.add.rectangle(centerX, centerY, 468, 32).setStrokeStyle(1, 0xffffff);

    const bar = this.add.rectangle(centerX - 230, centerY, 4, 28, 0xffffff);
    this.load.on('progress', (progress: number) => {
      bar.width = 4 + 460 * progress;
    });
  }

  preload() {
    this.load.setPath('../assets');

    this.load.image('background/big_cloud', 'img/background/big_cloud.png');
    for (let frame = 0; frame < 3; frame++) {
      this.load.image(
        `background/cloud/${frame}`,
        `img/background/cloud/${frame}.png`
      );
    }

    this.load.image('icon', 'img/icon.png');

    for (let variant = 0; variant < 16; variant++) {
      const fileName = `${String(variant).padStart(2, '0')}.png`;
      this.load.image(`grass/${variant}`, `img/map/grass/${fileName}`);
    }
  }

  create() {
    this.scene.start('Game');
  }
}
