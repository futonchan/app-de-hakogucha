import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '../../src/config';
import { advanceTo, chooseColor, chooseSpawnColumn, createBox, createGame } from '../../src/core/engine';
import { findMatchIds } from '../../src/core/matches';
import { applyClearScore, expireComboIfNeeded } from '../../src/core/scoring';
import type { Box, GameInput, GameState, Player } from '../../src/core/types';

function stateWith(boxes: Box[], player: Player = { x: 4, y: 11, facing: 'up' }): GameState {
  const state = createGame(123, defaultGameConfig);
  state.boxes = boxes.map((box) => ({ ...box }));
  state.nextBoxId = Math.max(1, ...boxes.map((box) => box.id + 1));
  state.player = { ...player };
  return state;
}

function pos(state: GameState): string[] {
  return state.boxes.map((box) => `${box.id}:${box.color}:${box.hp}:${box.x},${box.y}:${box.nextFallAtMs ?? 's'}`).sort();
}

describe('board, movement and push acceptance', () => {
  it('T-M01 creates a 10x12 empty game with the provisional player start', () => {
    const state = createGame(1, defaultGameConfig);
    expect(defaultGameConfig.columns).toBe(10);
    expect(defaultGameConfig.rows).toBe(12);
    expect(state.boxes).toHaveLength(0);
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);
  });

  it('T-M02/T-M03 moves one orthogonal cell and only turns at walls', () => {
    let state = createGame(1, defaultGameConfig);
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'move', direction: 'up' }]).state;
    expect(state.player).toEqual({ x: 4, y: 10, facing: 'up' });
    state = advanceTo(state, 2, [{ atMs: 2, seq: 2, type: 'move', direction: 'left' }]).state;
    expect(state.player).toEqual({ x: 3, y: 10, facing: 'left' });
    state.player = { x: 0, y: 0, facing: 'left' };
    state = advanceTo(state, 3, [{ atMs: 3, seq: 3, type: 'move', direction: 'up' }]).state;
    expect(state.player).toEqual({ x: 0, y: 0, facing: 'up' });
  });

  it('T-M04 keeps the player floating without gravity', () => {
    const state = createGame(1, defaultGameConfig);
    state.player = { x: 5, y: 5, facing: 'down' };
    expect(advanceTo(state, 999).state.player).toEqual({ x: 5, y: 5, facing: 'down' });
  });

  it('T-M05-T-M10 pushes only stationary boxes, leaves the player in place and preserves gray HP', () => {
    let state = stateWith([createBox(1, 'red', 2, 11)], { x: 1, y: 11, facing: 'right' });
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'move', direction: 'right' }]).state;
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
    expect(state.boxes[0]).toMatchObject({ x: 3, y: 11 });

    state = stateWith([createBox(1, 'red', 2, 11), createBox(2, 'blue', 3, 11)], { x: 1, y: 11, facing: 'right' });
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'move', direction: 'right' }]).state;
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
    expect(pos(state)).toEqual(['1:red:1:2,11:s', '2:blue:1:3,11:s']);

    state = stateWith([createBox(1, 'gray', 2, 11, 2)], { x: 1, y: 11, facing: 'right' });
    state = advanceTo(state, 10, [{ atMs: 10, seq: 1, type: 'move', direction: 'right' }]).state;
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
    expect(state.boxes[0]).toMatchObject({ x: 3, y: 11, hp: 2, nextFallAtMs: null });
  });

  it('T-M08/T-M09/T-M11 blocks push attempts against falling boxes in any direction', () => {
    let state = stateWith([createBox(1, 'red', 1, 4, 1, 260)], { x: 1, y: 5, facing: 'up' });
    state = advanceTo(state, 10, [{ atMs: 10, seq: 1, type: 'move', direction: 'up' }]).state;
    expect(state.player).toEqual({ x: 1, y: 5, facing: 'up' });
    expect(state.boxes[0]).toMatchObject({ x: 1, y: 4, nextFallAtMs: 260 });

    state = stateWith([createBox(1, 'blue', 1, 6, 1, 260)], { x: 1, y: 5, facing: 'down' });
    state = advanceTo(state, 10, [{ atMs: 10, seq: 1, type: 'move', direction: 'down' }]).state;
    expect(state.player).toEqual({ x: 1, y: 5, facing: 'down' });
    expect(state.boxes[0]).toMatchObject({ x: 1, y: 6, nextFallAtMs: 260 });

    state = stateWith([createBox(1, 'green', 2, 10, 1, 250)], { x: 1, y: 10, facing: 'right' });
    state = advanceTo(state, 249, [{ atMs: 249, seq: 1, type: 'move', direction: 'right' }]).state;
    expect(state.player).toEqual({ x: 1, y: 10, facing: 'right' });
    expect(state.boxes[0]).toMatchObject({ x: 2, y: 10, nextFallAtMs: 250 });
  });

  it('T-M13-T-M15 allows supported boxes to be pushed and still blocks occupied destinations', () => {
    let state = stateWith([createBox(1, 'red', 2, 11)], { x: 1, y: 11, facing: 'right' });
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'move', direction: 'right' }]).state;
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
    expect(state.boxes[0]).toMatchObject({ x: 3, y: 11, nextFallAtMs: null });

    state = stateWith(
      [createBox(1, 'blue', 2, 10), createBox(2, 'gray', 2, 11)],
      { x: 1, y: 10, facing: 'right' }
    );
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'move', direction: 'right' }]).state;
    expect(state.player).toEqual({ x: 1, y: 10, facing: 'right' });
    expect(state.boxes.find((box) => box.id === 1)).toMatchObject({ x: 3, y: 10, nextFallAtMs: 251 });
    expect(state.boxes.find((box) => box.id === 2)).toMatchObject({ x: 2, y: 11, nextFallAtMs: null });

    state = stateWith([createBox(1, 'red', 2, 11), createBox(2, 'blue', 3, 11)], { x: 1, y: 11, facing: 'right' });
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'move', direction: 'right' }]).state;
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
    expect(pos(state)).toEqual(['1:red:1:2,11:s', '2:blue:1:3,11:s']);
  });

  it('T-M12 prevents successful push from auto-moving the player under a falling box', () => {
    let state = stateWith(
      [createBox(1, 'red', 2, 10), createBox(2, 'blue', 2, 11)],
      { x: 1, y: 11, facing: 'right' }
    );
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'move', direction: 'right' }]).state;

    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
    expect(state.boxes.find((box) => box.id === 2)).toMatchObject({ x: 3, y: 11 });
    expect(state.boxes.find((box) => box.id === 1)).toMatchObject({ x: 2, y: 10, nextFallAtMs: 251 });

    state = advanceTo(state, 251).state;
    expect(state.endReason).toBeNull();
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
    expect(state.boxes.find((box) => box.id === 1)).toMatchObject({ x: 2, y: 11 });
  });
});

