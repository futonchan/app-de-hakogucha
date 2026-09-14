import { directionDeltas } from '../core/board';
import { getBoxDisplayPosition } from '../core/display';
import type { Box, GameConfig, GameState } from '../core/types';

const colors: Record<Box['color'], string> = {
  red: '#e5484d',
  blue: '#2f7df6',
  green: '#30a46c',
  gray: '#8d8d99'
};

const labels: Record<Box['color'], string> = {
  red: 'R',
  blue: 'B',
  green: 'G',
  gray: '灰'
};

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly config: GameConfig
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable');
    }
    this.ctx = ctx;
  }

  resize(): void {
    const container = this.canvas.parentElement;
    const maxWidth = Math.min(container?.clientWidth ?? window.innerWidth, window.innerWidth);
    const availableHeight = Math.max(240, window.innerHeight - 260);
    const cssCell = Math.floor(Math.min(maxWidth / this.config.columns, availableHeight / this.config.rows));
    const cssWidth = cssCell * this.config.columns;
    const cssHeight = cssCell * this.config.rows;
    const pixelRatio = window.devicePixelRatio || 1;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.floor(cssWidth * pixelRatio);
    this.canvas.height = Math.floor(cssHeight * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  draw(state: GameState): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const cell = width / this.config.columns;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#101820';
    this.ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < this.config.rows; y += 1) {
      for (let x = 0; x < this.config.columns; x += 1) {
        this.ctx.strokeStyle = '#2b3645';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x * cell, y * cell, cell, cell);
      }
    }

    for (const box of state.boxes) {
      this.drawBox(box, cell, state.timeMs);
    }
    this.drawPunchTarget(state, cell);
    this.drawPlayer(state, cell);
  }

  private drawBox(box: Box, cell: number, nowMs: number): void {
    const display = getBoxDisplayPosition(box, nowMs, this.config);
    const pad = Math.max(2, cell * 0.08);
    const x = display.x * cell + pad;
    const y = display.y * cell + pad;
    const size = cell - pad * 2;
    this.ctx.fillStyle = colors[box.color];
    this.ctx.fillRect(x, y, size, size);
    this.ctx.strokeStyle = box.nextFallAtMs === null && box.motion === null ? '#ffffff' : '#ffdd57';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, size, size);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `bold ${Math.max(12, cell * 0.38)}px system-ui, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(box.color === 'gray' ? String(box.hp) : labels[box.color], display.x * cell + cell / 2, display.y * cell + cell / 2);
  }

  private drawPlayer(state: GameState, cell: number): void {
    const cx = state.player.x * cell + cell / 2;
    const cy = state.player.y * cell + cell / 2;
    const radius = cell * 0.36;
    const delta = directionDeltas[state.player.facing];
    this.ctx.fillStyle = '#ffd166';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#111111';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(cx + delta.dx * radius, cy + delta.dy * radius);
    this.ctx.lineTo(cx - delta.dy * radius * 0.45, cy + delta.dx * radius * 0.45);
    this.ctx.lineTo(cx + delta.dy * radius * 0.45, cy - delta.dx * radius * 0.45);
    this.ctx.closePath();
    this.ctx.fillStyle = '#111111';
    this.ctx.fill();
  }

  private drawPunchTarget(state: GameState, cell: number): void {
    const delta = directionDeltas[state.player.facing];
    const x = state.player.x + delta.dx;
    const y = state.player.y + delta.dy;
    if (x < 0 || x >= this.config.columns || y < 0 || y >= this.config.rows) {
      return;
    }
    this.ctx.strokeStyle = '#ffe66d';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
  }
}
