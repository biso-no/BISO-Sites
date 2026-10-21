import { describe, expect, test } from "bun:test";
import {
  CAMPUS_IDS,
  campusIdForName,
  campusIdForSlug,
  campusNameFor,
  isNationalOrUnset,
  peopleCount,
  phoneCount,
  TOPIC_OPTIONS,
  topicNameFor,
} from "./audience-names";

describe("campus names", () => {
  test("id to name and back", () => {
    expect(campusNameFor("2")).toBe("Bergen");
    expect(campusNameFor("5")).toBe("National");
    expect(campusNameFor(null)).toBe("");
    expect(campusNameFor("99")).toBe("");
    expect(campusIdForName("Trondheim")).toBe("3");
    expect(campusIdForName("National")).toBe("5");
    expect(campusIdForName("")).toBeNull();
  });

  test("a channel slug names its campus", () => {
    expect(campusIdForSlug("oslo")).toBe("1");
    expect(campusIdForSlug("stavanger")).toBe("4");
    expect(campusIdForSlug("national")).toBe("5");
    expect(campusIdForSlug("nowhere")).toBeUndefined();
  });

  test("the real campuses, without National", () => {
    expect([...CAMPUS_IDS]).toEqual(["1", "2", "3", "4"]);
    expect(isNationalOrUnset("5")).toBe(true);
    expect(isNationalOrUnset(null)).toBe(true);
    expect(isNationalOrUnset("2")).toBe(false);
  });
});

describe("topic names", () => {
  test("the four topics, in pill order", () => {
    expect(TOPIC_OPTIONS).toEqual([
      { label: "News", value: "news" },
      { label: "Events", value: "events" },
      { label: "Jobs", value: "jobs" },
      { label: "Shop", value: "shop" },
    ]);
  });

  test("a logical topic, a channel or a language channel", () => {
    expect(topicNameFor("events")).toBe("Events");
    expect(topicNameFor("events_oslo")).toBe("Events");
    expect(topicNameFor("jobs_national_en")).toBe("Jobs");
  });

  test("the legacy products alias reads as Shop", () => {
    expect(topicNameFor("products")).toBe("Shop");
    expect(topicNameFor("products_oslo")).toBe("Shop");
  });
});

describe("counts", () => {
  test("one is singular", () => {
    expect(peopleCount(1)).toBe("1 person");
    expect(peopleCount(0)).toBe("0 people");
    expect(peopleCount(3)).toBe("3 people");
    expect(phoneCount(1)).toBe("1 phone");
    expect(phoneCount(412)).toBe("412 phones");
  });
});
