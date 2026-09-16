import { buildOccupancy, cellKey, directionDeltas, hasReservedCell, isInside, isPushDestinationBlocked, recalculateSupport } from './board';
import type { Direction, GameConfig, GameEvent, GameState } from './types';

export function moveOrPush(state: GameState, config: GameConfig, nowMs: number, direction: Direction): void {
  state.player.facing = direction;
  if (state.movementLocks.includes(direction)) {
    return;
  }
  if (state.playerMotion !== null) {
    state.queuedMoveDirection = direction;
    return;
  }
  const delta = directionDeltas[direction];
  const targetX = state.player.x + delta.dx;
  const targetY = state.player.y + delta.dy;
  if (!isInside(config, targetX, targetY)) {
    return;
  }

  const occupancy = buildOccupancy(state.boxes);
  const targetBox = occupancy.get(cellKey(targetX, targetY));
  if (!targetBox) {
    if (hasReservedCell(state.boxes, targetX, targetY) || isPushDestinationBlocked(state.boxes, config, targetX, targetY)) {
      return;
    }
    state.playerMotion = {
      fromX: state.player.x,
      fromY: state.player.y,
      toX: targetX,
      toY: targetY,
      startedAtMs: nowMs,
      endsAtMs: nowMs + config.playerMoveStepMs
    };
    return;
  }
  if (targetBox.nextFallAtMs !== null || targetBox.motion !== null) {
    return;
  }

  const pushedX = targetBox.x + delta.dx;
  const pushedY = targetBox.y + delta.dy;
  if (!isInside(config, pushedX, pushedY) || isPushDestinationBlocked(state.boxes, config, pushedX, pushedY)) {
    return;
  }

  targetBox.motion = {
    kind: 'push',
    fromX: targetBox.x,
    fromY: targetBox.y,
    toX: pushedX,
    toY: pushedY,
    startedAtMs: nowMs,
    endsAtMs: nowMs + config.pushStepMs
  };
  lockMovementUntilRelease(state, direction);
}

export function punch(state: GameState, config: GameConfig, nowMs: number, events: GameEvent[]): void {
  const delta = directionDeltas[state.player.facing];
  const targetX = state.player.x + delta.dx;
  const targetY = state.player.y + delta.dy;
  if (!isInside(config, targetX, targetY)) {
    return;
  }

  const occupancy = buildOccupancy(state.boxes);
  const targetBox = occupancy.get(cellKey(targetX, targetY));
  if (!targetBox) {
    return;
  }

  if (targetBox.unbreakable) {
    events.push({ type: 'box_punched', atMs: nowMs, boxId: targetBox.id, hp: targetBox.hp });
    return;
  }

  targetBox.hp -= 1;
  events.push({ type: 'box_punched', atMs: nowMs, boxId: targetBox.id, hp: Math.max(0, targetBox.hp) });
  if (targetBox.hp <= 0) {
    state.boxes = state.boxes.filter((box) => box.id !== targetBox.id);
    events.push({ type: 'box_broken', atMs: nowMs, boxId: targetBox.id });
    lockMovementUntilRelease(state, state.player.facing);
  }
  recalculateSupport(state, config, nowMs);
}

export function releaseMovementLock(state: GameState, direction: Direction | null): void {
  if (direction === null) {
    state.movementLocks = [];
    return;
  }
  state.movementLocks = state.movementLocks.filter((lockedDirection) => lockedDirection !== direction);
}

function lockMovementUntilRelease(state: GameState, direction: Direction): void {
  if (!state.movementLocks.includes(direction)) {
    state.movementLocks.push(direction);
  }
}
