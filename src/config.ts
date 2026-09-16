import type { BoxColor, GameConfig, InitialBoxPattern } from './core/types';

const red: BoxColor = 'red';
const blue: BoxColor = 'blue';
const green: BoxColor = 'green';
const gray: BoxColor = 'gray';

export const initialBoxPatterns: InitialBoxPattern[] = [
  {
    id: 'pattern-01',
    rows: [
      [blue, green, blue, green, gray, green, red, red, gray, green],
      [red, red, green, blue, green, blue, gray, gray, red, red]
    ]
  },
  {
    id: 'pattern-02',
    rows: [
      [gray, red, gray, blue, green, red, gray, red, blue, green],
      [gray, red, green, green, red, green, green, gray, green, gray]
    ]
  },
  {
    id: 'pattern-03',
    rows: [
      [blue, blue, green, blue, red, red, blue, green, green, gray],
      [red, gray, green, gray, green, gray, gray, red, red, gray]
    ]
  },
  {
    id: 'pattern-04',
    rows: [
      [blue, green, gray, gray, red, blue, green, blue, green, gray],
      [gray, red, red, blue, blue, green, red, gray, red, blue]
    ]
  },
  {
    id: 'pattern-05',
    rows: [
      [gray, red, green, gray, green, gray, red, red, blue, green],
      [blue, red, gray, red, red, gray, blue, green, red, red]
    ]
  },
  {
    id: 'pattern-06',
    rows: [
      [gray, green, red, gray, green, blue, red, gray, green, green],
      [gray, green, gray, green, blue, gray, gray, red, blue, gray]
    ]
  },
  {
    id: 'pattern-07',
    rows: [
      [blue, blue, gray, green, red, gray, red, green, red, gray],
      [green, green, gray, green, red, blue, gray, red, green, blue]
    ]
  },
  {
    id: 'pattern-08',
    rows: [
      [red, gray, red, gray, red, gray, red, green, gray, gray],
      [gray, green, red, gray, red, green, blue, gray, green, red]
    ]
  },
  {
    id: 'pattern-09',
    rows: [
      [gray, red, blue, gray, gray, red, gray, green, green, blue],
      [green, blue, red, red, blue, green, green, blue, blue, red]
    ]
  },
  {
    id: 'pattern-10',
    rows: [
      [red, red, blue, gray, gray, red, green, green, gray, blue],
      [green, gray, blue, red, blue, red, gray, blue, gray, red]
    ]
  }
];

export const defaultGameConfig: GameConfig = {
  columns: 10,
  rows: 12,
  durationMs: 60_000,
  spawnIntervalMs: 1_000,
  firstSpawnAtMs: 1_000,
  fallStepMs: 250,
  pushStepMs: 250,
  playerMoveStepMs: 50,
  clearAnimationMs: 500,
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
    y: 9,
    facing: 'up'
  },
  initialBoxPatterns
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
