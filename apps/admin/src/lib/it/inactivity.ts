import type { M365UserListItem } from "@repo/shared/types/user-management";

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30; // approximate — fine for a multi-month threshold

// Effective last-activity timestamp (ms) for a user, or null if unknown.
// Prefers last sign-in; falls back to account creation so never-signed-in but
// old accounts are still caught, while brand-new never-signed-in ones are not.
export function lastActivityMs(user: M365UserListItem): number | null {
  const source = user.lastSignInDateTime ?? user.createdDateTime;
  if (!source) {
    return null;
  }
  const parsed = Date.parse(source);
  return Number.isNaN(parsed) ? null : parsed;
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
