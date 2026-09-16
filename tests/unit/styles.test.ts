import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('game root touch gesture styles', () => {
  it('limits touch gesture suppression to the game root without disabling viewport zoom', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const gameRootRule = css.match(/\.game-root\s*\{[^}]+\}/)?.[0] ?? '';

    expect(html).toContain('class="app-shell game-root"');
    expect(html).toContain('width=device-width, initial-scale=1, viewport-fit=cover');
    expect(html).not.toContain('user-scalable=no');
    expect(html).not.toContain('maximum-scale');
    expect(gameRootRule).toContain('touch-action: none');
    expect(gameRootRule).toContain('user-select: none');
    expect(gameRootRule).toContain('-webkit-user-select: none');
    expect(gameRootRule).toContain('-webkit-touch-callout: none');
  });
});
