import { describe, expect, test } from "bun:test";
import {
  type ContentNotifications,
  ContentNotificationsStatus,
} from "@repo/api/types/appwrite";
import { toNotificationState } from "./content-notification-state";

function lock(overrides: Partial<ContentNotifications>): ContentNotifications {
  return {
    $updatedAt: "2026-10-01T10:00:00.000Z",
    announcement_id: null,
    due_at: null,
    sent_at: null,
    status: ContentNotificationsStatus.PENDING,
    ...overrides,
  } as unknown as ContentNotifications;
}

describe("toNotificationState", () => {
  test("no lock means none", () => {
    expect(toNotificationState(null)).toEqual({ kind: "none" });
  });

  test("pending carries dueAt", () => {
    expect(
      toNotificationState(
        lock({
          due_at: "2026-10-02T08:00:00.000Z",
          status: ContentNotificationsStatus.PENDING,
        })
      )
    ).toEqual({ dueAt: "2026-10-02T08:00:00.000Z", kind: "pending" });
  });

  test("sent carries sentAt", () => {
    expect(
      toNotificationState(
        lock({
          sent_at: "2026-10-02T08:01:00.000Z",
          status: ContentNotificationsStatus.SENT,
        })
      )
    ).toEqual({ kind: "sent", sentAt: "2026-10-02T08:01:00.000Z" });
  });

  test("skipped and cancelled map directly", () => {
    expect(
      toNotificationState(lock({ status: ContentNotificationsStatus.SKIPPED }))
    ).toEqual({
      kind: "skipped",
    });
    expect(
      toNotificationState(
        lock({ status: ContentNotificationsStatus.CANCELLED })
      )
    ).toEqual({
      kind: "cancelled",
    });
  });

  test("a lock with sent_at is sent even when status says cancelled", () => {
    expect(
      toNotificationState(
        lock({
          sent_at: "2026-10-02T08:01:00.000Z",
          status: ContentNotificationsStatus.CANCELLED,
        })
      )
    ).toEqual({ kind: "sent", sentAt: "2026-10-02T08:01:00.000Z" });
  });

  test("a lock with announcement_id is sent and falls back to $updatedAt", () => {
    expect(
      toNotificationState(
        lock({
          announcement_id: "ann-1",
          sent_at: null,
          status: ContentNotificationsStatus.PENDING,
        })
      )
    ).toEqual({ kind: "sent", sentAt: "2026-10-01T10:00:00.000Z" });
  });
});
