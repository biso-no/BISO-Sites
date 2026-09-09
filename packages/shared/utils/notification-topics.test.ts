import { describe, expect, it } from "vitest";
import {
  campusSlugFor,
  GENERAL_TOPIC_ID,
  NOTIFICATION_TOPICS,
  topicIdFor,
} from "./notification-topics";

describe("campusSlugFor", () => {
  it("maps each known campus id to its slug", () => {
    expect(campusSlugFor("1")).toBe("oslo");
    expect(campusSlugFor("2")).toBe("bergen");
    expect(campusSlugFor("3")).toBe("trondheim");
    expect(campusSlugFor("4")).toBe("stavanger");
    expect(campusSlugFor("5")).toBe("national");
  });

  it("falls back to national for a missing campus, so content with no campus still reaches everyone", () => {
    expect(campusSlugFor(null)).toBe("national");
    expect(campusSlugFor(undefined)).toBe("national");
    expect(campusSlugFor("")).toBe("national");
  });

  it("falls back to national for an unrecognised campus id", () => {
    expect(campusSlugFor("99")).toBe("national");
  });
});

describe("topicIdFor", () => {
  it("builds a campus-scoped topic id", () => {
    expect(topicIdFor("events", "1")).toBe("events_oslo");
    expect(topicIdFor("news", "3")).toBe("news_trondheim");
  });

  it("builds the national id when the campus is national or absent", () => {
    expect(topicIdFor("jobs", "5")).toBe("jobs_national");
    expect(topicIdFor("shop", null)).toBe("shop_national");
  });
});

describe("the taxonomy", () => {
  it("matches the Flutter client's four logical topics", () => {
    expect([...NOTIFICATION_TOPICS]).toEqual(["news", "events", "jobs", "shop"]);
  });

  it("keeps general out of the campus-scoped set", () => {
    expect(NOTIFICATION_TOPICS).not.toContain(GENERAL_TOPIC_ID);
  });
});
