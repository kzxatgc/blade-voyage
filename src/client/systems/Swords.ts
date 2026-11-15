import { PhysicsEntity } from '../entities/PhysicsEntity.ts';
import type { EntityPosition, EntityRect, EntitySize } from '../../shared/types.ts';
import type { Tilemap } from './Tilemap.ts';
import { Animation } from '../utils/Animation.ts';
import { Sparks } from './Sparks.ts';

export interface SwordEnemyTarget {
  enemyType: string;
  dead: boolean;
  attackTimer: number;
  pos: EntityPosition;
  rect(): EntityRect;
  takeDamage(amount: number): boolean;
}

export interface SwordHitResult {
  type: 'hit' | 'deflection';
  enemy: SwordEnemyTarget;
  sword: SpinningSword;
}

export interface SwordRenderImage {
  setOrigin(x: number, y: number): void;
  setPosition(x: number, y: number): void;
  setTexture(texture: string): void;
  setAngle?(angle: number): void;
  setRotation?(rotation: number): void;
  setFlipX?(flip: boolean): void;
  setVisible?(visible: boolean): void;
  destroy(): void;
}

export interface SwordRenderScene {
  add: {
    image(x: number, y: number, texture: string): SwordRenderImage;
  };
}

export class Sword extends PhysicsEntity {
  timer = 0;
  landed = false;
  sparksEffect: Sparks[] | undefined;
  private image: SwordRenderImage | null = null;
  private imageTexture: string | null = null;

  constructor(
    pos: EntityPosition,
    size: EntitySize = [20, 20],
    animations?: Readonly<Record<string, Animation>>,
    sparksEffect?: Sparks[]
  ) {
    super(
      'sword',
      pos,
      size,
      animations ?? {
        'sword/idle': new Animation('sword/idle', 8, 6),
        'sword/fall': new Animation('sword/fall', 1, 6),
      }
    );
    this.timer = 0;
    this.landed = false;
    this.sparksEffect = sparksEffect;
    this.setAction('fall');
  }

  override update(
    tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>,
    movement: EntityPosition = [0, 0]
  ) {
    super.update(tilemap, movement);

    if (this.timer < 18) {
      this.velocity[1] = 0;
    } else if (!this.landed) {
      this.velocity[1] = Math.min(3.5, this.velocity[1] + 0.2);
    }

    if (this.collision.bottom) {
      if (!this.landed) {
        this.landed = true;
        this.setAction('idle');
        this.sparksEffect?.push(
          new Sparks(
            [this.pos[0] + 10, this.pos[1] + 15],
            false,
            1.8,
            10,
            [255, 235, 170],
            'up',
            'diamond',
            [2, 2]
          )
        );
      } else {
        this.setAction('idle');
      }
    }

    this.animation?.update();
    this.timer += 1;
  }

  isBlinking(): boolean {
    if (this.timer >= 900) {
      const blinkRate = this.timer >= 1080 ? 7 : 12;
      return Math.floor(this.timer / blinkRate) % 2 === 0;
    }
    return false;
  }

  get isBlinkHidden(): boolean {
    return this.isBlinking();
  }

  get isVisible(): boolean {
    return !this.isBlinking();
  }

  render(
    scene: SwordRenderScene,
    offset: readonly [number, number] = [0, 0]
  ) {
    if (this.isBlinking()) {
      if (this.image) {
        this.image.setVisible?.(false);
      }
      return;
    }

    const texture = this.animation?.img() ?? 'sword/idle/0';
    if (!this.image) {
      this.image = scene.add.image(
        this.pos[0] - offset[0] + 10,
        this.pos[1] - offset[1] + 10,
        texture
      );
      this.image.setOrigin(0.5, 0.5);
      this.image.setAngle?.(90);
      this.imageTexture = texture;
    } else {
      if (this.imageTexture !== texture) {
        this.image.setTexture(texture);
        this.imageTexture = texture;
      }
      this.image.setPosition(
        this.pos[0] - offset[0] + 10,
        this.pos[1] - offset[1] + 10
      );
      this.image.setVisible?.(true);
    }
  }

  destroy() {
    this.image?.destroy();
    this.image = null;
  }
}

export class SpinningSword extends PhysicsEntity {
  timer = 0;
  sparksTriggered = false;
  spinningSfxIndex = 0;
  sparksEffect: Sparks[] | undefined;
  private readonly random: () => number;
  private image: SwordRenderImage | null = null;
  private imageTexture: string | null = null;

  constructor(
    pos: EntityPosition,
    flip: boolean,
    size: EntitySize = [19, 5],
    animations?: Readonly<Record<string, Animation>>,
    sparksEffect?: Sparks[],
    random: () => number = Math.random
  ) {
    super(
      'sword',
      pos,
      size,
      animations ?? {
        'sword/idle': new Animation('sword/spinning', 4, 6),
        'sword/spinning': new Animation('sword/spinning', 4, 6),
        'sword/embedded': new Animation('sword/embedded', 4, 4, false),
      }
    );
    this.flip = flip;
    this.timer = 0;
    this.sparksEffect = sparksEffect;
    this.random = random;
    this.setAction('spinning');
    this.velocity[0] = this.flip ? -4 : 4;
    this.velocity[1] = 0;
  }

