import { SEARCH_INDEX_SETTINGS } from "@repo/shared/search/settings";
import type { SearchEntry, SearchType } from "@repo/shared/search/types";
import {
  type EnqueuedTaskPromise,
  type Meilisearch,
  MeilisearchApiError,
} from "meilisearch";

export interface IndexWriter {
  /** Write every setting in `SEARCH_INDEX_SETTINGS`. */
  applySettings(): Promise<void>;
  /** Entries by document id (one locale of an item). */
  deleteIds(ids: string[]): Promise<void>;
  /** Every entry of one item: `type = X AND row_id = Y`. */
  deleteItem(type: SearchType, rowId: string): Promise<void>;
  /** The reindex sweep: `synced_at < N`. */
  deleteOlderThan(syncedAt: number): Promise<void>;
  /** One entry by document id, or null when the index has none. */
  getEntry(id: string): Promise<SearchEntry | null>;
  /** Add or replace entries by `id`. */
  upsert(entries: SearchEntry[]): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** A reindex batch of 500 entries can queue behind others; give it longer. */
const REINDEX_TIMEOUT_MS = 120_000;
const PRIMARY_KEY = "id";
const HTTP_NOT_FOUND = 404;

/** A filter string literal; JSON escaping matches Meilisearch's `\"` and `\\`. */
function quote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Meilisearch writes, each awaited to the end of its task. The client's wait
 * resolves for a failed task as well, so the status is checked here: a write
 * that did not land must throw (500 and Sentry), never answer 200.
 */
export function meiliWriter(
  client: Meilisearch,
  indexName: string,
  opts: { timeoutMs?: number } = {}
): IndexWriter {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const index = client.index<SearchEntry>(indexName);

  async function settle(pending: EnqueuedTaskPromise): Promise<void> {
    const task = await pending.waitTask({ timeout });
    if (task.status !== "succeeded") {
      throw new Error(
        `Meilisearch task ${task.uid} failed: ${task.error?.message ?? task.status}`
      );
    }
  }

  return {
    applySettings: () => settle(index.updateSettings(SEARCH_INDEX_SETTINGS)),
    deleteIds: async (ids) => {
      if (ids.length === 0) {
        return;
      }
      await settle(index.deleteDocuments(ids));
    },
    deleteItem: (type, rowId) =>
      settle(
        index.deleteDocuments({
          filter: `type = ${quote(type)} AND row_id = ${quote(rowId)}`,
        })
      ),
    deleteOlderThan: (syncedAt) =>
      settle(index.deleteDocuments({ filter: `synced_at < ${syncedAt}` })),
    getEntry: async (id) => {
      try {
        return await index.getDocument<SearchEntry>(id);
      } catch (error) {
        if (
          error instanceof MeilisearchApiError &&
          error.response.status === HTTP_NOT_FOUND
        ) {
          return null;
        }
        throw error;
      }
    },
    upsert: async (entries) => {
      if (entries.length === 0) {
        return;
      }
      await settle(index.addDocuments(entries, { primaryKey: PRIMARY_KEY }));
    },
  };
}

/**
 * The function's two writers: row events wait 10 s per task, the reindex
 * 120 s (its batches are large and the sweep can take a while).
 */
export function siteWriters(
  client: Meilisearch,
  indexName: string
): { event: IndexWriter; reindex: IndexWriter } {
  return {
    event: meiliWriter(client, indexName),
    reindex: meiliWriter(client, indexName, { timeoutMs: REINDEX_TIMEOUT_MS }),
  };
}