describe('punch acceptance', () => {
  it('T-P01-T-P06 punches only the facing adjacent box and gray needs three hits', () => {
    let state = stateWith([createBox(1, 'red', 4, 10)], { x: 4, y: 11, facing: 'up' });
    const result = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'punch' }]);
    expect(result.state.boxes).toHaveLength(0);
    expect(result.state.player).toEqual({ x: 4, y: 11, facing: 'up' });
    expect(result.state.score).toBe(0);
    expect(result.state.combo).toBe(0);

    state = stateWith([createBox(1, 'gray', 4, 10)], { x: 4, y: 11, facing: 'up' });
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'punch' }]).state;
    expect(state.boxes[0].hp).toBe(2);
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });
    state = advanceTo(state, 2, [{ atMs: 2, seq: 2, type: 'punch' }]).state;
    expect(state.boxes[0].hp).toBe(1);
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });
    state = advanceTo(state, 3, [{ atMs: 3, seq: 3, type: 'punch' }]).state;
    expect(state.boxes).toHaveLength(0);
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });
  });

  it('T-P03-T-P05 treats empty, wall and two-cell targets as misses', () => {
    const state = stateWith([createBox(1, 'red', 4, 9), createBox(2, 'blue', 5, 11)], { x: 4, y: 11, facing: 'up' });
    const result = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'punch' }]);
    expect(pos(result.state)).toEqual(['1:red:1:4,9:251', '2:blue:1:5,11:s']);
  });

  it('T-P08/T-P12 destroys a normal box without moving, then enters the empty cell only by later move input', () => {
    let state = stateWith([createBox(1, 'red', 4, 10)], { x: 4, y: 11, facing: 'up' });
    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'punch' }]).state;

    expect(state.boxes).toHaveLength(0);
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });

    state = advanceTo(state, 2, [{ atMs: 2, seq: 2, type: 'move', direction: 'up' }]).state;
    expect(state.player).toEqual({ x: 4, y: 10, facing: 'up' });
  });

  it('T-P09/T-P10 keeps the player in place across all gray box punches', () => {
    let state = stateWith([createBox(1, 'gray', 4, 10)], { x: 4, y: 11, facing: 'up' });

    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'punch' }]).state;
    expect(state.boxes[0]).toMatchObject({ id: 1, hp: 2, x: 4, y: 10 });
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });

    state = advanceTo(state, 2, [{ atMs: 2, seq: 2, type: 'punch' }]).state;
    expect(state.boxes[0]).toMatchObject({ id: 1, hp: 1, x: 4, y: 10 });
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });

    state = advanceTo(state, 3, [{ atMs: 3, seq: 3, type: 'punch' }]).state;
    expect(state.boxes).toHaveLength(0);
    expect(state.player).toEqual({ x: 4, y: 11, facing: 'up' });
  });

  it('T-P11 makes boxes above a punched box fall while the player stays outside the cleared cell', () => {
    let state = stateWith(
      [createBox(1, 'red', 2, 10), createBox(2, 'blue', 2, 11)],
      { x: 1, y: 11, facing: 'right' }
    );

    state = advanceTo(state, 1, [{ atMs: 1, seq: 1, type: 'punch' }]).state;
    expect(state.boxes.find((box) => box.id === 2)).toBeUndefined();
    expect(state.boxes.find((box) => box.id === 1)).toMatchObject({ x: 2, y: 10, nextFallAtMs: 251 });
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });

    state = advanceTo(state, 251).state;
    expect(state.endReason).toBeNull();
    expect(state.boxes.find((box) => box.id === 1)).toMatchObject({ x: 2, y: 11, nextFallAtMs: null });
    expect(state.player).toEqual({ x: 1, y: 11, facing: 'right' });
  });
});

