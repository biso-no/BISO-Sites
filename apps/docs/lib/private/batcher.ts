import { MAX_PRIVATE_NAMES, type PrivateName } from "./registry";

/** What one `<Private>` ends up showing. */
export type PrivateResult =
  | { state: "signed-out" | "forbidden" | "unavailable" }
  | { state: "ok"; value: string };

type FetchBatch = (
  names: PrivateName[]
) => Promise<Partial<Record<PrivateName, PrivateResult>>>;

interface Waiter {
  resolve: (result: PrivateResult) => void;
}

const UNAVAILABLE: PrivateResult = { state: "unavailable" };
const FLUSH_DELAY_MS = 10;

/**
 * Collects every name asked for within a short window into one request, so a
 * page with many `<Private>` blocks makes a single call to `/api/private`
 * (more than 20 distinct names are split into several). Nothing is cached
 * across windows: each page view asks again, so a fresh sign-in is seen at once.
 */
export function createPrivateBatcher(fetchBatch: FetchBatch) {
  let waiting = new Map<PrivateName, Waiter[]>();
  let scheduled = false;

  async function send(names: PrivateName[], batch: Map<PrivateName, Waiter[]>) {
    let results: Partial<Record<PrivateName, PrivateResult>> = {};
    try {
      results = await fetchBatch(names);
    } catch {
      // Every waiter below falls back to "unavailable".
    }
    for (const name of names) {
      for (const waiter of batch.get(name) ?? []) {
        waiter.resolve(results[name] ?? UNAVAILABLE);
      }
    }
  }

  function flush() {
    const batch = waiting;
    waiting = new Map();
    scheduled = false;
    const names = [...batch.keys()];
    for (let i = 0; i < names.length; i += MAX_PRIVATE_NAMES) {
      send(names.slice(i, i + MAX_PRIVATE_NAMES), batch);
    }
  }

  return function request(name: PrivateName): Promise<PrivateResult> {
    return new Promise((resolve) => {
      const list = waiting.get(name) ?? [];
      list.push({ resolve });
      waiting.set(name, list);
      if (!scheduled) {
        scheduled = true;
        setTimeout(flush, FLUSH_DELAY_MS);
      }
    });
  };
}

/** The real transport: one GET to the route. */
export const fetchPrivateBatch: FetchBatch = async (names) => {
  const response = await fetch(
    `/api/private?names=${encodeURIComponent(names.join(","))}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    return {};
  }
  const data = (await response.json()) as {
    state?: unknown;
    values?: Record<string, unknown>;
  } | null;
  const out: Partial<Record<PrivateName, PrivateResult>> = {};
  for (const name of names) {
    out[name] = resultFor(data, name);
  }
  return out;
};

function resultFor(
  data: { state?: unknown; values?: Record<string, unknown> } | null,
  name: PrivateName
): PrivateResult {
  const state = data?.state;
  if (state === "signed-out" || state === "forbidden") {
    return { state };
  }
  if (state === "ok") {
    const value = data?.values?.[name];
    return typeof value === "string" ? { state: "ok", value } : UNAVAILABLE;
  }
  return UNAVAILABLE;
}

export const requestPrivate = createPrivateBatcher(fetchPrivateBatch);
