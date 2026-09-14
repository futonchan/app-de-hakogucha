import { buildOccupancy, cellKey, directionDeltas, isBoxMovingOrDue, recalculateSupport } from './board';
import type { Box, BoxId, GameConfig, GameState } from './types';

export function findMatchIds(state: GameState, config: GameConfig): Set<BoxId> {
  const supportedIds = recalculateSupport(state, config, state.timeMs);
  const eligible = new Map<BoxId, Box>();
  for (const box of state.boxes) {
    if (supportedIds.has(box.id) && !isBoxMovingOrDue(box, config, state.timeMs)) {
      eligible.set(box.id, box);
    }
  }

  const occupancy = buildOccupancy([...eligible.values()]);
  const visited = new Set<BoxId>();
  const matched = new Set<BoxId>();

  for (const box of eligible.values()) {
    if (visited.has(box.id)) {
      continue;
    }
    const component: Box[] = [];
    const queue: Box[] = [box];
    visited.add(box.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const delta of Object.values(directionDeltas)) {
        const neighbor = occupancy.get(cellKey(current.x + delta.dx, current.y + delta.dy));
        if (!neighbor || visited.has(neighbor.id) || neighbor.color !== box.color) {
          continue;
        }
        visited.add(neighbor.id);
        queue.push(neighbor);
      }
    }

    if (component.length >= config.minimumConnected) {
      for (const matchedBox of component) {
        matched.add(matchedBox.id);
      }
    }
  }

  return matched;
}

export function startClearAnimation(state: GameState, config: GameConfig, nowMs: number): BoxId[] {
  state.timeMs = nowMs;
  if (state.clearAnimation !== null) {
    return [];
  }
  const matchedIds = findMatchIds(state, config);
  if (matchedIds.size === 0) {
    return [];
  }
  const boxIds = [...matchedIds].sort((first, second) => first - second);
  state.phase = 'clearing';
  state.clearAnimation = {
    boxIds,
    startedAtMs: nowMs,
    durationMs: config.clearAnimationMs
  };
  return boxIds;
}
