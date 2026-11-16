export interface CloudImageSource {
  readonly key: string;
  readonly width: number;
  readonly height: number;
}

export interface CloudRenderImage {
  setOrigin(x: number, y: number): void;
  setPosition(x: number, y: number): void;
  setDisplaySize(width: number, height: number): void;
  setScrollFactor(factor: number): void;
  setVisible(visible: boolean): void;
}

export interface CloudRenderScene {
  readonly scale: {
    readonly width: number;
    readonly height: number;
  };
  readonly add: {
    image(x: number, y: number, texture: string): CloudRenderImage;
  };
}

export type CloudOffset = readonly [number, number];

const CLOUD_WRAP_WIDTH = 1600;
const CLOUD_SPAWN_HEIGHT = 250;
const CLOUD_SKY_BASE_Y = 130;
const BIG_CLOUD_SEA_LEVEL_FRAC = 0.676;

const modulo = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor;

const validateZoom = (zoom: number) => {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError('zoom must be a positive finite number.');
  }
};

const createCloudImage = (
  scene: CloudRenderScene,
  texture: string
): CloudRenderImage => {
  const image = scene.add.image(0, 0, texture);
  image.setOrigin(0, 0);
  image.setScrollFactor(0);
  return image;
};

export class Cloud {
  readonly texture: CloudImageSource;
  readonly pos: [number, number];
  readonly speed: number;
  readonly depth: number;
  readonly scale: number;
  private image: CloudRenderImage | null = null;

  constructor(
    texture: CloudImageSource,
    pos: CloudOffset,
    speed: number,
    depth: number,
    scale = 2
  ) {
    this.texture = texture;
    this.pos = [pos[0], pos[1]];
    this.speed = speed;
    this.depth = depth;
    this.scale = scale;
  }

  update() {
    this.pos[0] += this.speed;
  }

  render(
    scene: CloudRenderScene,
    offset: CloudOffset = [0, 0],
    zoom = 1,
    cameraZoom = 1
  ) {
    validateZoom(zoom);
    validateZoom(cameraZoom);

    const scaledWidth = this.texture.width * this.scale;
    const scaledHeight = this.texture.height * this.scale;
    const renderX = this.pos[0] - offset[0] * (this.depth * 0.15);
    const renderY = this.pos[1] - offset[1] * (this.depth * 0.05);
    const baseX = (modulo(renderX, CLOUD_WRAP_WIDTH) - scaledWidth) / zoom;
    const baseY = (CLOUD_SKY_BASE_Y + renderY - scaledHeight) / zoom;
    const baseW = Math.max(1, Math.floor(scaledWidth / zoom));
    const baseH = Math.max(1, Math.floor(scaledHeight / zoom));

    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;

    const x = cx + (baseX - cx) / cameraZoom;
    const y = cy + (baseY - cy) / cameraZoom;
    const width = Math.max(1, baseW / cameraZoom);
    const height = Math.max(1, baseH / cameraZoom);

    this.image ??= createCloudImage(scene, this.texture.key);
    this.image.setPosition(x, y);
    this.image.setDisplaySize(width, height);
  }
}

export class BigCloud {
  static readonly SEA_LEVEL_FRAC = BIG_CLOUD_SEA_LEVEL_FRAC;

  readonly texture: CloudImageSource;
  readonly speed: number;
  readonly parallax: number;
  scrollX = 0;
  private readonly images: CloudRenderImage[] = [];

  constructor(
    texture: CloudImageSource,
    speed?: number,
    random: () => number = Math.random
  ) {
    this.texture = texture;
    this.speed = speed ?? 0.6 + random() * (0.99 - 0.6);
    this.parallax = this.speed * 0.1;
  }

  update() {
    this.scrollX += this.speed;
  }

  render(
    scene: CloudRenderScene,
    offset: CloudOffset = [0, 0],
    zoom = 1,
    cameraZoom = 1
  ) {
    validateZoom(zoom);
    validateZoom(cameraZoom);

    const surfaceWidth = scene.scale.width;
    const surfaceHeight = scene.scale.height;
    if (surfaceWidth <= 0 || surfaceHeight <= 0) {
      throw new RangeError('Cloud render surface must have positive dimensions.');
    }

    const targetWidth = surfaceWidth;
    const targetHeight = Math.max(
      1,
      Math.floor((this.texture.height * targetWidth) / this.texture.width)
    );
    const baseY = surfaceHeight * BIG_CLOUD_SEA_LEVEL_FRAC - targetHeight;
    const drift = (this.scrollX - offset[0] * this.parallax) / zoom;
    const startX = modulo(drift, targetWidth) - targetWidth;
    const imageCount = Math.ceil(
      (surfaceWidth + targetWidth - startX) / targetWidth
    );

    while (this.images.length < imageCount) {
      this.images.push(createCloudImage(scene, this.texture.key));
    }

    const cx = surfaceWidth / 2;
    const cy = surfaceHeight / 2;

    this.images.forEach((image, index) => {
      image.setVisible(index < imageCount);
      if (index >= imageCount) {
        return;
      }

      const baseX = startX + index * targetWidth;
      const x = cx + (baseX - cx) / cameraZoom;
      const y = cy + (baseY - cy) / cameraZoom;
      const w = Math.max(1, targetWidth / cameraZoom);
      const h = Math.max(1, targetHeight / cameraZoom);

      image.setPosition(x, y);
      image.setDisplaySize(w, h);
    });
  }
}

export class Clouds {
  readonly clouds: Cloud[] = [];
  readonly bigClouds: BigCloud[];

  constructor(
    cloudImages: readonly CloudImageSource[],
    count = 10,
    bigCloudImages: readonly CloudImageSource[] = [],
    random: () => number = Math.random
  ) {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('count must be a non-negative integer.');
    }
    if (count > 0 && cloudImages.length === 0) {
      throw new Error('At least one small cloud image is required.');
    }

    this.bigClouds = bigCloudImages.map(
      (image) => new BigCloud(image, undefined, random)
    );
    const baseSpeed = this.bigClouds[0]?.speed ?? 0.8;
    const slotWidth = CLOUD_WRAP_WIDTH / Math.max(count, 1);

    for (let slot = 0; slot < count; slot++) {
      const imageIndex = Math.min(
        Math.floor(random() * cloudImages.length),
        cloudImages.length - 1
      );
      const image = cloudImages[imageIndex];
      if (!image) {
        throw new Error('Unable to select a small cloud image.');
      }

      const scale = random() < 0.5 ? 1 : 3;
      const cloudWidth = image.width * scale;
      const slotStart = slot * slotWidth;
      const maxJitter = Math.max(0, slotWidth - cloudWidth);
      const x = slotStart + random() * maxJitter;
      const y = random() * CLOUD_SPAWN_HEIGHT;
      const depth = random() * 0.6 + 0.2;
      const speed = baseSpeed * (0.3 + depth * 0.8);
      this.clouds.push(new Cloud(image, [x, y], speed, depth, scale));
    }
  }

  update() {
    for (const cloud of this.clouds) {
      cloud.update();
    }
    for (const bigCloud of this.bigClouds) {
      bigCloud.update();
    }
  }

  render(
    scene: CloudRenderScene,
    offset: CloudOffset = [0, 0],
    zoom = 1,
    cameraZoom = 1
  ) {
    for (const cloud of this.clouds) {
      cloud.render(scene, offset, zoom, cameraZoom);
    }
    for (const bigCloud of this.bigClouds) {
      bigCloud.render(scene, offset, zoom, cameraZoom);
    }
  }
}
