import * as Phaser from 'phaser';

const TITLE_AVATAR_KEY = 'title-player-avatar';
const TITLE_NEXT_KEY = 'title-next';
const TITLE_NEXT_PRESSED_KEY = 'title-next-pressed';
const TITLE_CLICK_SOUND = 'settings-click';
const PLAY_BUTTON_PRESSED_SCALE_FACTOR = 0.85;
const PLAY_BUTTON_PRESS_DURATION_MS = 70;
const PLAY_BUTTON_RELEASE_DURATION_MS = 140;
const TITLE_EXIT_DURATION_MS = 800;
const TITLE_GROUP_BOTTOM_EXTENT = 175;
const TITLE_EXIT_SAFE_MARGIN = 8;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const entranceY = centerY + height * 0.42;

    this.add
      .image(centerX, centerY, 'background')
      .setScrollFactor(0)
      .setDisplaySize(width, height)
      .setDepth(0);

    const titleGroup = this.add
      .container(centerX, entranceY)
      .setDepth(1)
      .setAlpha(0);
    const avatar = this.add
      .image(-22, -6, TITLE_AVATAR_KEY)
      .setDisplaySize(512, 320);
    const nextButton = this.add
      .image(63, 79, TITLE_NEXT_KEY)
      .setDisplaySize(192, 192);
    const nextButtonScaleX = nextButton.scaleX;
    const nextButtonScaleY = nextButton.scaleY;
    titleGroup.add([avatar, nextButton]);

    let isStarting = false;
    const startGame = () => {
      if (isStarting) {
        return;
      }

      isStarting = true;
      this.sound.play(TITLE_CLICK_SOUND, { volume: 0.45 });
      this.input.enabled = false;
      this.tweens.killTweensOf(nextButton);
      nextButton.setTexture(TITLE_NEXT_KEY);
      this.tweens.add({
        targets: nextButton,
        scaleX: nextButtonScaleX,
        scaleY: nextButtonScaleY,
        duration: PLAY_BUTTON_RELEASE_DURATION_MS,
        ease: 'Sine.Out',
      });
      this.tweens.add({
        targets: titleGroup,
        y: -TITLE_GROUP_BOTTOM_EXTENT - TITLE_EXIT_SAFE_MARGIN,
        duration: TITLE_EXIT_DURATION_MS,
        ease: 'Sine.In',
        onComplete: () => this.scene.start('LevelSelectScene'),
      });
    };
    const showDefaultButton = () => {
      if (isStarting) {
        return;
      }

      this.tweens.killTweensOf(nextButton);
      nextButton.setTexture(TITLE_NEXT_KEY);
      this.tweens.add({
        targets: nextButton,
        scaleX: nextButtonScaleX,
        scaleY: nextButtonScaleY,
        duration: PLAY_BUTTON_RELEASE_DURATION_MS,
        ease: 'Sine.Out',
      });
    };

    nextButton.on('pointerdown', () => {
      if (isStarting) {
        return;
      }

      this.tweens.killTweensOf(nextButton);
      nextButton.setTexture(TITLE_NEXT_PRESSED_KEY);
      this.tweens.add({
        targets: nextButton,
        scaleX: nextButtonScaleX * PLAY_BUTTON_PRESSED_SCALE_FACTOR,
        scaleY: nextButtonScaleY * PLAY_BUTTON_PRESSED_SCALE_FACTOR,
        duration: PLAY_BUTTON_PRESS_DURATION_MS,
        ease: 'Sine.Out',
      });
    });
    nextButton.on('pointerup', startGame);
    nextButton.on('pointerout', showDefaultButton);
    nextButton.on('pointerupoutside', showDefaultButton);

    this.tweens.add({
      targets: titleGroup,
      y: centerY,
      alpha: 1,
      duration: 800,
      ease: 'Back.Out',
      onComplete: () => {
        nextButton.setInteractive({ useHandCursor: true });
        this.input.keyboard?.on('keydown-ENTER', startGame);
        this.input.keyboard?.on('keydown-SPACE', startGame);
      },
    });
  }
}
