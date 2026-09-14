import { buildOccupancy, cellKey, directionDeltas, recalculateSupport } from './board';
import type { Box, BoxId, GameConfig, GameState } from './types';

export function findMatchIds(state: GameState, config: GameConfig): Set<BoxId> {
  const supportedIds = recalculateSupport(state, config, state.timeMs);
  const eligible = new Map<BoxId, Box>();
  for (const box of state.boxes) {
    if (supportedIds.has(box.id)) {
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

export function clearMatches(state: GameState, config: GameConfig, nowMs: number): number {
  state.timeMs = nowMs;
  const matchedIds = findMatchIds(state, config);
  if (matchedIds.size === 0) {
    return 0;
  }
  state.boxes = state.boxes.filter((box) => !matchedIds.has(box.id));
  recalculateSupport(state, config, nowMs);
  return matchedIds.size;
}
