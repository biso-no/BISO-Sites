/**
 * Forward scanning for listings whose visibility is decided per row.
 *
 * Several tables in this schema cannot express their real filter as a query.
 * `pages` has row security off with a table-level `read("any")`, so staff
 * visibility is an application decision; and a page row can be `published`
 * while the locale's translation is not, which only the nested translation
 * reveals. In both cases Appwrite's `limit`/`offset` page over *unfiltered*
 * rows, so a window can filter down to nothing while the rows the caller
 * wanted sit just behind it — and a caller who stopped there would conclude
 * there was nothing more.
 *
 * Scanning forward keeps `limit` meaning "rows the caller actually gets" and
 * lets the cursor carry the raw scan position instead. Those are the only two
 * definitions that neither repeat nor skip a row: the backend can only skip raw
 * rows, so a cursor counting accepted ones could never line up.
 *
 * `nextOffset` is null only when the source is genuinely exhausted. Hitting
 * `ceiling` returns a short page *with* an offset, so a caller that follows the
 * cursor still reaches everything.
 */

export interface ScanOptions<TRow, TItem> {
  /** Map a raw row to an item, or null to skip it. */
  accept(row: TRow): TItem | null;
  /** Rows to request per round trip. */
  batchSize: number;
  /** Most rows to examine in one call, across all batches. */
  ceiling: number;
  /** How many accepted items to collect before stopping. */
  limit: number;
  /** Raw offset to resume from. */
  offset: number;
  /** Fetch one batch at the given raw offset. */
  read(offset: number, size: number): Promise<{ rows: TRow[] }>;
}

export async function scanForward<TRow, TItem>(
  options: ScanOptions<TRow, TItem>
): Promise<{ items: TItem[]; nextOffset: number | null }> {
  const items: TItem[] = [];
  let offset = options.offset;
  let scanned = 0;

  while (items.length < options.limit && scanned < options.ceiling) {
    const size = Math.min(options.batchSize, options.ceiling - scanned);
    const batch = await options.read(offset, size);
    if (batch.rows.length === 0) {
      return { items, nextOffset: null };
    }

    const consumed = collect(batch.rows, options, items);
    scanned += consumed;
    offset += consumed;

    // A short batch that was read to the end means the source ended. A short
    // batch that was *not* read to the end means the page filled first, and
    // there is more to come.
    if (consumed === batch.rows.length && batch.rows.length < size) {
      return { items, nextOffset: null };
    }
  }

  return { items, nextOffset: offset };
}

/**
 * Consume rows into `items` until the page is full, and report how many were
 * examined.
 *
 * The count is what advances the cursor, and it counts *examined* rows, not
 * accepted ones. Advancing by the whole batch would skip the rows left unread
 * when the page fills mid-batch.
 */
function collect<TRow, TItem>(
  rows: readonly TRow[],
  options: Pick<ScanOptions<TRow, TItem>, "accept" | "limit">,
  items: TItem[]
): number {
  let consumed = 0;
  for (const row of rows) {
    if (items.length >= options.limit) {
      break;
    }
    consumed += 1;
    const item = options.accept(row);
    if (item !== null) {
      items.push(item);
    }
  }
  return consumed;
}
