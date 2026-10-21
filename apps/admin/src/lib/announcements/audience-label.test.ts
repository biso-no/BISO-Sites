import { describe, expect, test } from "bun:test";
import { audienceLabel } from "./audience-label";

const label = (
  audience_type: string,
  audience_value: string | null,
  campus_id: string | null,
  segmentName?: string
) => audienceLabel({ audience_type, audience_value, campus_id }, segmentName);

describe("audienceLabel", () => {
  test("broadcast to a campus", () => {
    expect(label("broadcast", null, "1")).toBe("Everyone at Oslo");
    expect(label("broadcast", null, "4")).toBe("Everyone at Stavanger");
  });

  test("broadcast to all campuses", () => {
    expect(label("broadcast", null, null)).toBe("Everyone (all campuses)");
    expect(label("broadcast", null, "5")).toBe("Everyone (all campuses)");
    expect(label("broadcast", "general", null)).toBe("Everyone (all campuses)");
    expect(label("broadcast", "general_national", "1")).toBe(
      "Everyone (all campuses)"
    );
  });

  test("a stored general_bergen broadcast", () => {
    expect(label("broadcast", "general_bergen", null)).toBe(
      "Everyone at Bergen"
    );
    expect(label("broadcast", "general_bergen_no", "1")).toBe(
      "Everyone at Bergen"
    );
  });

  test("topic with a campus", () => {
    expect(label("topic", "events", "3")).toBe("Events · Trondheim");
  });

  test("topic for all campuses", () => {
    expect(label("topic", "events_national", "1")).toBe(
      "Events · all campuses"
    );
    expect(label("topic", "jobs", null)).toBe("Jobs · all campuses");
    expect(label("topic", "shop", "5")).toBe("Shop · all campuses");
  });

  test("stored topic channel, with and without language suffix", () => {
    expect(label("topic", "news_oslo", null)).toBe("News · Oslo");
    expect(label("topic", "news_oslo_en", "2")).toBe("News · Oslo");
  });

  test("the legacy products topic reads as Shop", () => {
    expect(label("topic", "products", "2")).toBe("Shop · Bergen");
    expect(label("topic", "products_oslo", null)).toBe("Shop · Oslo");
  });

  test("users as a count, JSON or legacy comma text", () => {
    expect(label("users", '["a","b","c"]', null)).toBe("3 people");
    expect(label("users", "a, b", null)).toBe("2 people");
    expect(label("users", null, null)).toBe("0 people");
  });

  test("one person is singular", () => {
    expect(label("users", '["a"]', null)).toBe("1 person");
  });

  test("segment with and without a known name", () => {
    expect(label("segment", "seg-1", null, "Board")).toBe("Group: Board");
    expect(label("segment", "seg-1", null)).toBe("Group");
  });
});
