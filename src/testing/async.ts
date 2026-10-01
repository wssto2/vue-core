import { nextTick } from "vue";

/** A promise you settle by hand: to make a request race or a slow answer deterministic. */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Lets pending promises, timers of 0 ms, router navigations and Vue's update queue run: a macrotask
 * and a render per round (`rounds`, default 5). For what a single `await nextTick()` does not reach.
 */
export async function settle(rounds = 5): Promise<void> {
  for (let round = 0; round < rounds; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}