  get indexChanged(): boolean {
    return this.animation?.indexChanged ?? false;
  }

  override update(
    tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>,
    movement: EntityPosition = [0, 0]
  ) {
    if (this.action === 'spinning') {
      this.velocity[0] = this.flip ? -4 : 4;
      this.velocity[1] = 0;
    } else {
      this.velocity[0] = 0;
      this.velocity[1] = 0;
    }

    super.update(tilemap, movement);

    if (this.action === 'spinning') {
      this.velocity[0] = this.flip ? -4 : 4;
      this.velocity[1] = 0;
    } else {
      this.velocity[0] = 0;
      this.velocity[1] = 0;
    }

    if (this.collision.right || this.collision.left) {
      this.setAction('embedded');
      this.velocity[0] = 0;
      this.velocity[1] = 0;

      if (!this.sparksTriggered) {
        const sparkPos: [number, number] = [
          this.pos[0] + (this.flip ? 0 : 12),
          this.pos[1],
        ];
        const sparkSpeed = this.random() * 1 + 2;
        const spark = new Sparks(
          sparkPos,
          this.flip,
          sparkSpeed,
          10,
          [140, 140, 160],
          Math.PI * 0.75,
          'diamond'
        );
        this.sparksEffect?.push(spark);
        this.sparksTriggered = true;
      }
    }

    this.animation?.update();
    this.timer += 1;
  }

  isBlinking(): boolean {
    if (this.action === 'embedded' && this.timer >= 900) {
      const blinkRate = this.timer >= 1080 ? 7 : 12;
      return Math.floor(this.timer / blinkRate) % 2 === 0;
    }
    return false;
  }

  get isBlinkHidden(): boolean {
    return this.isBlinking();
  }

  get isVisible(): boolean {
    return !this.isBlinking();
  }

  render(
    scene: SwordRenderScene,
    offset: readonly [number, number] = [0, 0]
  ) {
    if (this.isBlinking()) {
      if (this.image) {
        this.image.setVisible?.(false);
      }
      return;
    }

    const texture =
      this.animation?.img() ??
      (this.action === 'embedded' ? 'sword/embedded/0' : 'sword/spinning/0');
    const renderX = this.pos[0] - offset[0] + (this.flip ? -8 : 7);
    const renderY = this.pos[1] - offset[1] - 10;

    if (!this.image) {
      this.image = scene.add.image(renderX, renderY, texture);
      this.image.setOrigin(0, 0);
      this.image.setFlipX?.(this.flip);
      this.imageTexture = texture;
    } else {
      if (this.imageTexture !== texture) {
        this.image.setTexture(texture);
        this.imageTexture = texture;
      }
      this.image.setPosition(renderX, renderY);
      this.image.setFlipX?.(this.flip);
      this.image.setVisible?.(true);
    }
  }

  destroy() {
    this.image?.destroy();
    this.image = null;
  }
}

export class Swords {
  swords: Sword[] = [];
  thrownSwords: SpinningSword[] = [];
  offset: readonly [number, number];
  sparksEffect: Sparks[] | undefined;
  horizontalTileRangeLeft = 7.5;
  horizontalTileRangeRight = 6.5;
  verticalTileRangeTop = 2.5;
  verticalTileRangeBottom = 3.5;
  private validSpawnPos: readonly [number, number][] | null = null;
  private readonly random: () => number;

  get horizontalTileRange(): number {
    return Math.max(this.horizontalTileRangeLeft, this.horizontalTileRangeRight);
  }

  set horizontalTileRange(val: number) {
    this.horizontalTileRangeLeft = val;
    this.horizontalTileRangeRight = val;
  }

  constructor(
    offset: readonly [number, number] = [0, 0],
    random: () => number = Math.random,
    sparksEffect?: Sparks[]
  ) {
    this.offset = offset;
    this.random = random;
    this.sparksEffect = sparksEffect;
  }

  getValidSpawnPositions(
    tilemap: Tilemap
  ): readonly (readonly [number, number])[] {
    if (this.validSpawnPos === null) {
      const surfaceVariants = [0, 1, 2, 9, 10, 11, 12, 13].map(
        (v) => ['grass', v] as const
      );
      this.validSpawnPos = tilemap
        .extract(surfaceVariants, true)
        .map((tile) => [
          tile.loc[0] * tilemap.tileSize,
          tile.loc[1] * tilemap.tileSize,
        ]);
    }
    return this.validSpawnPos;
  }

