/**
 * In-memory sliding-window limiter. Per server instance only — enough to stop
 * a leaked guest link being used to hammer Finago, not a global quota.
 */
export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): (key: string, nowMs?: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key, nowMs = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((at) => nowMs - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    hits.set(key, recent);
    return true;
  };
}
