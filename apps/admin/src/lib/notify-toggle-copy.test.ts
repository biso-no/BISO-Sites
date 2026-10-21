import { describe, expect, test } from "bun:test";
import { defaultNotifyPush, notifyToggleCopy } from "./notify-toggle-copy";

const base = {
  canNotifyNational: false,
  isNational: false,
  isPublished: true,
};

describe("notifyToggleCopy", () => {
  test("sent: hidden toggle with the sent time in Oslo time", () => {
    const copy = notifyToggleCopy({
      ...base,
      sentAtLabel: "Mon 2 Nov at 08:00",
      state: { kind: "sent", sentAt: "2026-11-02T07:00:00.000Z" },
    });
    expect(copy).toEqual({
      description: "Sent Mon 2 Nov at 08:00.",
      disabled: false,
      showToggle: false,
      title: "Students were notified",
    });
  });

  test("sent: formats the label from sentAt when none is passed", () => {
    const copy = notifyToggleCopy({
      ...base,
      state: { kind: "sent", sentAt: "2026-11-02T07:00:00.000Z" },
    });
    expect(copy.description).toBe("Sent Mon 2 Nov at 08:00.");
  });

  test("skipped: hidden toggle", () => {
    const copy = notifyToggleCopy({ ...base, state: { kind: "skipped" } });
    expect(copy).toEqual({
      description: "This item can't send a notification.",
      disabled: false,
      showToggle: false,
      title: "Published before automatic notifications",
    });
  });

  test("pending: scheduled with cancel hint", () => {
    const copy = notifyToggleCopy({
      ...base,
      state: { dueAt: "2026-11-02T07:00:00.000Z", kind: "pending" },
    });
    expect(copy).toEqual({
      description: "Goes out Mon 2 Nov at 08:00. Untick to cancel.",
      disabled: false,
      showToggle: true,
      title: "Notification scheduled",
    });
  });

  test("published and never notified", () => {
    const copy = notifyToggleCopy({ ...base, state: { kind: "none" } });
    expect(copy).toEqual({
      description:
        "Sends one notification to students who follow this topic, a few minutes after you save.",
      disabled: false,
      showToggle: true,
      title: "Notify students now",
    });
  });

  test("cancelled and published behaves like never notified", () => {
    const copy = notifyToggleCopy({ ...base, state: { kind: "cancelled" } });
    expect(copy.title).toBe("Notify students now");
    expect(copy.showToggle).toBe(true);
  });

  test("not published", () => {
    const copy = notifyToggleCopy({
      ...base,
      isPublished: false,
      state: { kind: "none" },
    });
    expect(copy).toEqual({
      description:
        "Students who follow this topic get one notification when it goes live.",
      disabled: false,
      showToggle: true,
      title: "Notify students when published",
    });
  });

  test("national without national rights is disabled with explanation", () => {
    const copy = notifyToggleCopy({
      ...base,
      isNational: true,
      state: { kind: "none" },
    });
    expect(copy).toEqual({
      description: "Only national admins can notify every student.",
      disabled: true,
      showToggle: true,
      title: "Notify students now",
    });
  });

  test("national with national rights is a normal toggle", () => {
    const copy = notifyToggleCopy({
      ...base,
      canNotifyNational: true,
      isNational: true,
      isPublished: false,
      state: { kind: "none" },
    });
    expect(copy.disabled).toBe(false);
    expect(copy.title).toBe("Notify students when published");
  });
});

describe("defaultNotifyPush", () => {
  test("new items default to true, existing keep their stored value", () => {
    expect(defaultNotifyPush(undefined, true)).toBe(true);
    expect(defaultNotifyPush(false, false)).toBe(false);
    expect(defaultNotifyPush(true, false)).toBe(true);
    expect(defaultNotifyPush(null, false)).toBe(false);
  });
});
