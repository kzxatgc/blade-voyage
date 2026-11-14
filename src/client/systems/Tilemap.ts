import type {
  MapData,
  OffGridTile,
  Rect,
  TileData,
  TileLocation,
} from '../../shared/types';
import { PHYSICAL_TILES } from '../../shared/constants.ts';

export interface TilemapRenderImage {
  setOrigin(x: number, y: number): void;
  setTexture(texture: string): void;
}

export interface TilemapRenderScene {
  add: {
    image(x: number, y: number, texture: string): TilemapRenderImage;
  };
}

export interface AnimationFrameSource {
  img(): string;
}

export interface TilemapAnimation extends AnimationFrameSource {
  indexChanged: boolean;
  update(): void;
}

const NEIGHBOR_SHIFT_LOCS: readonly TileLocation[] = [
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const PLATFORM_ADJUSTMENTS = {
  'palm_tree/front/left': { posOffset: [-30, 0], size: [25, 1] },
  'palm_tree/front/regular': { posOffset: [-7, 0], size: [25, 1] },
  'palm_tree/front/right': { posOffset: [-7, 0], size: [25, 1] },
} as const;

export function createTemporaryPlusMap(): MapData {
  const locations: readonly [TileLocation, number][] = [
    [[8, 5], 9],
    [[9, 5], 10],
    [[10, 5], 4],
    [[11, 5], 10],
    [[12, 5], 11],
    [[10, 3], 13],
    [[10, 4], 14],
    [[10, 6], 14],
    [[10, 7], 15],
  ];
  const tiles: Record<string, TileData> = {};

  locations.forEach(([loc, variant]) => {
    tiles[`${loc[0]};${loc[1]}`] = { type: 'grass', variant, loc };
  });

  return { tiles, off_grid_tiles: [] };
}

export class Tilemap {
  tiles: Record<string, TileData> = {};
  offGridTiles: OffGridTile[] = [];
  readonly tileSize: number;
  private readonly animatedImages: {
    type: string;
    image: TilemapRenderImage;
  }[] = [];

  constructor(size = 32) {
    this.tileSize = size;
  }

  load(data: MapData) {
    this.loadFromData(data);
  }

  loadFromData(data: MapData) {
    this.tiles = data.tiles;
    this.offGridTiles = data.off_grid_tiles;
  }

  save(): MapData {
    return {
      tiles: this.tiles,
      off_grid_tiles: this.offGridTiles,
    };
  }

  extract(idPairs: readonly (readonly [string, number])[], keep = true) {
    const matches: TileData[] = [];

    for (const [location, tile] of Object.entries(this.tiles)) {
      if (
        !idPairs.some(
          ([type, variant]) =>
            tile.type === type && tile.variant === variant
        )
      ) {
        continue;
      }

      matches.push({ ...tile });
      if (!keep) {
        delete this.tiles[location];
      }
    }

    return matches;
  }

  tilesAround(pos: TileLocation): TileData[] {
    const loc: TileLocation = [
      Math.floor((pos[0] + 22) / this.tileSize),
      Math.floor((pos[1] + 4) / this.tileSize),
    ];
    const nearbyTiles: TileData[] = [];

    for (const shift of NEIGHBOR_SHIFT_LOCS) {
      const location = `${loc[0] + shift[0]};${loc[1] + shift[1]}`;
      const tile = this.tiles[location];
      if (tile) {
        nearbyTiles.push(tile);
      }
    }

    return nearbyTiles;
  }

  physicalRectsAround(pos: TileLocation): Rect[] {
    return this.tilesAround(pos)
      .filter((tile) => PHYSICAL_TILES.has(tile.type))
      .map((tile) => ({
        x: tile.loc[0] * this.tileSize,
        y: tile.loc[1] * this.tileSize,
        width: this.tileSize,
        height: this.tileSize,
      }));
  }

  solidCheck(pos: TileLocation): TileData | undefined {
    const loc: TileLocation = [
      Math.floor(pos[0] / this.tileSize),
      Math.floor(pos[1] / this.tileSize),
    ];
    const tile = this.tiles[`${loc[0]};${loc[1]}`];
    return tile && PHYSICAL_TILES.has(tile.type) ? tile : undefined;
  }

  offGridTilesAround(pos: TileLocation, radius = 40): OffGridTile[] {
    return this.offGridTiles.filter(
      (tile) =>
        Math.abs(tile.pos[0] - pos[0]) <= radius &&
        Math.abs(tile.pos[1] - pos[1]) <= radius
    );
  }

  platformsAround(pos: TileLocation, type: keyof typeof PLATFORM_ADJUSTMENTS): Rect[] {
    const adjustment = PLATFORM_ADJUSTMENTS[type];
    return this.offGridTilesAround(pos)
      .filter((tile) => tile.type === type)
      .map((tile) => ({
        x: tile.pos[0] - adjustment.posOffset[0],
        y: tile.pos[1] - adjustment.posOffset[1],
        width: adjustment.size[0],
        height: adjustment.size[1],
      }));
  }

  frontRender(
    scene: TilemapRenderScene,
    offset: TileLocation = [0, 0],
    animations: Readonly<Record<string, AnimationFrameSource>> = {}
  ) {
    for (const tile of Object.values(this.tiles)) {
      const animation = animations[tile.type];
      const image = scene.add.image(
        tile.loc[0] * this.tileSize - offset[0],
        tile.loc[1] * this.tileSize - offset[1],
        animation?.img() ?? `${tile.type}/${tile.variant}`
      );
      image.setOrigin(0, 0);
      if (animation) {
        this.animatedImages.push({ type: tile.type, image });
      }
    }

    for (const tile of this.offGridTiles) {
      if (tile.depth !== 'front' || tile.status !== 'animated') {
        continue;
      }

      const animation = animations[tile.type];
      if (!animation) {
        throw new Error(`Missing animation for front tile "${tile.type}".`);
      }

      this.renderAnimatedTile(scene, tile.type, tile.pos, offset, animation);
    }
  }

  backRender(
    scene: TilemapRenderScene,
    offset: TileLocation = [0, 0],
    animations: Readonly<Record<string, AnimationFrameSource>> = {}
  ) {
    for (const tile of this.offGridTiles) {
      if (tile.depth !== 'back' || tile.status !== 'animated') {
        continue;
      }

      const animation = animations[tile.type];
      if (!animation) {
        throw new Error(`Missing animation for back tile "${tile.type}".`);
      }

      this.renderAnimatedTile(scene, tile.type, tile.pos, offset, animation);
    }
  }

  updateAnimations(animations: Readonly<Record<string, TilemapAnimation>>) {
    const updatedTypes = new Set<string>();
    const updateType = (type: string) => {
      if (updatedTypes.has(type)) {
        return;
      }

      const animation = animations[type];
      if (!animation) {
        throw new Error(`Missing animation for animated tile "${type}".`);
      }

      animation.update();
      updatedTypes.add(type);

      if (animation.indexChanged) {
        for (const entry of this.animatedImages) {
          if (entry.type === type) {
            entry.image.setTexture(animation.img());
          }
        }
      }
    };

    for (const tile of this.offGridTiles) {
      if (tile.status === 'animated') {
        updateType(tile.type);
      }
    }

    for (const tile of Object.values(this.tiles)) {
      if (animations[tile.type]) {
        updateType(tile.type);
      }
    }
  }

  private renderAnimatedTile(
    scene: TilemapRenderScene,
    type: string,
    pos: TileLocation,
    offset: TileLocation,
    animation: AnimationFrameSource
  ) {
    const image = scene.add
      .image(pos[0] - offset[0], pos[1] - offset[1], animation.img());
    image.setOrigin(0, 0);
    this.animatedImages.push({ type, image });
  }
}
