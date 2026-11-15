import type { RgbColor } from '../../shared/constants.ts';

export type SparkShape = 'diamond' | 'heart';
export type SparkDirection = 'burst' | 'up' | number | null | undefined;
export type SparkColor = RgbColor | readonly [number, number, number] | number;

export interface SparkPoint {
  x: number;
  y: number;
}

export interface SparksRenderSurface {
  fillStyle?(color: number, alpha?: number): unknown;
  fillPoints?(points: SparkPoint[]): unknown;
  fillPolygon?(points: [number, number][]): unknown;
}

export function rgbToHex(color: SparkColor): number {
  if (typeof color === 'number') {
    return color;
  }
  return (color[0] << 16) | (color[1] << 8) | color[2];
}

export function createHeartPoints(
  pos: readonly [number, number],
  size: number | readonly [number, number],
  ratio = 1,
  offset: readonly [number, number] = [0, 0]
): [number, number][] {
  const points: [number, number][] = [];
  const s = typeof size === 'number' ? size : size[0];
  for (let tStep = 0; tStep < 628; tStep += 5) {
    const t = tStep / 100;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    );
    points.push([
      pos[0] - offset[0] + s / 2 + (x * s) / 40 * ratio - 1,
      pos[1] - offset[1] + s / 2 + (y * s) / 40 * ratio - 1,
    ]);
  }
  return points;
}

export function createDiamondPoints(
  pos: readonly [number, number],
  angle: number,
  speed: number,
  size: readonly [number, number] = [3, 0.5],
  offset: readonly [number, number] = [0, 0]
): [number, number][] {
  return [
    [
      pos[0] + Math.cos(angle) * speed * size[0] - offset[0],
      pos[1] + Math.sin(angle) * speed * size[1] - offset[1],
    ],
    [
      pos[0] + Math.cos(angle + Math.PI * 0.5) * speed * size[1] - offset[0],
      pos[1] + Math.sin(angle + Math.PI * 0.5) * speed * size[1] - offset[1],
    ],
    [
      pos[0] + Math.cos(angle + Math.PI) * speed * size[0] - offset[0],
      pos[1] + Math.sin(angle + Math.PI) * speed * size[0] - offset[1],
    ],
    [
      pos[0] + Math.cos(angle - Math.PI * 0.5) * speed * size[1] - offset[0],
      pos[1] + Math.sin(angle - Math.PI * 0.5) * speed * size[1] - offset[1],
    ],
  ];
}

export class Spark {
  pos: [number, number];
  angle: number;
  speed: number;

  constructor(pos: readonly [number, number], angle: number, speed: number) {
    this.pos = [pos[0], pos[1]];
    this.angle = angle;
    this.speed = speed;
  }

  update(): boolean {
    this.pos[0] += Math.cos(this.angle) * this.speed;
    this.pos[1] += Math.sin(this.angle) * this.speed;

    this.speed = Math.max(0, this.speed - 0.1);
    return this.speed === 0;
  }

  render(
    color: SparkColor,
    surf: SparksRenderSurface,
    shape: SparkShape = 'diamond',
    offset: readonly [number, number] = [0, 0],
    size: number | readonly [number, number] = [3, 0.5]
  ) {
    const rawPoints =
      shape === 'diamond'
        ? createDiamondPoints(
            this.pos,
            this.angle,
            this.speed,
            typeof size === 'number' ? [size, size] : size,
            offset
          )
        : createHeartPoints(this.pos, size, 1, offset);

    const hexColor = rgbToHex(color);
    surf.fillStyle?.(hexColor, 1);
    if (typeof surf.fillPoints === 'function') {
      surf.fillPoints(rawPoints.map(([x, y]) => ({ x, y })));
    } else if (typeof surf.fillPolygon === 'function') {
      surf.fillPolygon(rawPoints);
    }
  }
}

export class Sparks {
  shape: SparkShape;
  size: number | readonly [number, number];
  color: SparkColor;
  sparks: Spark[] = [];

  constructor(
    pos: readonly [number, number],
    flip: boolean,
    speed: number,
    density: number,
    color: SparkColor,
    direction: SparkDirection = 'burst',
    shape: SparkShape = 'diamond',
    size: number | readonly [number, number] = [3, 0.5],
    random: () => number = Math.random
  ) {
    this.shape = shape;
    this.size = size;
    this.color = color;
    this.sparks = [];

    for (let i = 0; i < density; i++) {
      let angle: number;
      if (direction === 'burst' || direction === null || direction === undefined) {
        angle = random() * Math.PI * 2;
      } else if (direction === 'up') {
        // Arc spreading from upper-left (-153°) to upper-right (-27°)
        angle = -Math.PI * 0.85 + random() * Math.PI * 0.7;
      } else {
        angle = random() + direction + (flip ? Math.PI : 0);
      }
      this.sparks.push(new Spark(pos, angle, random() * speed));
    }
  }

  update(): boolean {
    this.sparks = this.sparks.filter((s) => !s.update());
    return this.sparks.length === 0;
  }

  render(
    surf: SparksRenderSurface,
    offset: readonly [number, number] = [0, 0]
  ) {
    for (const spark of this.sparks) {
      spark.render(this.color, surf, this.shape, offset, this.size);
    }
  }
}

