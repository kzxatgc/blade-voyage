import { Animation } from '../utils/Animation.ts';
import { RENDER_DEPTH } from '../../shared/constants.ts';

export type ParticleType =
  | 'player/run_dust'
  | 'enemy/run_dust'
  | 'jump_dust'
  | 'land_dust';

type ParticleAnimationConfig = {
  path: string;
  frameCount: number;
};

type ParticlePosition = readonly [number, number];

export interface ParticleRenderImage {
  setOrigin(x: number, y: number): void;
  setPosition(x: number, y: number): void;
  setTexture(texture: string): void;
  setFlipX(flip: boolean): void;
  setDepth?(depth: number): void;
  destroy(): void;
}

export interface ParticleRenderScene {
  add: {
    image(x: number, y: number, texture: string): ParticleRenderImage;
  };
}

const PARTICLE_ANIMATIONS: Readonly<
  Record<ParticleType, ParticleAnimationConfig>
> = {
  'player/run_dust': { path: 'particle/run_dust', frameCount: 5 },
  'enemy/run_dust': { path: 'particle/run_dust', frameCount: 5 },
  jump_dust: { path: 'particle/jump_dust', frameCount: 6 },
  land_dust: { path: 'particle/land_dust', frameCount: 5 },
};

const createParticleAnimation = (type: ParticleType) => {
  const config = PARTICLE_ANIMATIONS[type];
  if (!config) {
    throw new Error(`Missing particle animation configuration for "${type}".`);
  }

  return new Animation(config.path, config.frameCount, 6, false);
};

export class Particle {
  readonly type: ParticleType;
  readonly pos: [number, number];
  readonly velocity: [number, number];
  readonly flip: boolean;
  readonly animation: Animation;
  private image: ParticleRenderImage | null = null;
  private imageTexture: string | null = null;

  constructor(
    type: ParticleType,
    pos: ParticlePosition,
    flip: boolean,
    animation: Animation,
    velocity: ParticlePosition = [0, 0]
  ) {
    this.type = type;
    this.pos = [pos[0], pos[1]];
    this.velocity = [velocity[0], velocity[1]];
    this.flip = flip;
    this.animation = animation.copy();
  }

  update() {
    this.pos[0] += this.velocity[0];
    this.pos[1] += this.velocity[1];
    this.animation.update();
  }

  render(
    scene: ParticleRenderScene,
    interpolationOffset: ParticlePosition = [0, 0]
  ) {
    const texture = this.animation.img();
    if (!this.image) {
      this.image = scene.add.image(this.pos[0], this.pos[1], texture);
      this.image.setOrigin(0, 0);
      this.image.setDepth?.(RENDER_DEPTH.PARTICLES);
      this.imageTexture = texture;
    } else if (this.imageTexture !== texture) {
      this.image.setTexture(texture);
      this.imageTexture = texture;
    }

    this.image.setPosition(
      this.pos[0] + interpolationOffset[0],
      this.pos[1] + interpolationOffset[1]
    );
    this.image.setFlipX(this.flip);
  }

  destroy() {
    this.image?.destroy();
    this.image = null;
    this.imageTexture = null;
  }
}

export class Particles {
  particles: Particle[] = [];
  readonly spawnCooldown: Record<string, number | null> = {
    'player/run_dust': null,
    'enemy/run_dust': 600,
  };
  readonly sfxFlags: Record<'player/run_dust' | 'enemy/run_dust', boolean> = {
    'player/run_dust': false,
    'enemy/run_dust': false,
  };

  private readonly lastSpawnTime = new Map<ParticleType, number>();
  private readonly now: () => number;
  private readonly spawnedSinceUpdate = new Set<Particle>();

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  addParticle(
    type: ParticleType,
    pos: ParticlePosition,
    flip: boolean,
    velocity: ParticlePosition = [0, 0]
  ) {
    const currentTime = this.now();
    if (!Number.isFinite(currentTime)) {
      throw new RangeError('Particle clock must return a finite time.');
    }

    const cooldown = Object.hasOwn(this.spawnCooldown, type)
      ? this.spawnCooldown[type]
      : 1;
    const lastSpawnTime = this.lastSpawnTime.get(type);
    if (
      cooldown !== null &&
      cooldown !== undefined &&
      lastSpawnTime !== undefined &&
      currentTime - lastSpawnTime < cooldown
    ) {
      return;
    }

    const particle = new Particle(
      type,
      pos,
      flip,
      createParticleAnimation(type),
      velocity
    );
    this.particles.push(particle);
    this.spawnedSinceUpdate.add(particle);
    if (type === 'player/run_dust' || type === 'enemy/run_dust') {
      this.sfxFlags[type] = true;
    }
    this.lastSpawnTime.set(type, currentTime);
  }

  resetSfxFlags() {
    this.sfxFlags['player/run_dust'] = false;
    this.sfxFlags['enemy/run_dust'] = false;
  }

  update() {
    this.spawnedSinceUpdate.clear();
    this.resetSfxFlags();
    const activeParticles: Particle[] = [];
    for (const particle of this.particles) {
      particle.update();
      if (particle.animation.done) {
        particle.destroy();
      } else {
        activeParticles.push(particle);
      }
    }

    this.particles = activeParticles;
  }

  render(
    scene: ParticleRenderScene,
    playerInterpolationOffset: ParticlePosition = [0, 0]
  ) {
    for (const particle of this.particles) {
      const needsPlayerInterpolation =
        this.spawnedSinceUpdate.has(particle) &&
        (particle.type === 'player/run_dust' || particle.type === 'land_dust');
      particle.render(
        scene,
        needsPlayerInterpolation ? playerInterpolationOffset : [0, 0]
      );
    }
  }
}
