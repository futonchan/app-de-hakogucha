import type { GameConfig } from './core/types';

export const defaultGameConfig: GameConfig = {
  columns: 10,
  rows: 12,
  durationMs: 60_000,
  spawnIntervalMs: 1_000,
  firstSpawnAtMs: 1_000,
  fallStepMs: 250,
  comboWindowMs: 2_000,
  minimumConnected: 3,
  pointsPerMatchedBox: 100,
  comboMultiplierBase: 1,
  comboMultiplierStep: 0.5,
  boxHp: {
    red: 1,
    blue: 1,
    green: 1,
    gray: 3
  },
  boxColors: ['red', 'blue', 'green', 'gray'],
  playerStart: {
    x: 4,
    y: 11,
    facing: 'up'
  }
};

export const adoptedProvisionalRules = [
  'P-01',
  'P-02',
  'P-03',
  'P-04',
  'P-05',
  'P-06',
  'P-07',
  'P-08',
  'P-09',
  'P-10',
  'P-11',
  'P-12',
  'P-13',
  'P-14',
  'P-15',
  'P-16',
  'P-17',
  'P-18'
] as const;
