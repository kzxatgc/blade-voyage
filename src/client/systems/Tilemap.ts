import type {
  MapData,
  OffGridTile,
  TileData,
  TileLocation,
} from '../../shared/types';

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

export function createTemporaryPlusMap(): MapData {
  const locations: TileLocation[] = [
    [8, 5],
    [9, 5],
    [10, 5],
    [11, 5],
    [12, 5],
    [10, 3],
    [10, 4],
    [10, 6],
    [10, 7],
  ];
  const tiles: Record<string, TileData> = {};

  locations.forEach((loc, variant) => {
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
