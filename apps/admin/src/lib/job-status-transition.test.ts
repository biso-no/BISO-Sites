import { describe, expect, test } from "bun:test";
import {
  publishDeadlineWarning,
  saveDraftConfirmMessage,
} from "./job-status-transition";

const NOW = new Date("2026-10-29T12:00:00.000Z");

describe("saveDraftConfirmMessage", () => {
  test("a live vacancy is told it goes offline", () => {
    expect(saveDraftConfirmMessage("published")).toContain("takes it offline");
  });

  test("a closed vacancy is told it stays offline and becomes a draft", () => {
    const message = saveDraftConfirmMessage("closed");
    expect(message).toContain("keeps it offline");
    expect(message).toContain("draft");
  });

  test("a draft needs no confirmation", () => {
    expect(saveDraftConfirmMessage("draft")).toBeNull();
    expect(saveDraftConfirmMessage(undefined)).toBeNull();
  });
});

describe("publishDeadlineWarning", () => {
  test("warns when a closed vacancy's deadline has passed", () => {
    expect(
      publishDeadlineWarning({
        applicationDeadline: "2026-10-01T00:00:00.000Z",
        currentStatus: "closed",
        now: NOW,
      })
    ).toContain("deadline has passed");
  });

  test("stays quiet for a future deadline, no deadline, or a non-closed vacancy", () => {
    expect(
      publishDeadlineWarning({
        applicationDeadline: "2026-12-01T00:00:00.000Z",
        currentStatus: "closed",
        now: NOW,
      })
    ).toBeNull();
    expect(
      publishDeadlineWarning({
        applicationDeadline: null,
        currentStatus: "closed",
        now: NOW,
      })
    ).toBeNull();
    expect(
      publishDeadlineWarning({
        applicationDeadline: "2026-10-01T00:00:00.000Z",
        currentStatus: "draft",
        now: NOW,
      })
    ).toBeNull();
  });
});
