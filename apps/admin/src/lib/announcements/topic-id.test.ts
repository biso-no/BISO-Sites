import { describe, expect, test } from "bun:test";
import { resolveAnnouncementTopicId } from "./topic-id";

describe("resolveAnnouncementTopicId", () => {
  test("resolves an empty audience value to the general topic", () => {
    expect(resolveAnnouncementTopicId("", "1")).toBe("general");
    expect(resolveAnnouncementTopicId(null, "1")).toBe("general");
    expect(resolveAnnouncementTopicId(undefined, "1")).toBe("general");
  });

  test("resolves a whitespace-only audience value to the general topic", () => {
    expect(resolveAnnouncementTopicId("   ", "1")).toBe("general");
  });

  test("expands a logical topic to its campus-scoped id", () => {
    expect(resolveAnnouncementTopicId("events", "1")).toBe("events_oslo");
  });

  test("falls back to the national scope when the campus is null - campus-less content reaches every campus's subscribers", () => {
    expect(resolveAnnouncementTopicId("events", null)).toBe("events_national");
  });

  test("maps the retired 'products' alias to the 'shop' topic", () => {
    expect(resolveAnnouncementTopicId("products", "2")).toBe("shop_bergen");
  });

  test("passes an already campus-scoped topic id through unchanged, regardless of the announcement's campus", () => {
    expect(resolveAnnouncementTopicId("events_oslo", "2")).toBe("events_oslo");
    expect(resolveAnnouncementTopicId("events_oslo", null)).toBe(
      "events_oslo"
    );
  });

  test("passes 'general' through unchanged", () => {
    expect(resolveAnnouncementTopicId("general", "1")).toBe("general");
  });
});
