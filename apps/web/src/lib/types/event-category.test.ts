import { EventsCategory } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import {
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_MESSAGE_KEYS,
  resolveEventCategory,
} from "./event";

describe("resolveEventCategory", () => {
  it("reads the real column", () => {
    expect(resolveEventCategory({ category: EventsCategory.CAREER })).toBe(
      "career"
    );
  });

  it("returns null for an uncategorised event instead of defaulting", () => {
    // The old getEventCategory() defaulted to "Social", which is why every
    // event on the live site rendered as Social.
    expect(resolveEventCategory({ category: null })).toBeNull();
    expect(resolveEventCategory({})).toBeNull();
  });

  it("has a message key for every enum value", () => {
    for (const value of Object.values(EventsCategory)) {
      expect(EVENT_CATEGORY_MESSAGE_KEYS[value]).toBeTruthy();
    }
  });

  it("has a colour for every enum value", () => {
    for (const value of Object.values(EventsCategory)) {
      expect(EVENT_CATEGORY_COLORS[value]).toBeTruthy();
    }
  });
});
