import { assertValidState, buildOccupancy, cellKey, recalculateSupport } from './board';
import { nextRandom, normalizeSeed } from './random';
import { moveOrPush, punch, releaseMovementLock } from './actions';
import { applyGravity } from './gravity';
import { startClearAnimation } from './matches';
import { applyClearScore, expireComboIfNeeded } from './scoring';
import { defaultGameConfig } from '../config';
import type { Box, BoxColor, GameConfig, GameEvent, GameInput, GameState, InitialBoxPattern } from './types';

export function createGame(seed = 1, config: GameConfig = defaultGameConfig): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const patternDraw = nextRandom(normalizedSeed);
  const initialBoxes = createInitialBoxes(config, chooseInitialPattern(config.initialBoxPatterns, patternDraw.value));
  return {
    phase: 'playing',
    timeMs: 0,
    boxes: initialBoxes,
    player: { ...config.playerStart },
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastClearAtMs: null,
    nextSpawnAtMs: config.firstSpawnAtMs,
    rngState: patternDraw.state,
    nextBoxId: initialBoxes.length + 1,
    endReason: null,
    processedInputKeys: [],
    clearAnimation: null,
    movementLocks: []
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player },
    boxes: state.boxes.map((box) => ({ ...box, motion: box.motion ? { ...box.motion } : null })),
    processedInputKeys: [...state.processedInputKeys],
    clearAnimation: state.clearAnimation ? { ...state.clearAnimation, boxIds: [...state.clearAnimation.boxIds] } : null,
    movementLocks: [...state.movementLocks]
  };
}

export function createBox(id: number, color: BoxColor, x: number, y: number, hp?: number, nextFallAtMs: number | null = null): Box {
  return { id, color, x, y, hp: hp ?? defaultGameConfig.boxHp[color], nextFallAtMs, motion: null, unbreakable: false };
}

export function createInitialBoxes(config: GameConfig, pattern: InitialBoxPattern): Box[] {
  if (pattern.rows.length !== 2 || pattern.rows.some((row) => row.length !== config.columns)) {
    throw new Error(`Initial box pattern ${pattern.id} must contain exactly two ${config.columns}-cell rows`);
  }
  const firstInitialRow = config.rows - pattern.rows.length;
  if (firstInitialRow < 0) {
    throw new Error(`Initial box pattern ${pattern.id} does not fit on the board`);
  }
  return pattern.rows.flatMap((row, rowIndex) =>
    row.map((color, x) => ({
      id: rowIndex * config.columns + x + 1,
      color,
      hp: config.boxHp[color],
      x,
      y: firstInitialRow + rowIndex,
      nextFallAtMs: null,
      motion: null,
      unbreakable: true
    }))
  );
}

export function chooseInitialPattern(patterns: InitialBoxPattern[], randomValue: number): InitialBoxPattern {
  if (patterns.length === 0) {
    throw new Error('At least one initial box pattern is required');
  }
  return patterns[Math.min(patterns.length - 1, Math.floor(randomValue * patterns.length))]!;
}

export function chooseSpawnColumn(openColumns: number[], randomValue: number): number {
  return openColumns[Math.min(openColumns.length - 1, Math.floor(randomValue * openColumns.length))]!;
}

export function chooseColor(colors: BoxColor[], randomValue: number): BoxColor {
  return colors[Math.min(colors.length - 1, Math.floor(randomValue * colors.length))]!;
}

export function inputKey(input: GameInput): string {
  return `${input.atMs}:${input.seq}:${input.type}`;
}

