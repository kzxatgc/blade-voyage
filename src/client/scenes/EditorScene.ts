import { Scene } from 'phaser';

export const EDITOR_SCENE_KEY = 'EditorScene';

export class EditorScene extends Scene {
  constructor() {
    super(EDITOR_SCENE_KEY);
  }

  preload() {
    this.load.setPath('../assets');

    for (let variant = 0; variant < 16; variant++) {
      const fileName = `${String(variant).padStart(2, '0')}.png`;
      this.load.image(`grass/${variant}`, `img/map/grass/${fileName}`);
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
  }

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');
  }
}
