import { buildOccupancy, cellKey, recalculateSupport } from './board';
import type { BoxId, GameConfig, GameState } from './types';

export function applyGravity(state: GameState, config: GameConfig, nowMs: number): { movedIds: BoxId[]; crushed: boolean } {
  const pushedBoxes = state.boxes.filter((box) => box.motion !== null && box.motion.endsAtMs <= nowMs);
  const pushedIds = new Set<BoxId>();
  for (const box of pushedBoxes) {
    pushedIds.add(box.id);
    box.x = box.motion!.toX;
    box.y = box.motion!.toY;
    box.motion = null;
  }

  const dueBoxes = state.boxes
    .filter((box) => box.motion === null && box.nextFallAtMs !== null && box.nextFallAtMs <= nowMs)
    .sort((first, second) => second.y - first.y);
  const dueIds = new Set(dueBoxes.map((box) => box.id));
  if (dueBoxes.length === 0 && pushedIds.size === 0) {
    return { movedIds: [], crushed: false };
  }

  const occupancy = buildOccupancy(state.boxes);
  const canMove = new Map<BoxId, boolean>();
  for (const box of dueBoxes) {
    const belowY = box.y + 1;
    if (belowY >= config.rows) {
      canMove.set(box.id, false);
      continue;
    }
    const below = occupancy.get(cellKey(box.x, belowY));
    if (!below) {
      canMove.set(box.id, true);
      continue;
    }
    canMove.set(box.id, dueIds.has(below.id) && canMove.get(below.id) === true);
  }

  const movedIds: BoxId[] = [...pushedIds];
  let crushed = false;
  for (const box of dueBoxes) {
    if (!canMove.get(box.id)) {
      continue;
    }
    box.y += 1;
    movedIds.push(box.id);
    if (box.x === state.player.x && box.y === state.player.y) {
      crushed = true;
    }
  }

  recalculateSupport(state, config, nowMs, dueIds);
  return { movedIds, crushed };
}
