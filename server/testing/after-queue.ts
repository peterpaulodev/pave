// `after()` only works inside a request, so the integration setup
// (vitest.integration.setup.ts) replaces it with a queue. Tests flush it by
// hand — which is also what makes "the event is written after the response"
// observable.
type AfterCallback = () => Promise<void> | void;

const globalQueue = globalThis as unknown as { __afterQueue?: AfterCallback[] };

export function afterQueue(): AfterCallback[] {
  return (globalQueue.__afterQueue ??= []);
}

/** Runs (and clears) every callback scheduled with `after()` so far. */
export async function flushAfter(): Promise<void> {
  const callbacks = afterQueue().splice(0);
  for (const callback of callbacks) await callback();
}

export function clearAfter(): void {
  afterQueue().length = 0;
}
