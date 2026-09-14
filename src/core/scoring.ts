import type { GameConfig, GameState } from './types';

export function applyClearScore(state: GameState, config: GameConfig, nowMs: number, clearCount: number): number {
  if (clearCount <= 0) {
    return 0;
  }

  if (state.lastClearAtMs !== null && nowMs - state.lastClearAtMs <= config.comboWindowMs) {
    state.combo += 1;
  } else {
    state.combo = 1;
  }

  state.lastClearAtMs = nowMs;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const multiplier = config.comboMultiplierBase + config.comboMultiplierStep * (state.combo - 1);
  const points = Math.round(clearCount * config.pointsPerMatchedBox * multiplier);
  state.score += points;
  return points;
}

export function expireComboIfNeeded(state: GameState, config: GameConfig, nowMs: number): void {
  if (state.lastClearAtMs !== null && nowMs - state.lastClearAtMs > config.comboWindowMs) {
    state.combo = 0;
  }
}
