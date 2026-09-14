import { defaultGameConfig } from '../config';
import { advanceTo, createGame } from '../core/engine';
import type { Direction, GameInput, GameState } from '../core/types';
import { InputController } from '../input/controller';
import { CanvasRenderer } from '../render/canvas';

type RuntimePhase = 'ready' | 'countdown' | 'playing' | 'paused' | 'ended';

export class GameRuntime {
  private state: GameState = createGame(Date.now(), defaultGameConfig);
  private renderer: CanvasRenderer;
  private inputController: InputController;
  private phase: RuntimePhase = 'ready';
  private previousPhase: RuntimePhase = 'ready';
  private pendingInputs: GameInput[] = [];
  private seq = 1;
  private wallBaseMs = 0;
  private gameBaseMs = 0;
  private countdownStartedAtMs = 0;
  private countdownLeftMs = 3_000;
  private rafId = 0;

  constructor(
    private readonly root: HTMLElement,
    canvas: HTMLCanvasElement
  ) {
    this.renderer = new CanvasRenderer(canvas, defaultGameConfig);
    this.inputController = new InputController(
      this.get('[data-testid="dpad"]'),
      this.get('[data-testid="punch"]'),
      {
        move: (direction) => this.enqueueMove(direction),
        punch: () => this.enqueuePunch(),
        pause: () => this.pause('手動ポーズ')
      }
    );
    this.bindUi();
    this.renderer.resize();
    this.render();
    this.rafId = requestAnimationFrame((time) => this.tick(time));
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.inputController.releaseAll();
  }

  private bindUi(): void {
    this.get('[data-testid="start"]').addEventListener('click', () => this.start());
    this.get('[data-testid="pause"]').addEventListener('click', () => this.pause('手動ポーズ'));
    this.get('[data-testid="resume"]').addEventListener('click', () => this.resume());
    this.get('[data-testid="retry"]').addEventListener('click', () => this.retry());
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.render();
      if (window.matchMedia('(orientation: landscape)').matches) {
        this.pause('縦持ちに戻してから再開してください');
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause('画面非表示のためポーズしました');
      }
    });
    window.addEventListener('blur', () => this.pause('フォーカス喪失のためポーズしました'));
  }

  private start(): void {
    this.state = createGame(Date.now(), defaultGameConfig);
    this.pendingInputs = [];
    this.seq = 1;
    this.phase = 'countdown';
    this.countdownLeftMs = 3_000;
    this.countdownStartedAtMs = performance.now();
    this.message('3');
    this.updateButtons();
  }

  private retry(): void {
    this.inputController.releaseAll();
    this.start();
  }

  private pause(reason: string): void {
    if (this.phase !== 'playing' && this.phase !== 'countdown') {
      return;
    }
    this.inputController.releaseAll();
    if (this.phase === 'playing') {
      this.gameBaseMs = this.state.timeMs;
    } else {
      const elapsed = performance.now() - this.countdownStartedAtMs;
      this.countdownLeftMs = Math.max(0, this.countdownLeftMs - elapsed);
    }
    this.previousPhase = this.phase;
    this.phase = 'paused';
    this.message(reason);
    this.updateButtons();
  }

  private resume(): void {
    if (this.phase !== 'paused') {
      return;
    }
    if (this.previousPhase === 'countdown') {
      this.phase = 'countdown';
      this.countdownStartedAtMs = performance.now();
    } else {
      this.phase = 'playing';
      this.wallBaseMs = performance.now();
      this.gameBaseMs = this.state.timeMs;
      this.message('');
    }
    this.updateButtons();
  }

  private enqueueMove(direction: Direction): void {
    if (this.phase !== 'playing') {
      return;
    }
    this.pendingInputs.push({ atMs: this.state.timeMs, seq: this.seq, type: 'move', direction });
    this.seq += 1;
  }

  private enqueuePunch(): void {
    if (this.phase !== 'playing') {
      return;
    }
    this.pendingInputs.push({ atMs: this.state.timeMs, seq: this.seq, type: 'punch' });
    this.seq += 1;
  }

  private tick(now: number): void {
    if (this.phase === 'countdown') {
      const elapsed = now - this.countdownStartedAtMs;
      const left = Math.max(0, this.countdownLeftMs - elapsed);
      if (left <= 0) {
        this.phase = 'playing';
        this.wallBaseMs = now;
        this.gameBaseMs = 0;
        this.message('');
        this.updateButtons();
      } else {
        this.message(String(Math.ceil(left / 1_000)));
      }
    }

    if (this.phase === 'playing') {
      const targetMs = Math.floor(this.gameBaseMs + (now - this.wallBaseMs));
      const result = advanceTo(this.state, targetMs, this.pendingInputs, defaultGameConfig);
      this.state = result.state;
      this.pendingInputs = this.pendingInputs.filter((input) => !this.state.processedInputKeys.includes(`${input.atMs}:${input.seq}:${input.type}`));
      if (this.state.phase === 'ended') {
        this.phase = 'ended';
        this.inputController.releaseAll();
        this.message(this.endReasonText());
        this.updateButtons();
      }
    }

    this.render();
    this.rafId = requestAnimationFrame((time) => this.tick(time));
  }

  private render(): void {
    this.renderer.draw(this.state);
    this.get('[data-testid="score"]').textContent = String(this.state.score);
    this.get('[data-testid="time"]').textContent = (Math.max(0, defaultGameConfig.durationMs - this.state.timeMs) / 1_000).toFixed(1);
    this.get('[data-testid="combo"]').textContent = String(this.state.combo);
  }

  private message(text: string): void {
    const panel = this.get('[data-testid="message"]');
    if (!text) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    panel.querySelector('h1')!.textContent = text;
    const detail = panel.querySelector('p')!;
    detail.textContent =
      this.phase === 'ended'
        ? `スコア ${this.state.score} / 最大コンボ ${this.state.maxCombo}`
        : '十字キーで移動／プッシュ、パンチで隣接箱を攻撃します。';
  }

  private endReasonText(): string {
    if (this.state.endReason === 'time_up') {
      return 'タイムアップ';
    }
    if (this.state.endReason === 'no_spawn_column') {
      return 'これ以上箱を生成できません';
    }
    return '箱に潰された';
  }

  private updateButtons(): void {
    const start = this.get<HTMLButtonElement>('[data-testid="start"]');
    const pause = this.get<HTMLButtonElement>('[data-testid="pause"]');
    const resume = this.get<HTMLButtonElement>('[data-testid="resume"]');
    start.hidden = this.phase !== 'ready';
    pause.disabled = this.phase !== 'playing' && this.phase !== 'countdown';
    resume.hidden = this.phase !== 'paused';
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing element ${selector}`);
    }
    return element;
  }
}
