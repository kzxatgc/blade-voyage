import * as Phaser from 'phaser';
import { TILE_SIZE } from '../../shared/constants';
import type { OffGridTile, TileLocation } from '../../shared/types';
import { Tilemap } from '../systems/Tilemap';

export const EDITOR_SCENE_KEY = 'EditorScene';

export class EditorScene extends Phaser.Scene {
  private readonly tilemap: Tilemap & { autoTile?: () => void } =
    new Tilemap();
  private depthToggleKey: Phaser.Input.Keyboard.Key | undefined;
  private gridToggleKey: Phaser.Input.Keyboard.Key | undefined;
  private autoTileKey: Phaser.Input.Keyboard.Key | undefined;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private tileObjects?: Phaser.GameObjects.Container;
  private onGrid = true;
  private selectedDepth: 'front' | 'back' = 'front';
  private selectedTileType = 'grass';
  private selectedTileVariant = 0;
  private selectedTileStatus: 'static' | 'animated' = 'static';
  private lastOffGridPos: TileLocation | undefined;
  private tileIcon?: Phaser.GameObjects.Image;
  private tilePreview?: Phaser.GameObjects.Image;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super(EDITOR_SCENE_KEY);
  }

  preload() {
    // Load all editor textures in one pass so create() can run before scene updates.
    this.load.maxParallelDownloads = 64;
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
    this.input.mouse?.disableContextMenu();
    this.gridGraphics = this.add.graphics().setDepth(10);
    this.tileObjects = this.add.container().setDepth(0);
    this.tilePreview = this.add
      .image(0, 0, 'grass/0')
      .setOrigin(0, 0)
      .setDepth(20);

    this.add
      .rectangle(4, 4, 300, 60, 0xffffff, 0.95)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setStrokeStyle(1, 0x333333, 0.5);
    this.tileIcon = this.add
      .image(10, 10, 'grass/0')
      .setOrigin(0, 0)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setScrollFactor(0)
      .setDepth(101);
    this.statusText = this.add
      .text(50, 7, '', {
        color: '#111827',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.gridToggleKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.G
    );
    this.depthToggleKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.B
    );
    this.autoTileKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    this.renderTilemap();
    this.updateStatusText();
  }

  override update() {
    let statusChanged = false;
    if (
      this.gridToggleKey &&
      Phaser.Input.Keyboard.JustDown(this.gridToggleKey)
    ) {
      this.onGrid = !this.onGrid;
      statusChanged = true;
    }
    if (
      this.depthToggleKey &&
      Phaser.Input.Keyboard.JustDown(this.depthToggleKey)
    ) {
      this.selectedDepth = this.selectedDepth === 'front' ? 'back' : 'front';
      statusChanged = true;
    }
    if (
      this.autoTileKey &&
      Phaser.Input.Keyboard.JustDown(this.autoTileKey)
    ) {
      this.triggerAutoTile();
    }
    if (statusChanged) {
      this.updateStatusText();
    }

    this.drawGrid();

    const pointer = this.input.activePointer;
    const camera = this.cameras.main;
    const worldX = pointer.x + camera.scrollX;
    const worldY = pointer.y + camera.scrollY;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const previewFrame = this.textures.getFrame(this.getSelectedTextureKey());

    this.tilePreview
      ?.setPosition(
        this.onGrid ? tileX * TILE_SIZE : worldX - previewFrame.width,
        this.onGrid ? tileY * TILE_SIZE : worldY - previewFrame.height
      )
      .setAlpha(this.selectedDepth === 'back' ? 0.3 : 0.55);
    this.tileIcon?.setAlpha(this.selectedDepth === 'back' ? 0.35 : 1);
  }

  private drawGrid() {
    const graphics = this.gridGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();
    if (!this.onGrid) {
      return;
    }

    const camera = this.cameras.main;
    const left = Math.floor(camera.scrollX / TILE_SIZE) * TILE_SIZE;
    const top = Math.floor(camera.scrollY / TILE_SIZE) * TILE_SIZE;
    const right = camera.scrollX + camera.width;
    const bottom = camera.scrollY + camera.height;
    graphics.lineStyle(1, 0x64748b, 0.2);

    for (let x = left; x <= right; x += TILE_SIZE) {
      graphics.lineBetween(x, top, x, bottom);
    }
    for (let y = top; y <= bottom; y += TILE_SIZE) {
      graphics.lineBetween(left, y, right, y);
    }
  }

  private renderTilemap() {
    const tileObjects = this.tileObjects;
    if (!tileObjects) {
      return;
    }

    tileObjects.removeAll(true);
    this.renderOffGridTiles('back', 0.35);

    for (const tile of Object.values(this.tilemap.tiles)) {
      tileObjects.add(
        this.add
          .image(
            tile.loc[0] * TILE_SIZE,
            tile.loc[1] * TILE_SIZE,
            `${tile.type}/${tile.variant}`
          )
          .setOrigin(0, 0)
      );
    }

    this.renderOffGridTiles('front', 1);
  }

  private renderOffGridTiles(depth: 'back' | 'front', alpha: number) {
    for (const tile of this.tilemap.offGridTiles) {
      if (tile.depth !== depth) {
        continue;
      }

      const frame = tile.status === 'animated' ? 0 : (tile.variant ?? 0);
      this.tileObjects?.add(
        this.add
          .image(tile.pos[0], tile.pos[1], `${tile.type}/${frame}`)
          .setOrigin(0, 0)
          .setAlpha(alpha)
      );
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (pointer.leftButtonDown()) {
      this.placeTile(pointer);
    } else if (pointer.rightButtonDown()) {
      this.deleteTile(pointer);
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (pointer.leftButtonDown()) {
      this.placeTile(pointer);
    } else if (pointer.rightButtonDown()) {
      this.deleteTile(pointer);
    }
  }

  private handlePointerUp() {
    this.lastOffGridPos = undefined;
  }

  private placeTile(pointer: Phaser.Input.Pointer) {
    const [worldX, worldY] = this.getWorldPosition(pointer);
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const location: TileLocation = [tileX, tileY];

    if (this.onGrid && this.selectedTileStatus === 'static') {
      const key = `${tileX};${tileY}`;
      const existing = this.tilemap.tiles[key];
      if (
        existing?.type === this.selectedTileType &&
        existing.variant === this.selectedTileVariant
      ) {
        return;
      }

      this.tilemap.tiles[key] = {
        type: this.selectedTileType,
        variant: this.selectedTileVariant,
        loc: location,
      };
      this.renderTilemap();
      return;
    }

    const textureKey = this.getSelectedTextureKey();
    const frame = this.textures.getFrame(textureKey);
    const pos: TileLocation = this.onGrid
      ? [tileX * TILE_SIZE, tileY * TILE_SIZE]
      : [worldX - frame.width, worldY - frame.height];
    const minDistance = this.onGrid ? TILE_SIZE : 16;
    if (this.lastOffGridPos) {
      const dx = pos[0] - this.lastOffGridPos[0];
      const dy = pos[1] - this.lastOffGridPos[1];
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return;
      }
    }

    const tile: OffGridTile = {
      type: this.selectedTileType,
      variant: this.selectedTileVariant,
      depth: this.selectedDepth,
      status: this.selectedTileStatus,
      pos,
    };
    this.tilemap.offGridTiles.push(tile);
    this.lastOffGridPos = pos;
    this.renderTilemap();
  }

  private deleteTile(pointer: Phaser.Input.Pointer) {
    const [worldX, worldY] = this.getWorldPosition(pointer);
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    let changed = false;

    if (this.tilemap.tiles[`${tileX};${tileY}`]) {
      delete this.tilemap.tiles[`${tileX};${tileY}`];
      changed = true;
    }

    for (let index = this.tilemap.offGridTiles.length - 1; index >= 0; index--) {
      const tile = this.tilemap.offGridTiles[index];
      if (!tile) {
        continue;
      }

      const frame = this.textures.getFrame(this.getTextureKey(tile));
      if (
        worldX >= tile.pos[0] &&
        worldX < tile.pos[0] + frame.width &&
        worldY >= tile.pos[1] &&
        worldY < tile.pos[1] + frame.height
      ) {
        this.tilemap.offGridTiles.splice(index, 1);
        changed = true;
      }
    }

    if (changed) {
      this.renderTilemap();
    }
  }

  private getWorldPosition(pointer: Phaser.Input.Pointer): TileLocation {
    const camera = this.cameras.main;
    return [pointer.x + camera.scrollX, pointer.y + camera.scrollY];
  }

  private getSelectedTextureKey() {
    return `${this.selectedTileType}/${this.selectedTileStatus === 'animated' ? 0 : this.selectedTileVariant}`;
  }

  private getTextureKey(tile: OffGridTile) {
    return `${tile.type}/${tile.status === 'animated' ? 0 : (tile.variant ?? 0)}`;
  }

  private triggerAutoTile() {
    if (!this.tilemap.autoTile) {
      console.warn('Autotiling is unavailable until Tilemap.autoTile() is implemented.');
      return;
    }

    this.tilemap.autoTile();
    this.renderTilemap();
  }

  private updateStatusText() {
    this.statusText?.setText(
      `${this.selectedTileType} ${this.selectedTileVariant}\nG: grid ${this.onGrid ? 'on' : 'off'} | B: ${this.selectedDepth}`
    );
  }
}
