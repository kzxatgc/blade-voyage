import { Scene } from 'phaser';
import { SFX_DEFINITIONS } from '../systems/Audio';

export const PRELOADER_KEY = 'Preloader';
const DEBUG_SKIP_TITLE_SCREEN = false;

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

    this.load.audio('settings-click', 'sfx/ui/settings-click.wav');
    this.load.image('title-player-avatar', 'img/ui/title/player-avatar.png');
    this.load.image('title-next', 'img/ui/title/next-button.png');
    this.load.image(
      'title-next-pressed',
      'img/ui/title/next-button-pressed.png'
    );
    this.load.spritesheet(
      'level-boxes',
      'img/ui/level-select/level-boxes.png',
      { frameWidth: 32, frameHeight: 32 }
    );
    this.load.spritesheet(
      'level-digits',
      'img/ui/level-select/level-digits.png',
      { frameWidth: 32, frameHeight: 32 }
    );
    this.load.spritesheet(
      'level-nav-arrows',
      'img/ui/level-select/level-nav-arrows.png',
      { frameWidth: 32, frameHeight: 32 }
    );
    this.load.image('touch-left', 'img/ui/touch/left.png');
    this.load.image('touch-right', 'img/ui/touch/right.png');
    this.load.image('touch-down', 'img/ui/touch/down.png');
    this.load.image('touch-jump', 'img/ui/touch/jump.png');
    this.load.image('touch-attack', 'img/ui/touch/attack.png');
    this.load.image('touch-throw', 'img/ui/touch/throw.png');
    this.load.image('touch-settings-gear', 'img/ui/settings/gear.png');
    this.load.image(
      'touch-settings-gear-open',
      'img/ui/settings/gear-open.png'
    );
    this.load.image(
      'touch-settings-sound-on',
      'img/ui/settings/sound-on.png'
    );
    this.load.image(
      'touch-settings-sound-off',
      'img/ui/settings/sound-off.png'
    );
    this.load.image(
      'touch-settings-controls-on',
      'img/ui/settings/controls-on.png'
    );
    this.load.image(
      'touch-settings-controls-off',
      'img/ui/settings/controls-off.png'
    );
    this.load.image('touch-settings-hint-on', 'img/ui/settings/hint-on.png');
    this.load.image('touch-settings-hint-off', 'img/ui/settings/hint-off.png');
    this.load.image('touch-settings-panel', 'img/ui/settings/panel.png');
    this.load.image('touch-settings-button', 'img/ui/settings/button.png');
    this.load.bitmapFont(
      'touch-settings-font',
      'img/font/font.png',
      'img/font/font.fnt'
    );

    this.load.image('background/big_cloud', 'img/background/big_cloud.png');
    this.load.image('background/water', 'img/background/water/base.png');
    for (const size of ['small', 'medium', 'big']) {
      for (let frame = 0; frame < 4; frame++) {
        this.load.image(
          `water_reflect/${size}/${frame}`,
          `img/background/water/${size}/${frame}.png`
        );
      }
    }

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
      dead_hit: ['0.png', '1.png', '2.png', '3.png'],
      dead: ['0.png', '1.png', '2.png', '3.png'],
      'sword/dead_hit': ['0.png', '1.png', '2.png', '3.png'],
      'sword/dead': ['0.png', '1.png', '2.png', '3.png'],
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

    const enemyAnimationFrameCounts: Record<string, Record<string, number>> = {
      pink_star: {
        anticipation: 3,
        attack: 4,
        attack_effect: 4,
        dead: 4,
        dead_hit: 4,
        hit: 4,
        idle: 8,
        run: 6,
      },
      crabby: {
        anticipation: 3,
        attack: 4,
        attack_effect: 3,
        dead: 4,
        dead_hit: 4,
        hit: 4,
        idle: 9,
        run: 6,
      },
      fierce_tooth: {
        anticipation: 3,
        attack: 5,
        attack_effect: 3,
        dead: 4,
        dead_hit: 4,
        hit: 4,
        idle: 8,
        run: 6,
      },
    };

    for (const [enemy, animations] of Object.entries(enemyAnimationFrameCounts)) {
      for (const [animation, frameCount] of Object.entries(animations)) {
        for (let frame = 0; frame < frameCount; frame++) {
          this.load.image(
            `enemy/${enemy}/${animation}/${frame}`,
            `img/entities/enemy/${enemy}/${animation}/${frame}.png`
          );
        }
      }
    }

    for (const depth of ['front', 'back']) {
      for (const variant of ['left', 'regular', 'right']) {
        for (let frame = 0; frame < 4; frame++) {
          this.load.image(
            `palm_tree/${depth}/${variant}/${frame}`,
            `img/map/palm_tree/${depth}/${variant}/${frame}.png`
          );
        }
      }
    }

    for (let variant = 0; variant < 4; variant++) {
      this.load.image(`spawner/${variant}`, `img/map/spawner/${variant}.png`);
    }

    for (const def of Object.values(SFX_DEFINITIONS)) {
      for (const file of def.files) {
        this.load.audio(file, file);
      }
    }
  }

  create() {
    this.scene.start(DEBUG_SKIP_TITLE_SCREEN ? 'Game' : 'TitleScene');
  }
}
