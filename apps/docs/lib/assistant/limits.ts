const VISITOR_LIMIT = 8;
const VISITOR_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_DAILY_LIMIT = 400;
// Keys come from the client, so the map is pruned and has a hard size cap.
const PRUNE_ABOVE = 1000;
const PRUNE_EVERY_MS = 1000;
const MAX_VISITORS = 10_000;

// Per server instance, in memory. Enough to stop a free chatbot, not a quota.
const hits = new Map<string, number[]>();
let lastPrune = 0;

let dailyDay = "";
let dailyCount = 0;

function dailyLimit(): number {
  const parsed = Number(process.env.DOCS_ASSISTANT_DAILY_LIMIT);
  return process.env.DOCS_ASSISTANT_DAILY_LIMIT && Number.isFinite(parsed)
    ? parsed
    : DEFAULT_DAILY_LIMIT;
}

function prune(nowMs: number): void {
  lastPrune = nowMs;
  for (const [key, times] of hits) {
    const newest = times.at(-1) ?? 0;
    if (nowMs - newest >= VISITOR_WINDOW_MS) {
      hits.delete(key);
    }
  }
}

function admitVisitor(key: string, nowMs: number): boolean {
  const known = hits.get(key);
  if (
    !known &&
    hits.size >= PRUNE_ABOVE &&
    nowMs - lastPrune >= PRUNE_EVERY_MS
  ) {
    prune(nowMs);
  }
  if (!known && hits.size >= MAX_VISITORS) {
    return false;
  }
  const recent = (known ?? []).filter((at) => nowMs - at < VISITOR_WINDOW_MS);
  if (recent.length >= VISITOR_LIMIT) {
    hits.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  hits.set(key, recent);
  return true;
}

/** Number of visitor keys held. For tests. */
export function trackedVisitors(): number {
  return hits.size;
}

export function checkLimits(
  visitorKey: string,
  nowMs: number = Date.now()
): "ok" | "visitor" | "daily" {
  // The day is counted in UTC. The counter resets when the date changes.
  const day = new Date(nowMs).toISOString().slice(0, 10);
  if (day !== dailyDay) {
    dailyDay = day;
    dailyCount = 0;
  }
  // Daily first: a refused request stores nothing in the visitor map.
  if (dailyCount >= dailyLimit()) {
    return "daily";
  }
  if (!admitVisitor(visitorKey, nowMs)) {
    return "visitor";
  }
  dailyCount += 1;
  return "ok";
}