export function advanceTo(
  originalState: GameState,
  targetGameTimeMs: number,
  orderedInputs: GameInput[] = [],
  config: GameConfig = defaultGameConfig
): { state: GameState; events: GameEvent[] } {
  const state = cloneState(originalState);
  const events: GameEvent[] = [];
  const targetMs = Math.max(state.timeMs, Math.min(targetGameTimeMs, config.durationMs));
  if (state.phase !== 'playing') {
    return { state, events };
  }

  while (state.phase === 'playing') {
    const nextTime = findNextTime(state, config, orderedInputs, targetMs);
    if (nextTime === null) {
      if (targetMs > state.timeMs) {
        state.timeMs = targetMs;
        expireComboIfNeeded(state, config, state.timeMs);
      }
      break;
    }
    processAt(state, config, orderedInputs, events, nextTime);
    if (nextTime >= targetMs && !hasDueWorkAtOrBefore(state, orderedInputs, targetMs)) {
      break;
    }
  }

  assertValidState(state, config);
  return { state, events };
}

function findNextTime(state: GameState, config: GameConfig, inputs: GameInput[], targetMs: number): number | null {
  const times: number[] = [];
  if (targetMs > state.timeMs) {
    times.push(targetMs);
  }
  if (config.durationMs >= state.timeMs && config.durationMs <= targetMs) {
    times.push(config.durationMs);
  }
  if (state.nextSpawnAtMs >= state.timeMs && state.nextSpawnAtMs <= targetMs) {
    times.push(state.nextSpawnAtMs);
  }
  for (const box of state.boxes) {
    if (box.nextFallAtMs !== null && box.nextFallAtMs >= state.timeMs && box.nextFallAtMs <= targetMs) {
      times.push(box.nextFallAtMs);
    }
    if (box.motion !== null && box.motion.endsAtMs >= state.timeMs && box.motion.endsAtMs <= targetMs) {
      times.push(box.motion.endsAtMs);
    }
  }
  for (const input of inputs) {
    if (!state.processedInputKeys.includes(inputKey(input)) && input.atMs >= state.timeMs && input.atMs <= targetMs) {
      times.push(input.atMs);
    }
  }
  if (times.length === 0) {
    return null;
  }
  return Math.min(...times);
}

function hasDueWorkAtOrBefore(state: GameState, inputs: GameInput[], targetMs: number): boolean {
  if (state.nextSpawnAtMs <= targetMs) {
    return true;
  }
  if (state.boxes.some((box) => box.nextFallAtMs !== null && box.nextFallAtMs <= targetMs)) {
    return true;
  }
  if (state.boxes.some((box) => box.motion !== null && box.motion.endsAtMs <= targetMs)) {
    return true;
  }
  return inputs.some((input) => !state.processedInputKeys.includes(inputKey(input)) && input.atMs <= targetMs);
}

function processAt(
  state: GameState,
  config: GameConfig,
  inputs: GameInput[],
  events: GameEvent[],
  nowMs: number
): void {
  state.timeMs = nowMs;

  if (nowMs >= config.durationMs) {
    endGame(state, events, nowMs, 'time_up');
    return;
  }

  processInputsAt(state, config, inputs, events, nowMs);
  if (tryStartClearAnimation(state, config, events, nowMs)) {
    return;
  }

  const fallResult = applyGravity(state, config, nowMs);
  if (fallResult.movedIds.length > 0) {
    events.push({ type: 'boxes_fell', atMs: nowMs, boxIds: fallResult.movedIds });
  }
  if (fallResult.crushed) {
    endGame(state, events, nowMs, 'crushed');
    return;
  }

  if (tryStartClearAnimation(state, config, events, nowMs)) {
    return;
  }
  if (state.nextSpawnAtMs === nowMs) {
    const spawnResult = spawnBox(state, config, events, nowMs);
    if (spawnResult !== null) {
      endGame(state, events, nowMs, spawnResult);
      return;
    }
  }

  if (tryStartClearAnimation(state, config, events, nowMs)) {
    return;
  }
  expireComboIfNeeded(state, config, nowMs);
}

