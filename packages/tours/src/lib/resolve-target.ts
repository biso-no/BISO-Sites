const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Resolves a selector to a live element, waiting for async-mounted targets.
 * Resolves immediately if present, otherwise watches the DOM until the element
 * appears or the timeout elapses (then resolves with whatever is found, possibly
 * `null` so the caller can fall back gracefully).
 */
export function resolveTargetElement(
  selector: string,
  options?: { timeoutMs?: number }
): Promise<HTMLElement | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    let settled = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (element: HTMLElement | null) => {
      if (settled) {
        return;
      }
      settled = true;
      observer?.disconnect();
      if (timer) {
        clearTimeout(timer);
      }
      resolve(element);
    };

    observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) {
        finish(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setTimeout(
      () => finish(document.querySelector<HTMLElement>(selector)),
      timeoutMs
    );
  });
}
