import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SFX_DEFINITIONS, SoundSystem, type SoundPlayer } from './Audio.ts';

void describe('SoundSystem and SFX_DEFINITIONS', () => {
  void it('defines every sound category', () => {
    const expectedKeys = [
      'player/jump',
      'player/run/grass',
      'player/run/palm_tree',
      'player/land/grass',
      'player/land/palm_tree',
      'player/pickup_sword',
      'player/pickup_health_potion',
      'player/sword/attack',
      'player/sword/air_attack',
      'player/throw_sword',
      'player/hit',
      'player/dead_hit',
      'sword/strike/stone',
      'sword/spinning',
      'sword/kicked',
      'dialogue/exclamation',
    ];
    for (const key of expectedKeys) {
      assert.ok(SFX_DEFINITIONS[key], `Missing sound definition for ${key}`);
    }
  });

  void it('contains exactly 39 total audio files across all definitions', () => {
    let totalFiles = 0;
    for (const def of Object.values(SFX_DEFINITIONS)) {
      totalFiles += def.files.length;
    }
    assert.equal(totalFiles, 39);
  });

  void it('defines the health-potion pickup sound', () => {
    assert.deepEqual(SFX_DEFINITIONS['player/pickup_health_potion'], {
      volume: 1.5,
      files: ['sfx/player/pickup_health_potion.mp3'],
    });
  });

  void it('plays single-file sounds with exact tuned volume', () => {
    const played: { key: string; volume?: number | undefined }[] = [];
    const mockSound: SoundPlayer = {
      play(key: string, extra?: { volume?: number }) {
        played.push({ key, volume: extra?.volume });
        return true;
      },
    };

    const soundSystem = new SoundSystem(mockSound);
    const chosen = soundSystem.play('player/pickup_sword');
    assert.equal(chosen, 'sfx/player/pickup_sword.wav');
    assert.deepEqual(played, [
      { key: 'sfx/player/pickup_sword.wav', volume: 0.4 },
    ]);
  });

  void it('selects sequential frames for spinning sword', () => {
    const played: string[] = [];
    const mockSound: SoundPlayer = {
      play(key: string) {
        played.push(key);
        return true;
      },
    };

    const soundSystem = new SoundSystem(mockSound);
    assert.equal(soundSystem.play('sword/spinning', { sequenceIndex: 0 }), 'sfx/sword/spinning/0.wav');
    assert.equal(soundSystem.play('sword/spinning', { sequenceIndex: 1 }), 'sfx/sword/spinning/1.wav');
    assert.equal(soundSystem.play('sword/spinning', { sequenceIndex: 2 }), 'sfx/sword/spinning/2.wav');
    assert.equal(soundSystem.play('sword/spinning', { sequenceIndex: 3 }), 'sfx/sword/spinning/0.wav');
  });

  void it('selects random jump sound variant', () => {
    const played: string[] = [];
    const mockSound: SoundPlayer = {
      play(key: string) {
        played.push(key);
        return true;
      },
    };

    const soundSystem0 = new SoundSystem(mockSound, () => 0.1);
    const chosen0 = soundSystem0.play('player/jump');
    assert.equal(chosen0, 'sfx/player/jump/0.wav');

    const soundSystem1 = new SoundSystem(mockSound, () => 0.9);
    const chosen1 = soundSystem1.play('player/jump');
    assert.equal(chosen1, 'sfx/player/jump/1.wav');
  });

  void it('handles attack weighted random choice and scales volume', () => {
    let playedVolume = 0;
    const mockSound: SoundPlayer = {
      play(_key: string, extra?: { volume?: number }) {
        playedVolume = extra?.volume ?? 0;
        return true;
      },
    };

    const soundSystem = new SoundSystem(mockSound, () => 0.5);
    const chosen = soundSystem.play('player/sword/attack', { volumeScale: 0.5 });
    assert.ok(chosen?.startsWith('sfx/player/sword/attack/'));
    assert.equal(playedVolume, 0.6); // 1.2 * 0.5
  });

  void it('returns null and does not throw for unknown key or when sound player is undefined', () => {
    const soundSystem = new SoundSystem(undefined);
    assert.equal(soundSystem.play('nonexistent/sound'), null);
    // Known sound with no sound player should return chosen file without error
    assert.equal(soundSystem.play('player/pickup_sword'), 'sfx/player/pickup_sword.wav');
  });
});
