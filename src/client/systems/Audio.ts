export interface SfxDefinition {
  volume: number;
  files: string[];
}

export const SFX_DEFINITIONS: Record<string, SfxDefinition> = {
  'player/jump': {
    volume: 0.22,
    files: ['sfx/player/jump/0.wav', 'sfx/player/jump/1.wav'],
  },
  'player/run/grass': {
    volume: 0.07,
    files: [
      'sfx/player/run/grass/0.ogg',
      'sfx/player/run/grass/1.ogg',
      'sfx/player/run/grass/2.ogg',
      'sfx/player/run/grass/3.ogg',
    ],
  },
  'player/run/palm_tree': {
    volume: 0.7,
    files: [
      'sfx/player/run/palm_tree/0.ogg',
      'sfx/player/run/palm_tree/1.ogg',
    ],
  },
  'player/land/grass': {
    volume: 0.15,
    files: [
      'sfx/player/land/grass/0.ogg',
      'sfx/player/land/grass/1.ogg',
    ],
  },
  'player/land/palm_tree': {
    volume: 0.15,
    files: [
      'sfx/player/land/palm_tree/0.ogg',
      'sfx/player/land/palm_tree/1.ogg',
    ],
  },
  'player/pickup_sword': {
    volume: 0.4,
    files: ['sfx/player/pickup_sword.wav'],
  },
  'player/sword/attack': {
    volume: 1.2,
    files: [
      'sfx/player/sword/attack/0.wav',
      'sfx/player/sword/attack/1.wav',
      'sfx/player/sword/attack/2.wav',
      'sfx/player/sword/attack/3.wav',
      'sfx/player/sword/attack/4.wav',
      'sfx/player/sword/attack/5.wav',
      'sfx/player/sword/attack/6.wav',
      'sfx/player/sword/attack/7.wav',
      'sfx/player/sword/attack/8.wav',
      'sfx/player/sword/attack/9.wav',
      'sfx/player/sword/attack/10.wav',
      'sfx/player/sword/attack/11.wav',
      'sfx/player/sword/attack/12.wav',
    ],
  },
  'player/sword/air_attack': {
    volume: 1.6,
    files: [
      'sfx/player/sword/air_attack/0.wav',
      'sfx/player/sword/air_attack/1.wav',
      'sfx/player/sword/air_attack/2.wav',
    ],
  },
  'player/throw_sword': {
    volume: 0.9,
    files: ['sfx/player/throw_sword.wav'],
  },
  'player/hit': {
    volume: 3.0,
    files: ['sfx/player/hit.wav'],
  },
  'player/dead_hit': {
    volume: 3.0,
    files: ['sfx/player/dead_hit.wav'],
  },
  'sword/strike/stone': {
    volume: 0.1,
    files: ['sfx/sword/strike/stone.wav'],
  },
  'sword/spinning': {
    volume: 0.4,
    files: [
      'sfx/sword/spinning/0.wav',
      'sfx/sword/spinning/1.wav',
      'sfx/sword/spinning/2.wav',
    ],
  },
  'sword/kicked': {
    volume: 0.5,
    files: ['sfx/sword/kicked.wav'],
  },
  'dialogue/exclamation': {
    volume: 0.5,
    files: ['sfx/dialogue/exclamation.wav'],
  },
};

export interface SoundPlayer {
  play(key: string, extra?: { volume?: number }): boolean;
}

export interface PlaySfxOptions {
  sequenceIndex?: number | undefined;
  volumeScale?: number | undefined;
}

export class SoundSystem {
  private readonly sound?: SoundPlayer | undefined;
  private readonly random: () => number;

  constructor(sound?: SoundPlayer | undefined, random: () => number = Math.random) {
    this.sound = sound;
    this.random = random;
  }

  play(name: string, options?: PlaySfxOptions): string | null {
    const sfx = SFX_DEFINITIONS[name];
    if (!sfx || sfx.files.length === 0) {
      return null;
    }

    let chosenFile: string;
    if (options?.sequenceIndex !== undefined) {
      const idx = ((options.sequenceIndex % sfx.files.length) + sfx.files.length) % sfx.files.length;
      chosenFile = sfx.files[idx]!;
    } else if (name === 'player/sword/attack' && sfx.files.length > 9) {
      // Python: attack_weights = [1] * 9 + [2] * (len(attack_sfx) - 9)
      const weights: number[] = [];
      let totalWeight = 0;
      for (let i = 0; i < sfx.files.length; i++) {
        const w = i < 9 ? 1 : 2;
        weights.push(w);
        totalWeight += w;
      }
      let roll = this.random() * totalWeight;
      let selectedIndex = 0;
      for (let i = 0; i < weights.length; i++) {
        roll -= weights[i]!;
        if (roll <= 0) {
          selectedIndex = i;
          break;
        }
      }
      chosenFile = sfx.files[selectedIndex]!;
    } else {
      const idx = Math.floor(this.random() * sfx.files.length);
      chosenFile = sfx.files[idx]!;
    }

    const volume = sfx.volume * (options?.volumeScale ?? 1.0);
    try {
      this.sound?.play(chosenFile, { volume });
    } catch {
      // Safe no-op if audio context suspended or not ready
    }

    return chosenFile;
  }
}
