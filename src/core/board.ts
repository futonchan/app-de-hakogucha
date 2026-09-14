import type { Box, BoxId, Direction, GameConfig, GameState } from './types';

export const directionDeltas: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

export function isInside(config: GameConfig, x: number, y: number): boolean {
  return x >= 0 && x < config.columns && y >= 0 && y < config.rows;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function buildOccupancy(boxes: Box[]): Map<string, Box> {
  const occupancy = new Map<string, Box>();
  for (const box of boxes) {
    occupancy.set(cellKey(box.x, box.y), box);
  }
  return occupancy;
}

export function hasReservedCell(boxes: Box[], x: number, y: number): boolean {
  return boxes.some((box) => box.motion !== null && box.motion.toX === x && box.motion.toY === y);
}

export function isBoxMovingOrDue(box: Box, config: GameConfig, nowMs: number): boolean {
  if (box.motion !== null) {
    return box.motion.startedAtMs <= nowMs && nowMs <= box.motion.endsAtMs;
  }
  if (box.nextFallAtMs === null) {
    return false;
  }
  const startedAtMs = box.nextFallAtMs - config.fallStepMs;
  return startedAtMs <= nowMs && nowMs <= box.nextFallAtMs;
}

export function recalculateSupport(
  state: GameState,
  config: GameConfig,
  nowMs: number,
  rescheduleDueIds: Set<BoxId> = new Set()
): Set<BoxId> {
  const occupancy = buildOccupancy(state.boxes);
  const supportedIds = new Set<BoxId>();

  for (let x = 0; x < config.columns; x += 1) {
    for (let y = config.rows - 1; y >= 0; y -= 1) {
      const box = occupancy.get(cellKey(x, y));
      if (!box) {
        continue;
      }
      const below = occupancy.get(cellKey(x, y + 1));
      if (y === config.rows - 1 || (below && supportedIds.has(below.id))) {
        supportedIds.add(box.id);
      }
    }
  }

  for (const box of state.boxes) {
    if (box.motion !== null) {
      continue;
    }
    if (supportedIds.has(box.id)) {
      box.nextFallAtMs = null;
    } else if (rescheduleDueIds.has(box.id) || box.nextFallAtMs === null) {
      box.nextFallAtMs = nowMs + config.fallStepMs;
    }
  }

  return supportedIds;
}

export function assertValidState(state: GameState, config: GameConfig): void {
  const occupied = new Set<string>();
  const ids = new Set<BoxId>();
  for (const box of state.boxes) {
    if (!isInside(config, box.x, box.y)) {
      throw new Error(`Box ${box.id} is outside the board`);
    }
    if (ids.has(box.id)) {
      throw new Error(`Duplicate box id ${box.id}`);
    }
    ids.add(box.id);
    const occupiedKey = cellKey(box.x, box.y);
    if (occupied.has(occupiedKey)) {
      throw new Error(`Duplicate occupied cell ${occupiedKey}`);
    }
    occupied.add(occupiedKey);
    if ((box.color === 'gray' && (box.hp < 1 || box.hp > 3)) || (box.color !== 'gray' && box.hp !== 1)) {
      throw new Error(`Invalid HP for ${box.color} box ${box.id}`);
    }
    if (box.motion !== null && !isInside(config, box.motion.toX, box.motion.toY)) {
      throw new Error(`Box ${box.id} motion target is outside the board`);
    }
  }
  if (state.phase !== 'ended') {
    if (!isInside(config, state.player.x, state.player.y)) {
      throw new Error('Player is outside the board');
    }
    if (occupied.has(cellKey(state.player.x, state.player.y))) {
      throw new Error('Player overlaps a box while playing');
    }
  }
  if (!Number.isInteger(state.score) || state.score < 0) {
    throw new Error('Score must be a non-negative integer');
  }
}