describe('spawn and random acceptance', () => {
  it('T-S01/T-S02 spawns at 1000ms intervals without duplicates', () => {
    let state = createGame(4, defaultGameConfig);
    expect(advanceTo(state, 999).state.boxes).toHaveLength(0);
    state = advanceTo(state, 1_000).state;
    expect(state.boxes).toHaveLength(1);
    state = advanceTo(state, 3_000).state;
    expect(state.boxes).toHaveLength(3);
  });

  it('T-S03-T-S07 maps open columns and colors from random intervals', () => {
    expect(chooseSpawnColumn([2], 0.99)).toBe(2);
    expect([0, 0.34, 0.99].map((value) => chooseSpawnColumn([1, 4, 8], value))).toEqual([1, 4, 8]);
    expect([0, 0.249999, 0.25, 0.499999, 0.5, 0.749999, 0.75, 0.999999].map((value) => chooseColor(defaultGameConfig.boxColors, value))).toEqual([
      'red',
      'red',
      'blue',
      'blue',
      'green',
      'green',
      'gray',
      'gray'
    ]);
  });

  it('T-S05/T-S09 handles no spawn columns and spawning onto player', () => {
    const fullTop = Array.from({ length: defaultGameConfig.columns }, (_, x) => createBox(x + 1, 'red', x, 0));
    let state = stateWith(fullTop);
    state.nextSpawnAtMs = 10;
    let result = advanceTo(state, 10);
    expect(result.state.endReason).toBe('no_spawn_column');

    state = stateWith(fullTop.filter((box) => box.x !== 4), { x: 4, y: 0, facing: 'down' });
    state.nextSpawnAtMs = 10;
    result = advanceTo(state, 10);
    expect(result.state.endReason).toBe('crushed');
    expect(result.state.boxes.some((box) => box.x === 4 && box.y === 0)).toBe(true);
  });

  it('T-S08 is deterministic for same seed and inputs', () => {
    const inputs: GameInput[] = [
      { atMs: 500, seq: 1, type: 'move', direction: 'left' },
      { atMs: 1_250, seq: 2, type: 'move', direction: 'right' }
    ];
    expect(advanceTo(createGame(99), 3_000, inputs).state).toEqual(advanceTo(createGame(99), 3_000, inputs).state);
  });
});

