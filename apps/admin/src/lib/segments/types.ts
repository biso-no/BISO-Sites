// Logistics metadata helpers for event segments.
//
// Row types (`EventSegments`, `SegmentMembers`, `EventAttendees`) now live in
// the generated `@repo/api/types/appwrite`. This module only keeps the
// structured-metadata helper, since `event_segments.metadata` is stored as a
// free-form JSON string that the generated types expose as `string | null`.

/**
 * Structured logistics metadata stored as a JSON string in the
 * `event_segments.metadata` column. All fields optional/free-form.
 */
export interface SegmentMetadata {
  departure_time?: string | null;
  hotel?: string | null;
  notes?: string | null;
  pickup_location?: string | null;
  room_number?: string | null;
  schedule?: string | null;
}

export function parseSegmentMetadata(value: string | null): SegmentMetadata {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as SegmentMetadata;
    }
  } catch {
    // Not JSON — treat the raw string as free-form notes.
    return { notes: value };
  }
  return {};
}
