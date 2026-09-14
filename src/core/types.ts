export type Direction = 'up' | 'down' | 'left' | 'right';
export type BoxColor = 'red' | 'blue' | 'green' | 'gray';
export type BoxId = number;
export type EndReason = 'time_up' | 'crushed' | 'no_spawn_column';

export type BoxMotion = {
  kind: 'push';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startedAtMs: number;
  endsAtMs: number;
};

export type Box = {
  id: BoxId;
  color: BoxColor;
  hp: number;
  x: number;
  y: number;
  nextFallAtMs: number | null;
  motion: BoxMotion | null;
  unbreakable: boolean;
};

export type ClearAnimation = {
  boxIds: BoxId[];
  startedAtMs: number;
  durationMs: number;
};

export type Player = {
  x: number;
  y: number;
  facing: Direction;
};

export type GameInput =
  | { atMs: number; seq: number; type: 'move'; direction: Direction }
  | { atMs: number; seq: number; type: 'punch' }
  | { atMs: number; seq: number; type: 'release'; direction: Direction | null };

export type GamePhase = 'playing' | 'clearing' | 'ended';

export type GameState = {
  phase: GamePhase;
  timeMs: number;
  boxes: Box[];
  player: Player;
  score: number;
  combo: number;
  maxCombo: number;
  lastClearAtMs: number | null;
  nextSpawnAtMs: number;
  rngState: number;
  nextBoxId: number;
  endReason: EndReason | null;
  processedInputKeys: string[];
  clearAnimation: ClearAnimation | null;
  movementLocks: Direction[];
};

export type GameConfig = {
  columns: number;
  rows: number;
  durationMs: number;
  spawnIntervalMs: number;
  firstSpawnAtMs: number;
  fallStepMs: number;
  pushStepMs: number;
  clearAnimationMs: number;
  comboWindowMs: number;
  minimumConnected: number;
  pointsPerMatchedBox: number;
  comboMultiplierBase: number;
  comboMultiplierStep: number;
  boxHp: Record<BoxColor, number>;
  boxColors: BoxColor[];
  playerStart: Player;
  initialBoxPatterns: InitialBoxPattern[];
};

export type InitialBoxPattern = {
  id: string;
  rows: BoxColor[][];
};

export type GameEvent =
  | { type: 'box_spawned'; atMs: number; box: Box }
  | { type: 'box_punched'; atMs: number; boxId: BoxId; hp: number }
  | { type: 'box_broken'; atMs: number; boxId: BoxId }
  | { type: 'box_pushed'; atMs: number; boxId: BoxId; toX: number; toY: number }
  | { type: 'boxes_clear_started'; atMs: number; boxIds: BoxId[]; durationMs: number }
  | { type: 'boxes_cleared'; atMs: number; count: number; combo: number; points: number }
  | { type: 'boxes_fell'; atMs: number; boxIds: BoxId[] }
  | { type: 'game_ended'; atMs: number; reason: EndReason };
