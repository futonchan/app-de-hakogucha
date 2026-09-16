import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { InputController } from '../../src/input/controller';
import type { Direction } from '../../src/core/types';

type PointerListener = (event: PointerEvent) => void;

class FakePointerElement {
  private readonly listeners = new Map<string, PointerListener[]>();
  private readonly capturedPointerIds = new Set<number>();

  constructor(private readonly rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') {
      return;
    }
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener as PointerListener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string, event: PointerEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  getBoundingClientRect(): DOMRect {
    return {
      ...this.rect,
      x: this.rect.left,
      y: this.rect.top,
      right: this.rect.left + this.rect.width,
      bottom: this.rect.top + this.rect.height,
      toJSON: () => ({})
    } as DOMRect;
  }

  setPointerCapture(pointerId: number): void {
    this.capturedPointerIds.add(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointerIds.has(pointerId);
  }

  asElement(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

class FakeWindow {
  addEventListener(): void {}
}

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function pointer(pointerId: number, clientX: number, clientY: number): PointerEvent {
  return {
    pointerId,
    clientX,
    clientY,
    preventDefault: vi.fn()
  } as unknown as PointerEvent;
}

function setupController(): { dpad: FakePointerElement; punch: FakePointerElement; events: string[] } {
  const dpad = new FakePointerElement({ left: 0, top: 0, width: 100, height: 100 });
  const punch = new FakePointerElement({ left: 140, top: 0, width: 80, height: 80 });
  const events: string[] = [];
  new InputController(dpad.asElement(), punch.asElement(), {
    move: (direction: Direction) => events.push(`move:${direction}`),
    punch: () => events.push('punch'),
    release: (direction: Direction | null) => events.push(`release:${direction ?? 'all'}`),
    pause: () => events.push('pause')
  });
  return { dpad, punch, events };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: new FakeWindow()
  });
});

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
});

describe('InputController pointer input', () => {
  it('treats the whole D-Pad as one non-overlapping directional touch area and switches while sliding', () => {
    const { dpad, events } = setupController();

    dpad.dispatch('pointerdown', pointer(1, 10, 50));
    dpad.dispatch('pointermove', pointer(1, 90, 50));
    dpad.dispatch('pointermove', pointer(1, 50, 10));
    dpad.dispatch('pointerup', pointer(1, 50, 10));

    expect(events).toEqual(['move:left', 'release:left', 'move:right', 'release:right', 'move:up', 'release:up']);
  });

  it('keeps D-Pad and punch pointerIds independent during simultaneous touches', () => {
    const { dpad, punch, events } = setupController();

    dpad.dispatch('pointerdown', pointer(1, 10, 50));
    punch.dispatch('pointerdown', pointer(2, 180, 40));
    punch.dispatch('pointerdown', pointer(1, 180, 40));
    dpad.dispatch('pointermove', pointer(1, 90, 50));
    punch.dispatch('pointerup', pointer(2, 180, 40));
    dpad.dispatch('pointerup', pointer(1, 90, 50));

    expect(events).toEqual(['move:left', 'punch', 'release:left', 'move:right', 'release:right']);
  });

  it('allows D-Pad input while a different pointer is holding punch', () => {
    const { dpad, punch, events } = setupController();

    punch.dispatch('pointerdown', pointer(7, 180, 40));
    dpad.dispatch('pointerdown', pointer(8, 90, 50));
    dpad.dispatch('pointerup', pointer(8, 90, 50));
    punch.dispatch('pointerup', pointer(7, 180, 40));

    expect(events).toEqual(['punch', 'move:right', 'release:right']);
  });

  it('clears only the matching pointer state on cancel and lostpointercapture', () => {
    const { dpad, punch, events } = setupController();

    dpad.dispatch('pointerdown', pointer(3, 50, 90));
    dpad.dispatch('pointercancel', pointer(3, 50, 90));
    dpad.dispatch('pointerdown', pointer(4, 10, 50));
    dpad.dispatch('lostpointercapture', pointer(4, 10, 50));
    punch.dispatch('pointerdown', pointer(5, 180, 40));
    punch.dispatch('lostpointercapture', pointer(5, 180, 40));
    punch.dispatch('pointerdown', pointer(6, 180, 40));
    punch.dispatch('pointerup', pointer(6, 180, 40));

    expect(events).toEqual(['move:down', 'release:down', 'move:left', 'release:left', 'punch', 'punch']);
  });
});