describe('gravity and crush acceptance', () => {
  it('T-F01-T-F04 falls every 250ms and respects floor and boxes', () => {
    let state = createGame(2, defaultGameConfig);
    state = advanceTo(state, 1_000).state;
    const spawnedX = state.boxes[0].x;
    expect(advanceTo(state, 1_249).state.boxes[0]).toMatchObject({ x: spawnedX, y: 0 });
    state = advanceTo(state, 1_250).state;
    expect(state.boxes[0]).toMatchObject({ x: spawnedX, y: 1 });

    state = stateWith([createBox(1, 'red', 0, 0, 1, 250)]);
    expect(advanceTo(state, 750).state.boxes[0].y).toBe(3);
    state = stateWith([createBox(1, 'red', 0, 11), createBox(2, 'blue', 1, 10), createBox(3, 'green', 1, 11)]);
    expect(advanceTo(state, 500).state.boxes.map((box) => box.y).sort((a, b) => a - b)).toEqual([10, 11, 11]);
  });

  it('T-F05/T-F06 makes unsupported stacks fall from support-loss time independent of array order', () => {
    const boxes = [createBox(1, 'red', 1, 9), createBox(2, 'blue', 1, 10), createBox(3, 'green', 1, 11)];
    const run = (fixture: Box[]) => {
      let state = stateWith(fixture, { x: 0, y: 11, facing: 'right' });
      state = advanceTo(state, 101, [{ atMs: 101, seq: 1, type: 'punch' }]).state;
      expect(pos(advanceTo(state, 350).state)).toContain('1:red:1:1,9:351');
      return pos(advanceTo(state, 351).state);
    };
    expect(run(boxes)).toEqual(run([...boxes].reverse()));
  });

  it('T-F09-T-F14 applies input/punch before same-time gravity and ends once on crush', () => {
    let state = stateWith([createBox(1, 'red', 4, 10, 1, 250)], { x: 4, y: 11, facing: 'up' });
    expect(advanceTo(state, 250).state.endReason).toBe('crushed');

    state = stateWith([createBox(1, 'red', 4, 10, 1, 250)], { x: 4, y: 11, facing: 'up' });
    expect(advanceTo(state, 250, [{ atMs: 250, seq: 1, type: 'move', direction: 'left' }]).state.endReason).toBeNull();

    state = stateWith([createBox(1, 'red', 4, 10, 1, 250)], { x: 4, y: 11, facing: 'up' });
    expect(advanceTo(state, 250, [{ atMs: 250, seq: 1, type: 'punch' }]).state.endReason).toBeNull();

    state = stateWith([createBox(1, 'gray', 4, 10, 3, 250)], { x: 4, y: 11, facing: 'up' });
    expect(advanceTo(state, 250, [{ atMs: 250, seq: 1, type: 'punch' }]).state.endReason).toBe('crushed');
  });
});

