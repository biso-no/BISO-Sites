import { describe, expect, test } from "bun:test";
import { pushRecent, type RecentEntry } from "./recents";

const entry = (href: string, visitedAt = 0): RecentEntry => ({
  href,
  label: href,
  visitedAt,
});

describe("pushRecent", () => {
  test("newest entry goes first", () => {
    const next = pushRecent([entry("/a")], entry("/b", 1));
    expect(next.map((e) => e.href)).toEqual(["/b", "/a"]);
  });

  test("revisiting moves the entry to the front without duplicating", () => {
    const next = pushRecent([entry("/a"), entry("/b")], entry("/b", 2));
    expect(next.map((e) => e.href)).toEqual(["/b", "/a"]);
  });

  test("caps the list at 5 entries", () => {
    const list = ["/1", "/2", "/3", "/4", "/5"].map((h) => entry(h));
    const next = pushRecent(list, entry("/6", 9));
    expect(next).toHaveLength(5);
    expect(next[0]?.href).toBe("/6");
    expect(next.map((e) => e.href)).not.toContain("/5");
  });
});