  spawnSword(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): Sword | null {
    const validPositions = this.getValidSpawnPositions(tilemap);
    if (validPositions.length === 0) {
      return null;
    }

    if (!(this.random() < 0.01 && this.swords.length < 5)) {
      return null;
    }

    const tileSize = tilemap.tileSize;
    let filteredPositions = validPositions;

    if (playerPos) {
      const playerX = playerPos[0];
      const playerY = playerPos[1];
      const playerCx = playerX + 32;
      const maxHDistLeft = this.horizontalTileRangeLeft * tileSize;
      const maxHDistRight = this.horizontalTileRangeRight * tileSize;
      const maxVTop = this.verticalTileRangeTop * tileSize;
      const maxVBottom = this.verticalTileRangeBottom * tileSize;

      filteredPositions = validPositions.filter((pos) => {
        const hDist = pos[0] - playerCx;
        const hValid = hDist >= -maxHDistLeft && hDist <= maxHDistRight;
        const vValid =
          playerY - maxVTop <= pos[1] && pos[1] <= playerY + maxVBottom;
        return hValid && vValid;
      });
    }

    const availablePos = filteredPositions.filter(
      (pos) =>
        !this.swords.some(
          (s) =>
            Math.abs(s.pos[0] - pos[0]) < tileSize &&
            s.pos[1] - pos[1] > -80 &&
            s.pos[1] - pos[1] < tileSize
        )
    );

    if (availablePos.length === 0) {
      return null;
    }

    const selectedIndex = Math.floor(this.random() * availablePos.length);
    const posSelected = availablePos[selectedIndex];
    if (!posSelected) {
      return null;
    }
    const renderPos: [number, number] = [
      posSelected[0] + tileSize * (this.random() * 0.2 + 0.1),
      posSelected[1] - 60,
    ];

    const sword = new Sword(
      renderPos,
      undefined,
      undefined,
      this.sparksEffect
    );
    this.swords.push(sword);

    // 360-degree celestial starburst: bright white core + golden outer shimmer
    const centerSpawn: [number, number] = [
      renderPos[0] + 10,
      renderPos[1] + 10,
    ];
    this.sparksEffect?.push(
      new Sparks(
        centerSpawn,
        false,
        2.8,
        14,
        [255, 255, 255],
        'burst',
        'diamond',
        [3, 3]
      )
    );
    this.sparksEffect?.push(
      new Sparks(
        centerSpawn,
        false,
        1.8,
        8,
        [255, 215, 0],
        'burst',
        'diamond',
        [2, 2]
      )
    );

    return sword;
  }

  throwSword(pos: EntityPosition, flip: boolean): SpinningSword {
    const sword = new SpinningSword(
      pos,
      flip,
      [19, 5],
      undefined,
      this.sparksEffect,
      this.random
    );
    this.thrownSwords.push(sword);
    return sword;
  }

  update(
    tilemap: Tilemap,
    movement: EntityPosition = [0, 0],
    playerPos?: readonly [number, number],
    enemies?: readonly SwordEnemyTarget[]
  ): SwordHitResult[] {
    this.spawnSword(tilemap, playerPos);

    this.swords = this.swords.filter((sword) => {
      if (sword.timer >= 1200) {
        sword.destroy();
        return false;
      }
      return true;
    });

    for (const sword of this.swords) {
      sword.update(tilemap, movement);
    }

    const hitResults: SwordHitResult[] = [];

    this.thrownSwords = this.thrownSwords.filter((sword) => {
      sword.update(tilemap, movement);

      if (sword.action === 'spinning' && enemies) {
        const sRect = sword.rect();
        for (const enemy of enemies) {
          if (enemy.dead) {
            continue;
          }
          const eRect = enemy.rect();
          const collides =
            sRect.x < eRect.x + eRect.width &&
            sRect.x + sRect.width > eRect.x &&
            sRect.y < eRect.y + eRect.height &&
            sRect.y + sRect.height > eRect.y;

          if (collides) {
            if (enemy.attackTimer > 0 && enemy.enemyType === 'pink_star') {
              // Deflection result on Pink Star charging attack
              sword.flip = !sword.flip;
              sword.velocity[0] = sword.flip ? -7 : 7;
              sword.pos[0] += sword.flip ? -2 : 2;
              hitResults.push({ type: 'deflection', enemy, sword });
            } else {
              // Ordinary hit: 35 source damage
              enemy.takeDamage(35);
              hitResults.push({ type: 'hit', enemy, sword });
              sword.destroy();
              return false;
            }
          }
        }
      }

      if (sword.timer >= 1200) {
        sword.destroy();
        return false;
      }
      return true;
    });

    return hitResults;
  }

  removeSword(sword: Sword): boolean {
    const index = this.swords.indexOf(sword);
    if (index !== -1) {
      sword.destroy();
      this.swords.splice(index, 1);
      return true;
    }
    return false;
  }

  render(
    scene: SwordRenderScene,
    offset: readonly [number, number] = this.offset
  ) {
    for (const sword of this.swords) {
      sword.render(scene, offset);
    }
    for (const sword of this.thrownSwords) {
      sword.render(scene, offset);
    }
  }

  destroy() {
    for (const sword of this.swords) {
      sword.destroy();
    }
    this.swords = [];
    for (const sword of this.thrownSwords) {
      sword.destroy();
    }
    this.thrownSwords = [];
  }
}


