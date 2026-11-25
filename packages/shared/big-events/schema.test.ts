import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BIG_EVENT_STATUSES,
  BIG_EVENT_TABLES,
  DELIVERY_CHANNELS,
  DELIVERY_KINDS,
  DELIVERY_STATUSES,
  GROUP_KINDS,
  GROUP_LEGS,
  LINK_METHODS,
  MESSAGE_KINDS,
  MESSAGE_STATUSES,
  SUGGESTION_REASONS,
} from "./tables";

interface ConfigColumn {
  elements?: string[];
  key: string;
}
interface ConfigIndex {
  columns: string[];
  type: string;
}
interface ConfigTable {
  $id: string;
  $permissions: string[];
  columns: ConfigColumn[];
  databaseId: string;
  indexes: ConfigIndex[];
  rowSecurity: boolean;
}

const config = JSON.parse(
  readFileSync(
    new URL("../../api/appwrite.config.json", import.meta.url),
    "utf8"
  )
) as { tables: ConfigTable[] };

const table = (id: string): ConfigTable => {
  const found = config.tables.find((t) => t.$id === id);
  if (!found) {
    throw new Error(`Missing table ${id}`);
  }
  return found;
};

const elements = (tableId: string, key: string) =>
  table(tableId).columns.find((c) => c.key === key)?.elements;

const EXPECTED_COLUMNS: Record<string, string[]> = {
  big_events: [
    "name_no",
    "name_en",
    "slug",
    "campus_id",
    "department_id",
    "starts_at",
    "ends_at",
    "place_name",
    "place_address",
    "hero_image_url",
    "status",
    "travel_enabled",
    "group_checkin_enabled",
    "created_by",
    "bus_lists_published_at",
    "bus_lists_published_by",
    "auto_bus_assigned",
    "auto_bus_moved",
    "auto_departure_reminder",
    "auto_texts",
  ],
  big_event_participants: [
    "big_event_id",
    "first_name",
    "last_name",
    "ticket_email",
    "phone",
    "campus_id",
    "ticket_ref",
    "ticket_category",
    "room_size",
    "last_import_id",
    "user_id",
    "linked_at",
    "link_method",
    "connect_nonce",
    "connect_token_hash",
    "connect_sent_at",
    "connect_reminded_at",
    "membership_valid",
    "membership_checked_at",
    "suggested_user_id",
    "suggested_reason",
    "dismissed_user_id",
    "bus_notice_due_at",
    "bus_notified_at",
  ],
  big_event_groups: [
    "big_event_id",
    "kind",
    "name",
    "campus_id",
    "capacity",
    "contact_name",
    "contact_phone",
    "contact_user_id",
    "note",
    "room_number",
    "source_key",
    "booking_participant_id",
    "out_departs_at",
    "out_meeting_point",
    "out_maps_url",
    "home_departs_at",
    "home_meeting_point",
    "home_maps_url",
    "home_arrival_note",
    "out_bus_id",
    "home_bus_id",
    "out_reminder_sent_at",
    "home_reminder_sent_at",
  ],
  big_event_group_members: [
    "big_event_id",
    "group_id",
    "participant_id",
    "leg",
    "pinned",
    "assigned_at",
  ],
  big_event_deliveries: [
    "big_event_id",
    "kind",
    "channel",
    "to_address",
    "participant_ids",
    "message_id",
    "status",
    "attempts",
    "last_error",
    "claimed_by",
    "claimed_at",
    "sent_at",
    "scheduled_for",
  ],
  big_event_messages: [
    "big_event_id",
    "kind",
    "status",
    "title_no",
    "title_en",
    "body_no",
    "body_en",
    "audience",
    "campus_ids",
    "leg",
    "important",
    "pinned",
    "also_sms",
    "scheduled_at",
    "sent_at",
    "created_by",
    "recipients",
    "push_count",
    "email_count",
    "sms_count",
    "failed_count",
  ],
  big_event_message_recipients: [
    "big_event_id",
    "message_id",
    "participant_id",
    "user_id",
    "vars",
    "push",
    "email",
    "sms",
    "pushed_at",
  ],
};

describe("big events schema", () => {
  it("defines every big event table service-only", () => {
    for (const id of Object.values(BIG_EVENT_TABLES)) {
      const t = table(id);
      expect(t.databaseId, id).toBe("app");
      expect(t.$permissions, id).toEqual([]);
      expect(t.rowSecurity, id).toBe(false);
    }
  });

  it("matches the enum lists", () => {
    expect(elements("big_events", "status")).toEqual([...BIG_EVENT_STATUSES]);
    expect(elements("big_event_groups", "kind")).toEqual([...GROUP_KINDS]);
    expect(elements("big_event_participants", "link_method")).toEqual([
      ...LINK_METHODS,
    ]);
    expect(elements("big_event_deliveries", "kind")).toEqual([
      ...DELIVERY_KINDS,
    ]);
    expect(elements("big_event_deliveries", "channel")).toEqual([
      ...DELIVERY_CHANNELS,
    ]);
    expect(elements("big_event_deliveries", "status")).toEqual([
      ...DELIVERY_STATUSES,
    ]);
    expect(elements("big_event_messages", "kind")).toEqual([...MESSAGE_KINDS]);
    expect(elements("big_event_messages", "status")).toEqual([
      ...MESSAGE_STATUSES,
    ]);
    expect(elements("big_event_messages", "leg")).toEqual([...GROUP_LEGS]);
    expect(elements("big_event_group_members", "leg")).toEqual([...GROUP_LEGS]);
    expect(elements("big_event_participants", "suggested_reason")).toEqual([
      ...SUGGESTION_REASONS,
    ]);
  });

  it("has the columns the row types use", () => {
    for (const [id, keys] of Object.entries(EXPECTED_COLUMNS)) {
      expect(new Set(table(id).columns.map((c) => c.key)), id).toEqual(
        new Set(keys)
      );
    }
  });

  it("indexes slug uniquely", () => {
    expect(
      table("big_events").indexes.some(
        (i) => i.type === "unique" && i.columns.join() === "slug"
      )
    ).toBe(true);
  });
});
