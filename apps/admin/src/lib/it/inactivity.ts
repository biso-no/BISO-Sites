import type { M365UserListItem } from "@repo/shared/types/user-management";

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30; // approximate — fine for a multi-month threshold

function parseMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// Effective last-activity timestamp (ms) for a user, or null if unknown.
// Uses the MOST RECENT of all sign-in signals — interactive, non-interactive,
// and last-successful — because lastSignInDateTime alone misses client
// (Outlook/Teams) access and would flag actively-used accounts. Only when no
// sign-in data exists at all does it fall back to account creation, so
// never-signed-in old accounts are still caught while brand-new ones are not.
export function lastActivityMs(user: M365UserListItem): number | null {
  const signInTimes = [
    parseMs(user.lastSignInDateTime),
    parseMs(user.lastNonInteractiveSignInDateTime),
    parseMs(user.lastSuccessfulSignInDateTime),
  ].filter((ms): ms is number => ms !== null);

  if (signInTimes.length > 0) {
    return Math.max(...signInTimes);
  }
  return parseMs(user.createdDateTime);
}

export function isInactive(
  user: M365UserListItem,
  nowMs: number,
  months: number
): boolean {
  if (user.accountEnabled === false) {
    return false; // already disabled — not a deactivation target
  }
  const last = lastActivityMs(user);
  if (last === null) {
    return false; // insufficient data — don't flag
  }
  const cutoff = nowMs - months * DAYS_PER_MONTH * MS_PER_DAY;
  return last < cutoff;
}

// All inactive accounts, oldest activity first (most stale at the top).
export function findInactiveAccounts(
  users: M365UserListItem[],
  nowMs: number,
  months: number
): M365UserListItem[] {
  return users
    .filter((user) => isInactive(user, nowMs, months))
    .sort((a, b) => (lastActivityMs(a) ?? 0) - (lastActivityMs(b) ?? 0));
}
