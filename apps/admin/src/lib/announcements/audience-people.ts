/**
 * The people a "users" audience names. The composer stores their ids as a
 * JSON array in `audience_value`; older drafts hold comma-separated text,
 * which may mix ids and emails. Client-safe: no server or Appwrite imports.
 */
export function parseAudiencePeople(
  value: string | null | undefined
): string[] {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  } catch {
    // Not JSON: older drafts hold a comma-separated list.
  }
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}
