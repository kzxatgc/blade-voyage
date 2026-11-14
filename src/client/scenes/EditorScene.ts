import * as Phaser from 'phaser';
import { TILE_SIZE } from '../../shared/constants';
import type { OffGridTile, TileLocation } from '../../shared/types';
import { Tilemap } from '../systems/Tilemap';

export const EDITOR_SCENE_KEY = 'EditorScene';

export class EditorScene extends Phaser.Scene {
  private readonly tileCategories = [
    { name: 'grass', types: ['grass'] },
    {
      name: 'palm_tree',
      types: [
        'palm_tree/front/regular',
        'palm_tree/front/left',
        'palm_tree/front/right',
        'palm_tree/back/regular',
        'palm_tree/back/left',
        'palm_tree/back/right',
      ],
    },
    { name: 'spawner', types: ['spawner'] },
  ] as const;
  private readonly spawnerIconBounds = [
    { x: 20, y: 4, width: 24, height: 28 },
    { x: 3, y: 4, width: 27, height: 25 },
    { x: 17, y: 4, width: 40, height: 25 },
    { x: 6, y: 7, width: 23, height: 21 },
  ] as const;
  private readonly tilemap = new Tilemap();
  private depthToggleKey: Phaser.Input.Keyboard.Key | undefined;
  private gridToggleKey: Phaser.Input.Keyboard.Key | undefined;
  private shiftKey: Phaser.Input.Keyboard.Key | undefined;
  private ctrlKey: Phaser.Input.Keyboard.Key | undefined;
  private autoTileKey: Phaser.Input.Keyboard.Key | undefined;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private tileObjects?: Phaser.GameObjects.Container;
  private onGrid = true;
  private selectedDepth: 'front' | 'back' = 'front';
  private zoom = 2;
  private zoomVelocity = 0;
  private isPanning = false;
  private panStartMouse: TileLocation | undefined;
  private panStartScroll: TileLocation | undefined;
  private tileGroup = 0;
  private subTypeIndex = 0;
  private tileVariant = 0;
  private selectedTileType = 'grass';
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
    const camera = this.cameras.main;
    camera.setBackgroundColor('#ffffff');
    camera.setZoom(this.zoom);
    camera.setScroll(
      -camera.width / 2 + camera.width / (2 * this.zoom),
      -camera.height / 2 + camera.height / (2 * this.zoom)
    );
    this.input.mouse?.disableContextMenu();
    const gridGraphics = this.add.graphics().setDepth(10);
    this.gridGraphics = gridGraphics;
    const tileObjects = this.add.container().setDepth(0);
    this.tileObjects = tileObjects;
    const tilePreview = this.add
      .image(0, 0, 'grass/0')
      .setOrigin(0, 0)
      .setDepth(20);
    this.tilePreview = tilePreview;