describe('matches, combo and score acceptance', () => {
  it('T-C01-T-C08 clears orthogonal same-color components including gray and not diagonals', () => {
    expect(findMatchIds(stateWith([createBox(1, 'red', 1, 11), createBox(2, 'red', 2, 11), createBox(3, 'red', 3, 11)]), defaultGameConfig).size).toBe(3);
    expect(findMatchIds(stateWith([createBox(1, 'red', 1, 9), createBox(2, 'red', 1, 10), createBox(3, 'red', 1, 11)]), defaultGameConfig).size).toBe(3);
    expect(findMatchIds(stateWith([createBox(1, 'red', 1, 11), createBox(2, 'red', 2, 11), createBox(3, 'red', 2, 10)]), defaultGameConfig).size).toBe(3);
    expect(findMatchIds(stateWith([createBox(1, 'red', 1, 11), createBox(2, 'red', 2, 10), createBox(3, 'red', 3, 9)]), defaultGameConfig).size).toBe(0);
    expect(findMatchIds(stateWith([createBox(1, 'gray', 1, 11, 3), createBox(2, 'gray', 2, 11, 2), createBox(3, 'gray', 3, 11, 1)]), defaultGameConfig).size).toBe(3);
  });

  it('T-C09 keeps falling boxes out of match detection', () => {
    const state = stateWith([createBox(1, 'red', 1, 11), createBox(2, 'red', 2, 11), createBox(3, 'red', 3, 10, 1, 250)]);
    expect(findMatchIds(state, defaultGameConfig).size).toBe(0);
  });

  it('T-C11/T-B07 aggregates simultaneous groups into one combo event', () => {
    const state = stateWith([
      createBox(1, 'red', 1, 11),
      createBox(2, 'red', 2, 11),
      createBox(3, 'red', 3, 11),
      createBox(4, 'blue', 6, 11),
      createBox(5, 'blue', 7, 11),
      createBox(6, 'blue', 8, 11)
    ]);
    const result = advanceTo(state, 1);
    expect(result.state.boxes).toHaveLength(0);
    expect(result.state.score).toBe(600);
    expect(result.state.combo).toBe(1);
    expect(result.events.filter((event) => event.type === 'boxes_cleared')).toHaveLength(1);
  });

  it('T-B01-T-B10 scores combo windows inclusively and expires display only', () => {
    const state = createGame(1);
    expect(applyClearScore(state, defaultGameConfig, 1_000, 3)).toBe(300);
    expect(state.combo).toBe(1);
    expect(applyClearScore(state, defaultGameConfig, 3_000, 4)).toBe(600);
    expect(state.combo).toBe(2);
    expect(applyClearScore(state, defaultGameConfig, 5_001, 3)).toBe(300);
    expect(state.combo).toBe(1);
    state.lastClearAtMs = 10_000;
    state.combo = 2;
    state.maxCombo = 3;
    expireComboIfNeeded(state, defaultGameConfig, 12_001);
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(3);
  });
});

describe('time boundary and repeatability acceptance', () => {
  it('T-T02-T-T04 ends at 60000ms before same-time spawn or score', () => {
    const state = createGame(1);
    state.nextSpawnAtMs = 60_000;
    const result = advanceTo(state, 60_000);
    expect(result.state.timeMs).toBe(60_000);
    expect(result.state.endReason).toBe('time_up');
    expect(result.state.boxes).toHaveLength(0);
  });

  it('T-T09 produces the same result when advanced in chunks', () => {
    const inputs: GameInput[] = [
      { atMs: 250, seq: 1, type: 'move', direction: 'left' },
      { atMs: 1_250, seq: 2, type: 'move', direction: 'right' },
      { atMs: 1_500, seq: 3, type: 'punch' }
    ];
    const oneStep = advanceTo(createGame(777), 4_000, inputs).state;
    let chunked = createGame(777);
    for (const target of [500, 1_000, 1_750, 2_500, 4_000]) {
      chunked = advanceTo(chunked, target, inputs).state;
    }
    expect(chunked).toEqual(oneStep);
  });

  it('T-T10 ignores inputs and time after ended', () => {
    const ended = advanceTo(createGame(1), 60_000).state;
    const result = advanceTo(ended, 60_000, [{ atMs: 60_000, seq: 1, type: 'move', direction: 'left' }]);
    expect(result.state).toEqual(ended);
  });
});
