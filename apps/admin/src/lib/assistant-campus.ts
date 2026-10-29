/**
 * The campus an assistant create shows on its confirm card and the campus the
 * route writes: the confirmed campus, then the payload's `campus_id`, then its
 * `campusId` alias. Blank values are skipped and the kept value is trimmed;
 * a number counts as an id. Plain module so the card (client) and the route
 * (server) share one rule.
 */
export function resolveConfirmedCampusId(
  confirmedCampusId: unknown,
  payload: Record<string, unknown>
): string | null {
  for (const value of [
    confirmedCampusId,
    payload.campus_id,
    payload.campusId,
  ]) {
    const id = campusIdOf(value);
    if (id) {
      return id;
    }
  }
  return null;
}

function campusIdOf(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}