    const hudPanel = this.add
      .rectangle(4, 4, 360, 76, 0xffffff, 0.95)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setStrokeStyle(1, 0x333333, 0.5);
    const tileIcon = this.add
      .image(10, 6, 'grass/0')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);
    this.tileIcon = tileIcon;
    const statusText = this.add
      .text(68, 7, '', {
        color: '#111827',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(101);
    this.statusText = statusText;
    this.updateTileIcon();

    const hudCamera = this.cameras.add(0, 0, camera.width, camera.height);
    hudCamera.ignore([gridGraphics, tileObjects, tilePreview]);
    camera.ignore([hudPanel, tileIcon, statusText]);

    this.gridToggleKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.G
    );
    this.depthToggleKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.B
    );
    this.shiftKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );
    this.ctrlKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.CTRL
    );
    this.autoTileKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.input.on('wheel', this.handleWheel, this);

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

    this.updateZoom();
    this.drawGrid();

    const pointer = this.input.activePointer;
    const camera = this.cameras.main;
    const worldX =
      camera.scrollX +
      camera.width / 2 +
      (pointer.x - camera.width / 2) / camera.zoom;
    const worldY =
      camera.scrollY +
      camera.height / 2 +
      (pointer.y - camera.height / 2) / camera.zoom;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const previewFrame = this.textures.getFrame(this.getSelectedTextureKey());

    this.tilePreview
      ?.setPosition(
        this.onGrid ? tileX * TILE_SIZE : worldX - previewFrame.width,
        this.onGrid ? tileY * TILE_SIZE : worldY - previewFrame.height
      )
      .setAlpha(this.getSelectedDepth() === 'back' ? 0.3 : 0.55);
    this.tileIcon?.setAlpha(this.getSelectedDepth() === 'back' ? 0.35 : 1);
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
    const leftWorld =
      camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom);
    const topWorld =
      camera.scrollY + camera.height / 2 - camera.height / (2 * camera.zoom);
    const left = Math.floor(leftWorld / TILE_SIZE) * TILE_SIZE;
    const top = Math.floor(topWorld / TILE_SIZE) * TILE_SIZE;
    const right = leftWorld + camera.width / camera.zoom;
    const bottom = topWorld + camera.height / camera.zoom;
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
    if (pointer.middleButtonDown()) {
      this.isPanning = true;
      this.panStartMouse = [pointer.x, pointer.y];
      this.panStartScroll = [
        this.cameras.main.scrollX,
        this.cameras.main.scrollY,
      ];
    } else if (pointer.leftButtonDown()) {
      this.placeTile(pointer);
    } else if (pointer.rightButtonDown()) {
      this.deleteTile(pointer);
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (this.isPanning && this.panStartMouse && this.panStartScroll) {
      const camera = this.cameras.main;
      camera.setScroll(
        this.panStartScroll[0] -
          (pointer.x - this.panStartMouse[0]) / camera.zoom,
        this.panStartScroll[1] -
          (pointer.y - this.panStartMouse[1]) / camera.zoom
      );
    } else if (pointer.leftButtonDown()) {
      this.placeTile(pointer);
    } else if (pointer.rightButtonDown()) {
      this.deleteTile(pointer);
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (pointer.middleButtonReleased()) {
      this.isPanning = false;
      this.panStartMouse = undefined;
      this.panStartScroll = undefined;
    }
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
        existing.variant === this.tileVariant
      ) {
        return;
      }

      this.tilemap.tiles[key] = {
        type: this.selectedTileType,
        variant: this.tileVariant,
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
      variant: this.tileVariant,
      depth: this.getSelectedDepth(),
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
    return [
      camera.scrollX +
        camera.width / 2 +
        (pointer.x - camera.width / 2) / camera.zoom,
      camera.scrollY +
        camera.height / 2 +
        (pointer.y - camera.height / 2) / camera.zoom,
    ];
  }

  private getSelectedTextureKey() {
    return `${this.selectedTileType}/${this.selectedTileStatus === 'animated' ? 0 : this.tileVariant}`;
  }

  private getTextureKey(tile: OffGridTile) {
    return `${tile.type}/${tile.status === 'animated' ? 0 : (tile.variant ?? 0)}`;
  }

  private handleWheel(
    _pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ) {
    if (deltaY === 0) {
      return;
    }

    const direction = deltaY < 0 ? 1 : -1;
    if (this.ctrlKey?.isDown) {
      this.zoomVelocity += direction * 0.04;
      return;
    }
    if (this.shiftKey?.isDown) {
      this.tileGroup =
        (this.tileGroup + direction + this.tileCategories.length) %
        this.tileCategories.length;
      this.subTypeIndex = 0;
      this.tileVariant = 0;
    } else {
      const category = this.getSelectedCategory();
      if (category.types.length > 1) {
        this.subTypeIndex =
          (this.subTypeIndex + direction + category.types.length) %
          category.types.length;
        this.tileVariant = 0;
      } else {
        const variantCount = category.name === 'grass' ? 16 : 4;
        this.tileVariant =
          (this.tileVariant + direction + variantCount) % variantCount;
      }
    }

    this.updateSelectedTile();
  }

  private getSelectedCategory() {
    const category = this.tileCategories[this.tileGroup];
    if (!category) {
      throw new Error(`Unknown editor tile category index: ${this.tileGroup}`);
    }

    return category;
  }

  private updateSelectedTile() {
    const category = this.getSelectedCategory();
    const selectedType = category.types[this.subTypeIndex];
    if (!selectedType) {
      throw new Error(`Unknown tile subtype index: ${this.subTypeIndex}`);
    }

    this.selectedTileType = selectedType;
    this.selectedTileStatus =
      category.name === 'palm_tree' ? 'animated' : 'static';
    const textureKey = this.getSelectedTextureKey();
    this.tilePreview?.setTexture(textureKey);
    this.updateTileIcon();
    this.updateStatusText();
  }

  private updateTileIcon() {
    const tileIcon = this.tileIcon;
    if (!tileIcon) {
      return;
    }

    const textureKey = this.getSelectedTextureKey();
    const frame = this.textures.getFrame(textureKey);
    const crop =
      this.selectedTileType === 'spawner'
        ? this.spawnerIconBounds[this.tileVariant]
        : undefined;
    const iconTextureKey = crop
      ? this.createCroppedIconTexture(textureKey, crop)
      : textureKey;
    const widthToFit = crop?.width ?? frame.width;
    const heightToFit = crop?.height ?? frame.height;
    const areaWidth = TILE_SIZE * 1.5;
    const areaHeight = TILE_SIZE * 2;
    const scale = Math.min(areaWidth / widthToFit, areaHeight / heightToFit);
    const width = widthToFit * scale;
    const height = heightToFit * scale;

    tileIcon
      .setTexture(iconTextureKey)
      .setDisplaySize(width, height)
      .setPosition(8 + (areaWidth - width) / 2, 6 + (areaHeight - height) / 2);
  }

  private updateZoom() {
    if (Math.abs(this.zoomVelocity) <= 0.0001) {
      return;
    }

    const camera = this.cameras.main;
    const centerWorldX = camera.scrollX + camera.width / 2;
    const centerWorldY = camera.scrollY + camera.height / 2;
    this.zoom = Math.max(1, Math.min(3, this.zoom * 2 ** this.zoomVelocity));
    camera.setZoom(this.zoom);
    camera.setScroll(
      centerWorldX - camera.width / (2 * this.zoom),
      centerWorldY - camera.height / (2 * this.zoom)
    );

    this.zoomVelocity *= 0.8;
    if (Math.abs(this.zoomVelocity) < 0.0001) {
      this.zoomVelocity = 0;
    }
  }

  private createCroppedIconTexture(
    textureKey: string,
    crop: { x: number; y: number; width: number; height: number }
  ) {
    const iconTextureKey = `editor-icon:${textureKey}`;
    if (this.textures.exists(iconTextureKey)) {
      return iconTextureKey;
    }

    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create the editor tile icon canvas.');
    }

    const sourceImage = this.textures.get(textureKey).source[0]?.image;
    if (!sourceImage) {
      throw new Error(`Unable to load source image for ${textureKey}.`);
    }

    context.drawImage(
      sourceImage,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
    this.textures.addCanvas(iconTextureKey, canvas);

    return iconTextureKey;
  }

  private getSelectedDepth(): 'front' | 'back' {
    if (this.selectedTileType.startsWith('palm_tree/back/')) {
      return 'back';
    }
    if (this.selectedTileType.startsWith('palm_tree/front/')) {
      return 'front';
    }

    return this.selectedDepth;
  }

  private triggerAutoTile() {
    this.tilemap.autoTile();
    this.renderTilemap();
  }

  private updateStatusText() {
    const category = this.getSelectedCategory();
    const selection =
      category.name === 'palm_tree'
        ? `Palm ${this.selectedTileType.slice('palm_tree/'.length).replace(/\//g, ' ')}`
        : `${category.name === 'grass' ? 'Grass' : 'Spawner'} ${this.tileVariant}`;
    this.statusText?.setText(
      `${selection}\nG: grid ${this.onGrid ? 'on' : 'off'} | B: ${this.getSelectedDepth()}`
    );
  }
}