function processInputsAt(
  state: GameState,
  config: GameConfig,
  inputs: GameInput[],
  events: GameEvent[],
  nowMs: number
): void {
  const dueInputs = inputs
    .filter((input) => input.atMs === nowMs && !state.processedInputKeys.includes(inputKey(input)))
    .sort((first, second) => {
      if (first.type !== second.type) {
        return inputOrder(first.type) - inputOrder(second.type);
      }
      return first.seq - second.seq;
    });

  for (const input of dueInputs) {
    state.processedInputKeys.push(inputKey(input));
    if (input.type === 'move') {
      moveOrPush(state, config, nowMs, input.direction);
    } else if (input.type === 'punch') {
      punch(state, config, nowMs, events);
    } else {
      releaseMovementLock(state, input.direction);
    }
  }
}

function inputOrder(type: GameInput['type']): number {
  if (type === 'release') {
    return 0;
  }
  if (type === 'move') {
    return 1;
  }
  return 2;
}

function spawnBox(state: GameState, config: GameConfig, events: GameEvent[], nowMs: number): 'crushed' | 'no_spawn_column' | null {
  const occupancy = buildOccupancy(state.boxes);
  const openColumns: number[] = [];
  for (let x = 0; x < config.columns; x += 1) {
    if (!occupancy.has(cellKey(x, 0))) {
      openColumns.push(x);
    }
  }
  if (openColumns.length === 0) {
    return 'no_spawn_column';
  }

  const columnDraw = nextRandom(state.rngState);
  state.rngState = columnDraw.state;
  const colorDraw = nextRandom(state.rngState);
  state.rngState = colorDraw.state;
  const x = chooseSpawnColumn(openColumns, columnDraw.value);
  const color = chooseColor(config.boxColors, colorDraw.value);
  const box: Box = {
    id: state.nextBoxId,
    color,
    hp: config.boxHp[color],
    x,
    y: 0,
    nextFallAtMs: null,
    motion: null,
    unbreakable: false
  };
  state.nextBoxId += 1;
  state.nextSpawnAtMs += config.spawnIntervalMs;
  state.boxes.push(box);
  events.push({ type: 'box_spawned', atMs: nowMs, box: { ...box } });
  recalculateSupport(state, config, nowMs);

  if (state.player.x === x && state.player.y === 0) {
    return 'crushed';
  }
  return null;
}

function scoreClears(
  state: GameState,
  config: GameConfig,
  events: GameEvent[],
  nowMs: number,
  clearedCount: number
): void {
  const points = applyClearScore(state, config, nowMs, clearedCount);
  if (points > 0) {
    events.push({ type: 'boxes_cleared', atMs: nowMs, count: clearedCount, combo: state.combo, points });
  }
}

export function finishClearAnimation(
  originalState: GameState,
  config: GameConfig = defaultGameConfig
): { state: GameState; events: GameEvent[] } {
  const state = cloneState(originalState);
  const events: GameEvent[] = [];
  if (state.phase !== 'clearing' || state.clearAnimation === null) {
    return { state, events };
  }

  const nowMs = state.timeMs;
  const clearIds = new Set(state.clearAnimation.boxIds);
  const clearedCount = state.boxes.filter((box) => clearIds.has(box.id)).length;
  state.boxes = state.boxes.filter((box) => !clearIds.has(box.id));
  state.clearAnimation = null;
  state.phase = 'playing';
  recalculateSupport(state, config, nowMs);
  scoreClears(state, config, events, nowMs, clearedCount);
  expireComboIfNeeded(state, config, nowMs);
  assertValidState(state, config);
  return { state, events };
}

function tryStartClearAnimation(state: GameState, config: GameConfig, events: GameEvent[], nowMs: number): boolean {
  const boxIds = startClearAnimation(state, config, nowMs);
  if (boxIds.length === 0) {
    return false;
  }
  events.push({ type: 'boxes_clear_started', atMs: nowMs, boxIds, durationMs: config.clearAnimationMs });
  return true;
}

function endGame(state: GameState, events: GameEvent[], nowMs: number, reason: 'time_up' | 'crushed' | 'no_spawn_column'): void {
  if (state.phase === 'ended') {
    return;
  }
  state.phase = 'ended';
  state.endReason = reason;
  events.push({ type: 'game_ended', atMs: nowMs, reason });
}
