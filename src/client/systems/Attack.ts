import { Animation } from '../utils/Animation.ts';
import type { EntityPosition } from '../../shared/types.ts';

export const ATTACK_TYPES = ['attack_1', 'attack_2', 'attack_3'] as const;
export type AttackType = typeof ATTACK_TYPES[number];

export const AIR_ATTACK_TYPES = ['air_attack_1', 'air_attack_2'] as const;
export type AirAttackType = typeof AIR_ATTACK_TYPES[number];

export type AnyAttackType = AttackType | AirAttackType;

export const POS_ADJUSTMENT: Readonly<
  Record<string, readonly [number, number, number, number]>
> = {
  attack_1: [44, 15, -7, 15],
  attack_2: [33, -3, -7, -3],
  attack_3: [33, -3, -11, -3],
  air_attack_1: [40, 30, 0, 30],
  air_attack_2: [40, 30, -7, 30],
};

const ATTACK_EFFECT_ANIMATIONS: Readonly<
  Record<string, { path: string; frameCount: number }>
> = {
  attack_1: { path: 'player/sword/attack_effect/attack_1', frameCount: 3 },
  attack_2: { path: 'player/sword/attack_effect/attack_2', frameCount: 3 },
  attack_3: { path: 'player/sword/attack_effect/attack_3', frameCount: 3 },
  air_attack_1: {
    path: 'player/sword/attack_effect/air_attack_1',
    frameCount: 2,
  },
  air_attack_2: {
    path: 'player/sword/attack_effect/air_attack_2',
    frameCount: 2,
  },
};

export interface AttackPlayerTarget {
  airTime: number;
  flip: boolean;
  pos: EntityPosition;
  animation: Animation | null;
  setAction(action: string): void;
}

export interface AttackRenderImage {
  setOrigin(x: number, y: number): void;
  setPosition(x: number, y: number): void;
  setTexture(texture: string): void;
  setFlipX(flip: boolean): void;
  destroy(): void;
}

export interface AttackRenderScene {
  add: {
    image(x: number, y: number, texture: string): AttackRenderImage;
  };
}

export class Attack {
  player: AttackPlayerTarget | undefined;
  attackState = false;
  currentAttackType = '';
  effect: Animation | null = null;
  readonly posAdjustment = POS_ADJUSTMENT;
  readonly hitEntities = new Set<unknown>();
  private readonly random: () => number;
  private effectImage: AttackRenderImage | null = null;
  private effectTexture: string | null = null;

  constructor(
    player?: AttackPlayerTarget,
    random: () => number = Math.random
  ) {
    this.player = player;
    this.random = random;
  }

  triggerAttack(airTime?: number): boolean {
    if (this.attackState) {
      return false;
    }

    this.attackState = true;
    this.hitEntities.clear();
    const effectiveAirTime = airTime ?? this.player?.airTime ?? 0;

    if (effectiveAirTime <= 1) {
      const index = Math.floor(this.random() * ATTACK_TYPES.length);
      this.currentAttackType = ATTACK_TYPES[index] ?? 'attack_1';
    } else {
      const index = Math.floor(this.random() * AIR_ATTACK_TYPES.length);
      this.currentAttackType = AIR_ATTACK_TYPES[index] ?? 'air_attack_1';
    }

    const config = ATTACK_EFFECT_ANIMATIONS[this.currentAttackType];
    if (config) {
      this.effect = new Animation(config.path, config.frameCount, 6, false);
    }

    return true;
  }

  setAction() {
    if (!this.player) {
      return;
    }
    this.player.setAction(`sword/${this.currentAttackType}`);
    if (this.player.animation?.done) {
      this.attackState = false;
    }
  }

  update() {
    if (this.effect) {
      this.effect.update();
      if (this.effect.done) {
        this.effect = null;
        this.destroy();
      }
    }
  }

  render(
    scene: AttackRenderScene,
    offset: readonly [number, number] = [0, 0]
  ) {
    if (!this.effect || !this.player) {
      this.destroy();
      return;
    }

    const texture = this.effect.img();
    const adj = this.posAdjustment[this.currentAttackType] ?? [0, 0, 0, 0];
    const offsetX = this.player.flip ? adj[2] : adj[0];
    const offsetY = this.player.flip ? adj[3] : adj[1];
    const posX = this.player.pos[0] - offset[0] + offsetX;
    const posY = this.player.pos[1] - offset[1] + offsetY;

    if (!this.effectImage) {
      this.effectImage = scene.add.image(posX, posY, texture);
      this.effectImage.setOrigin(0, 0);
      this.effectTexture = texture;
    } else {
      if (this.effectTexture !== texture) {
        this.effectImage.setTexture(texture);
        this.effectTexture = texture;
      }
      this.effectImage.setPosition(posX, posY);
    }
    this.effectImage.setFlipX(this.player.flip);
  }

  destroy() {
    this.effectImage?.destroy();
    this.effectImage = null;
  }
}
