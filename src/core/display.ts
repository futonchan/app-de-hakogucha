import type { Box, GameConfig } from './types';

export type DisplayPosition = {
  x: number;
  y: number;
};

export function getBoxDisplayPosition(box: Box, nowMs: number, config: GameConfig): DisplayPosition {
  if (box.motion !== null) {
    const progress = progressRatio(nowMs, box.motion.startedAtMs, box.motion.endsAtMs);
    return {
      x: interpolate(box.motion.fromX, box.motion.toX, progress),
      y: interpolate(box.motion.fromY, box.motion.toY, progress)
    };
  }

  if (box.nextFallAtMs !== null) {
    const startedAtMs = box.nextFallAtMs - config.fallStepMs;
    const progress = progressRatio(nowMs, startedAtMs, box.nextFallAtMs);
    return {
      x: box.x,
      y: interpolate(box.y, box.y + 1, progress)
    };
  }

  return { x: box.x, y: box.y };
}

function progressRatio(nowMs: number, startedAtMs: number, endsAtMs: number): number {
  if (endsAtMs <= startedAtMs) {
    return 1;
  }
  return Math.min(1, Math.max(0, (nowMs - startedAtMs) / (endsAtMs - startedAtMs)));
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
