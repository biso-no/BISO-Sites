import { describe, expect, it } from "vitest";
import {
  ALL_PUSH_TOPIC_IDS,
  broadcastChannelFor,
  campusSlugFor,
  GENERAL_TOPIC_ID,
  isNotificationTopic,
  localizedTopicId,
  logicalTopicFor,
  NOTIFICATION_TOPICS,
  resolveAnnouncementTopicId,
  resolvePushChannel,
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

describe("isNotificationTopic", () => {
  it("accepts each of the four logical topics", () => {
    expect(isNotificationTopic("news")).toBe(true);
    expect(isNotificationTopic("events")).toBe(true);
    expect(isNotificationTopic("jobs")).toBe(true);
    expect(isNotificationTopic("shop")).toBe(true);
  });

  it("rejects the retired 'products' alias", () => {
    expect(isNotificationTopic("products")).toBe(false);
  });

  it("rejects 'general' - every device subscribes to it, but it isn't a topic a student opts into", () => {
    expect(isNotificationTopic("general")).toBe(false);
  });

  it("rejects an already campus-scoped topic id", () => {
    expect(isNotificationTopic("events_oslo")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isNotificationTopic("")).toBe(false);
  });
});

describe("logicalTopicFor", () => {
  it("strips a campus suffix from a known topic prefix", () => {
    expect(logicalTopicFor("events_oslo")).toBe("events");
    expect(logicalTopicFor("shop_national")).toBe("shop");
  });

  it("leaves a bare logical topic unchanged", () => {
    expect(logicalTopicFor("events")).toBe("events");
  });

  it("leaves 'general' unchanged - it has no topic prefix to strip", () => {
    expect(logicalTopicFor("general")).toBe("general");
  });

  it("leaves an unrelated string unchanged", () => {
    expect(logicalTopicFor("segment-123")).toBe("segment-123");
  });
});

describe("the taxonomy", () => {
  it("matches the Flutter client's four logical topics", () => {
    expect([...NOTIFICATION_TOPICS]).toEqual([
      "news",
      "events",
      "jobs",
      "shop",
    ]);
  });

  it("keeps general out of the campus-scoped set", () => {
    expect(NOTIFICATION_TOPICS).not.toContain(GENERAL_TOPIC_ID);
  });
});

describe("resolveAnnouncementTopicId", () => {
  it("resolves an empty audience value to the general topic", () => {
    expect(resolveAnnouncementTopicId("", "1")).toBe("general");
    expect(resolveAnnouncementTopicId(null, "1")).toBe("general");
    expect(resolveAnnouncementTopicId(undefined, "1")).toBe("general");
  });

  it("resolves a whitespace-only audience value to the general topic", () => {
    expect(resolveAnnouncementTopicId("   ", "1")).toBe("general");
  });

  it("expands a logical topic to its campus-scoped id", () => {
    expect(resolveAnnouncementTopicId("events", "1")).toBe("events_oslo");
  });

  it("falls back to the national scope when the campus is null - campus-less content reaches every campus's subscribers", () => {
    expect(resolveAnnouncementTopicId("events", null)).toBe("events_national");
  });

  it("maps the retired 'products' alias to the 'shop' topic", () => {
    expect(resolveAnnouncementTopicId("products", "2")).toBe("shop_bergen");
  });

  it("passes an already campus-scoped topic id through unchanged, regardless of the announcement's campus", () => {
    expect(resolveAnnouncementTopicId("events_oslo", "2")).toBe("events_oslo");
    expect(resolveAnnouncementTopicId("events_oslo", null)).toBe("events_oslo");
  });

  it("passes 'general' through unchanged", () => {
    expect(resolveAnnouncementTopicId("general", "1")).toBe("general");
  });
});

describe("localizedTopicId", () => {
  it("appends the language", () => {
    expect(localizedTopicId("events_bergen", "no")).toBe("events_bergen_no");
    expect(localizedTopicId("general", "en")).toBe("general_en");
  });
});

describe("broadcastChannelFor", () => {
  it("scopes to a real campus", () => {
    expect(broadcastChannelFor("1")).toBe("general_oslo");
    expect(broadcastChannelFor("4")).toBe("general_stavanger");
  });
  it("means everyone for National, no campus or an unknown campus", () => {
    expect(broadcastChannelFor("5")).toBe("general");
    expect(broadcastChannelFor(null)).toBe("general");
    expect(broadcastChannelFor("")).toBe("general");
    expect(broadcastChannelFor("99")).toBe("general");
  });
});

describe("resolvePushChannel", () => {
  it("resolves topic and broadcast audiences, not people", () => {
    expect(resolvePushChannel("topic", "events", "2")).toBe("events_bergen");
    expect(resolvePushChannel("broadcast", null, "2")).toBe("general_bergen");
    expect(resolvePushChannel("broadcast", null, "5")).toBe("general");
    expect(resolvePushChannel("users", '["u1"]', "2")).toBeNull();
    expect(resolvePushChannel("segment", "seg1", "2")).toBeNull();
  });
});

describe("ALL_PUSH_TOPIC_IDS", () => {
  it("lists exactly the 50 language channels", () => {
    expect(ALL_PUSH_TOPIC_IDS).toHaveLength(50);
    expect(new Set(ALL_PUSH_TOPIC_IDS).size).toBe(50);
    expect(ALL_PUSH_TOPIC_IDS).toContain("general_no");
    expect(ALL_PUSH_TOPIC_IDS).toContain("general_oslo_en");
    expect(ALL_PUSH_TOPIC_IDS).toContain("events_national_en");
    expect(ALL_PUSH_TOPIC_IDS).toContain("shop_stavanger_no");
    expect(ALL_PUSH_TOPIC_IDS).not.toContain("general_national_no");
  });
  it("is exactly this list, in a form to diff against the Flutter mirror", () => {
    expect([...ALL_PUSH_TOPIC_IDS].sort()).toEqual(
      [
        "events_bergen_en",
        "events_bergen_no",
        "events_national_en",
        "events_national_no",
        "events_oslo_en",
        "events_oslo_no",
        "events_stavanger_en",
        "events_stavanger_no",
        "events_trondheim_en",
        "events_trondheim_no",
        "general_bergen_en",
        "general_bergen_no",
        "general_en",
        "general_no",
        "general_oslo_en",
        "general_oslo_no",
        "general_stavanger_en",
        "general_stavanger_no",
        "general_trondheim_en",
        "general_trondheim_no",
        "jobs_bergen_en",
        "jobs_bergen_no",
        "jobs_national_en",
        "jobs_national_no",
        "jobs_oslo_en",
        "jobs_oslo_no",
        "jobs_stavanger_en",
        "jobs_stavanger_no",
        "jobs_trondheim_en",
        "jobs_trondheim_no",
        "news_bergen_en",
        "news_bergen_no",
        "news_national_en",
        "news_national_no",
        "news_oslo_en",
        "news_oslo_no",
        "news_stavanger_en",
        "news_stavanger_no",
        "news_trondheim_en",
        "news_trondheim_no",
        "shop_bergen_en",
        "shop_bergen_no",
        "shop_national_en",
        "shop_national_no",
        "shop_oslo_en",
        "shop_oslo_no",
        "shop_stavanger_en",
        "shop_stavanger_no",
        "shop_trondheim_en",
        "shop_trondheim_no",
      ].sort()
    );
  });
  it("fits Appwrite's 36-character id limit", () => {
    for (const id of ALL_PUSH_TOPIC_IDS) {
      expect(id.length).toBeLessThanOrEqual(36);
    }
  });
});
