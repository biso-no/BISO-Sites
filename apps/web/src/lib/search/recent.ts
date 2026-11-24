const KEY = "biso.search.recent";
const MAX_RECENT = 5;

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberSearch(q: string): void {
  const value = q.trim();
  if (!value) {
    return;
  }
  const lower = value.toLowerCase();
  const next = [
    value,
    ...readRecentSearches().filter((item) => item.toLowerCase() !== lower),
  ].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: recent searches are a convenience only.
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked.
  }
}
