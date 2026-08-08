import { describe, expect, it, vi } from 'vitest';
import { DisposableStore } from './disposable';

describe('DisposableStore', () => {
  it('disposes resources in reverse registration order', () => {
    const order: string[] = [];
    const store = new DisposableStore();
    store.addCallback(() => order.push('first'));
    store.addCallback(() => order.push('second'));

    store.dispose();
    store.dispose();

    expect(order).toEqual(['second', 'first']);
  });

  it('immediately disposes resources added after disposal', () => {
    const dispose = vi.fn();
    const store = new DisposableStore();
    store.dispose();

    store.add({ dispose });

    expect(dispose).toHaveBeenCalledOnce();
  });

  it('can clear resources while remaining reusable', () => {
    const first = vi.fn();
    const second = vi.fn();
    const store = new DisposableStore();
    store.add({ dispose: first });

    store.clear();
    store.add({ dispose: second });
    store.dispose();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });
});
