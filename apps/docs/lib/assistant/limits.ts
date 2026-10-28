import { createRateLimiter } from "@repo/shared/member-pass/rate-limit";

const VISITOR_LIMIT = 8;
const VISITOR_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_DAILY_LIMIT = 400;

// Per server instance, in memory. Enough to stop a free chatbot, not a quota.
const visitorLimiter = createRateLimiter({
  limit: VISITOR_LIMIT,
  windowMs: VISITOR_WINDOW_MS,
});

let dailyDay = "";
let dailyCount = 0;

function dailyLimit(): number {
  const parsed = Number(process.env.DOCS_ASSISTANT_DAILY_LIMIT);
  return process.env.DOCS_ASSISTANT_DAILY_LIMIT && Number.isFinite(parsed)
    ? parsed
    : DEFAULT_DAILY_LIMIT;
}

export function checkLimits(
  visitorKey: string,
  nowMs: number = Date.now()
): "ok" | "visitor" | "daily" {
  if (!visitorLimiter(visitorKey, nowMs)) {
    return "visitor";
  }
  // The day is counted in UTC. The counter resets when the date changes.
  const day = new Date(nowMs).toISOString().slice(0, 10);
  if (day !== dailyDay) {
    dailyDay = day;
    dailyCount = 0;
  }
  if (dailyCount >= dailyLimit()) {
    return "daily";
  }
  dailyCount += 1;
  return "ok";
}
