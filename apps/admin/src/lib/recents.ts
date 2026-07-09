export interface RecentEntry {
  href: string;
  label: string;
  visitedAt: number;
}

const STORAGE_KEY = "biso-admin:recents";
const MAX_RECENTS = 5;

export function pushRecent(
  list: RecentEntry[],
  entry: RecentEntry
): RecentEntry[] {
  const next = [entry, ...list.filter((item) => item.href !== entry.href)];
  return next.slice(0, MAX_RECENTS);
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.href === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.visitedAt === "number"
  );
}

export function readRecents(): RecentEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecentEntry).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function recordRecent(entry: { href: string; label: string }): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const next = pushRecent(readRecents(), { ...entry, visitedAt: Date.now() });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode/quota) — recents are best-effort
  }
}
