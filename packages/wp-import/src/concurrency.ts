/**
 * Runs `fn` over `items` with at most `limit` in flight at once, returning
 * results in *input* order regardless of the order they finish in.
 *
 * Every stage of the import is dominated by waiting — WordPress pages, OpenAI
 * translations, Appwrite upserts — so the pool is the difference between an
 * import measured in hours and one measured in minutes. It is deliberately
 * bounded: biso.no is production WordPress on shared hosting, and an unbounded
 * fan-out would just trade a slow import for a rate-limited one.
 *
 * The first rejection wins and no further items are pulled, but tasks already
 * in flight are awaited before it propagates, so a failure can never leave a
 * write racing on after the caller has moved on.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (limit < 1) {
    throw new Error(`Concurrency must be at least 1, got ${limit}`);
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  const worker = async (): Promise<void> => {
    while (!failed) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      try {
        results[index] = await fn(items[index] as T, index);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
        return;
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);

  if (failed) {
    throw failure;
  }
  return results;
}

const CONCURRENCY_FLAG = /^--concurrency=(\d+)$/;

/**
 * Reads `--concurrency=N` out of argv. Shared by the extract and load scripts
 * so the two CLIs cannot drift on flag spelling or validation.
 */
export function parseConcurrency(argv: string[], fallback: number): number {
  for (const arg of argv) {
    const match = CONCURRENCY_FLAG.exec(arg);
    if (match) {
      const value = Number.parseInt(match[1] ?? "", 10);
      if (value < 1) {
        throw new Error(`--concurrency must be at least 1, got ${value}`);
      }
      return value;
    }
  }
  return fallback;
}
