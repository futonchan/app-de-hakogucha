import type { Direction } from '../core/types';

type TimerId = ReturnType<typeof setTimeout>;

export type InputCallbacks = {
  move: (direction: Direction) => void;
  punch: () => void;
  pause: () => void;
};

export class InputController {
  private movePointerId: number | null = null;
  private punchPointerId: number | null = null;
  private currentDirection: Direction | null = null;
  private repeatTimer: TimerId | null = null;

  constructor(
    private readonly dpad: HTMLElement,
    private readonly punchButton: HTMLElement,
    private readonly callbacks: InputCallbacks
  ) {
    this.bind();
  }

  releaseAll(): void {
    this.movePointerId = null;
    this.punchPointerId = null;
    this.currentDirection = null;
    this.clearRepeat();
  }

  private bind(): void {
    this.dpad.addEventListener('pointerdown', (event) => this.onDpadDown(event));
    this.dpad.addEventListener('pointermove', (event) => this.onDpadMove(event));
    this.dpad.addEventListener('pointerup', (event) => this.onDpadUp(event));
    this.dpad.addEventListener('pointercancel', (event) => this.onDpadUp(event));
    this.dpad.addEventListener('lostpointercapture', (event) => this.onDpadUp(event));
    this.punchButton.addEventListener('pointerdown', (event) => this.onPunchDown(event));
    this.punchButton.addEventListener('pointerup', (event) => this.onPunchUp(event));
    this.punchButton.addEventListener('pointercancel', (event) => this.onPunchUp(event));
    this.punchButton.addEventListener('lostpointercapture', (event) => this.onPunchUp(event));
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  private onDpadDown(event: PointerEvent): void {
    event.preventDefault();
    if (this.movePointerId !== null) {
      return;
    }
    this.movePointerId = event.pointerId;
    this.dpad.setPointerCapture(event.pointerId);
    this.setDirection(this.directionFromPoint(event.clientX, event.clientY));
  }

  private onDpadMove(event: PointerEvent): void {
    if (event.pointerId !== this.movePointerId) {
      return;
    }
    event.preventDefault();
    this.setDirection(this.directionFromPoint(event.clientX, event.clientY));
  }

  private onDpadUp(event: PointerEvent): void {
    if (event.pointerId !== this.movePointerId) {
      return;
    }
    this.movePointerId = null;
    this.currentDirection = null;
    this.clearRepeat();
  }

  private onPunchDown(event: PointerEvent): void {
    event.preventDefault();
    if (this.punchPointerId !== null) {
      return;
    }
    this.punchPointerId = event.pointerId;
    this.punchButton.setPointerCapture(event.pointerId);
    this.callbacks.punch();
  }

  private onPunchUp(event: PointerEvent): void {
    if (event.pointerId === this.punchPointerId) {
      this.punchPointerId = null;
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    const directionByKey: Partial<Record<string, Direction>> = {
      ArrowUp: 'up',
      w: 'up',
      W: 'up',
      ArrowDown: 'down',
      s: 'down',
      S: 'down',
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right'
    };
    const direction = directionByKey[event.key];
    if (direction) {
      event.preventDefault();
      this.callbacks.move(direction);
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      this.callbacks.punch();
    }
    if (event.key === 'Escape') {
      this.callbacks.pause();
    }
  }

  private setDirection(direction: Direction | null): void {
    if (direction === null) {
      this.currentDirection = null;
      this.clearRepeat();
      return;
    }
    if (direction === this.currentDirection) {
      return;
    }
    this.currentDirection = direction;
    this.callbacks.move(direction);
    this.startRepeat();
  }

  private startRepeat(): void {
    this.clearRepeat();
    this.repeatTimer = setTimeout(() => {
      this.emitRepeat();
      this.repeatTimer = setInterval(() => this.emitRepeat(), 100);
    }, 250);
  }

  private emitRepeat(): void {
    if (this.currentDirection) {
      this.callbacks.move(this.currentDirection);
    }
  }

  private clearRepeat(): void {
    if (this.repeatTimer !== null) {
      clearTimeout(this.repeatTimer);
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
  }

  private directionFromPoint(clientX: number, clientY: number): Direction | null {
    const rect = this.dpad.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return null;
    }
    const dx = x - rect.width / 2;
    const dy = y - rect.height / 2;
    const deadZone = Math.min(rect.width, rect.height) * 0.18;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < deadZone) {
      return null;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }
}
