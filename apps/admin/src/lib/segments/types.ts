// Local row types for the event "segments" (Logistics) collections.
//
// `packages/api/types/appwrite.ts` is auto-generated and cannot be regenerated
// in this environment, so the `event_segments`, `segment_members`, and
// `event_attendees` collections are typed here by hand. These mirror the
// generated style (each row extends `Models.Row`) so `db.listRows<T>(...)` and
// `db.getRow<T>(...)` type-check.
//
// The generated types import `Models` from "appwrite" — match that here.
import type { Models } from "appwrite";

export type EventSegments = Models.Row & {
  event_id: string | null;
  kind: string | null;
  name: string;
  campus_id: string | null;
  capacity: number;
  // JSON string holding free-form logistics fields (departure_time,
  // pickup_location, hotel, room_number, schedule, notes, …).
  metadata: string | null;
  topic_id: string | null;
};

export type SegmentMembers = Models.Row & {
  segment_id: string;
  event_id: string | null;
  user_id: string;
  attendee_id: string | null;
  assigned_at: string | null;
};

export type EventAttendees = Models.Row & {
  event_id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  ticket_type: string | null;
  order_ref: string | null;
  source: string | null;
  matched_user_id: string | null;
  campus_id: string | null;
};

/**
 * Structured logistics metadata. Stored as a JSON string in the
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
