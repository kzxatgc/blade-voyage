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

    const playerAnimationFiles: Record<string, string[]> = {
      fall: ['0.png'],
      hit: ['0.png', '1.png', '2.png', '3.png'],
      idle: ['0.png', '1.png', '2.png', '3.png', '4.png'],
      jump: ['0.png', '1.png', '2.png'],
      land: ['0.png', '1.png'],
      run: ['0.png', '1.png', '2.png', '3.png', '4.png', '5.png'],
      throw_sword: ['0.png', '1.png', '2.png'],
      'sword/air_attack_1': ['0.png', '1.png', '2.png'],
      'sword/air_attack_2': ['0.png', '1.png', '2.png'],
      'sword/attack_1': ['0.png', '1.png', '2.png'],
      'sword/attack_2': ['0.png', '1.png', '2.png'],
      'sword/attack_3': ['0.png', '1.png', '2.png'],
      'sword/attack_effect/air_attack_1': [
        'Air Attack 1 01.png',
        'Air Attack 1 02.png',
      ],
      'sword/attack_effect/air_attack_2': ['0.png', '1.png'],
      'sword/attack_effect/attack_1': ['0.png', '1.png', '2.png'],
      'sword/attack_effect/attack_2': ['0.png', '1.png', '2.png'],
      'sword/attack_effect/attack_3': ['0.png', '1.png', '2.png'],
      'sword/fall': ['0.png'],
      'sword/hit': ['0.png', '1.png', '2.png', '3.png'],
      'sword/idle': ['0.png', '1.png', '2.png', '3.png', '4.png'],
      'sword/jump': ['0.png', '1.png', '2.png'],
      'sword/land': ['0.png', '1.png'],
      'sword/run': ['0.png', '1.png', '2.png', '3.png', '4.png', '5.png'],
    };

    for (const [animation, files] of Object.entries(playerAnimationFiles)) {
      files.forEach((fileName, frame) => {
        this.load.image(
          `player/${animation}/${frame}`,
          `img/entities/player/${animation}/${fileName}`
        );
      });
    }

    const spriteAnimationFiles: Record<string, string[]> = {
      'sword/idle': [
        '0.png',
        '1.png',
        '2.png',
        '3.png',
        '4.png',
        '5.png',
        '6.png',
        '7.png',
      ],
      'sword/fall': ['0.png'],
      'sword/spinning': ['0.png', '1.png', '2.png', '3.png'],
      'sword/embedded': ['0.png', '1.png', '2.png', '3.png'],
      'particle/run_dust': ['0.png', '1.png', '2.png', '3.png', '4.png'],
      'particle/jump_dust': ['0.png', '1.png', '2.png', '3.png', '4.png', '5.png'],
      'particle/land_dust': ['0.png', '1.png', '2.png', '3.png', '4.png'],
      'dialogue/exclamation': ['0.png', '1.png', '2.png', '3.png', '4.png'],
      'dialogue/dead': ['0.png', '1.png', '2.png', '3.png', '4.png'],
    };

    for (const [animation, files] of Object.entries(spriteAnimationFiles)) {
      files.forEach((fileName, frame) => {
        this.load.image(
          `${animation}/${frame}`,
          `img/${animation}/${fileName}`
        );
      });
    }
  }

  create() {
    this.scene.start('Game');
  }
}
