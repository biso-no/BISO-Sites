/**
 * Bounded-concurrency mapping.
 *
 * A read that has to be issued once per row — a count per event segment, say —
 * is a round trip per row when it is awaited in a loop. At a couple of hundred
 * rows that is long enough to pass this server's read timeout, and a timeout
 * hands the caller nothing at all while the abandoned handler goes on issuing
 * the rest: `Promise.race` abandons a read, it cannot cancel it.
 *
 * The answer is neither "one at a time" nor "all at once". Firing every
 * request together hands the backend a burst this package has no business
 * creating, and Appwrite would queue them anyway.
 */

/**
 * Map over `items` with at most `size` calls in flight, preserving input order.
 *
 * **Order is the contract.** Callers index the results against the input array,
 * so a reordering would silently attribute one row's answer to another — the
 * kind of defect that reads as plausible data rather than as a bug.
 *
 * A rejection propagates: these are reads whose partial results would be a
 * count that is wrong rather than a count that is missing, and the caller has
 * its own reporting for a read that failed.
 */
export async function inWaves<TIn, TOut>(
  items: readonly TIn[],
  size: number,
  run: (item: TIn) => Promise<TOut>
): Promise<TOut[]> {
  if (size < 1) {
    throw new RangeError("inWaves needs a wave size of at least 1");
  }
  const out: TOut[] = [];
  for (let start = 0; start < items.length; start += size) {
    const wave = await Promise.all(items.slice(start, start + size).map(run));
    out.push(...wave);
  }
  return out;
}
