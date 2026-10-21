import { describe, expect, test } from "bun:test";
import { storedLinkFrom } from "./link-state";

describe("storedLinkFrom", () => {
  const items = JSON.stringify([
    {
      campus_id: "2",
      date: null,
      id: "ev-1",
      image: "https://example.com/party.jpg",
      title_en: "Autumn party",
      title_no: "Høstfest",
      type: "event",
    },
  ]);

  test("reads the title and image saved for the linked content", () => {
    expect(storedLinkFrom(items, "ev-1")).toEqual({
      image: "https://example.com/party.jpg",
      title: "Autumn party",
    });
  });

  test("falls back to the Norwegian title", () => {
    const norwegianOnly = JSON.stringify([
      { id: "ev-1", image: null, title_en: "", title_no: "Høstfest" },
    ]);
    expect(storedLinkFrom(norwegianOnly, "ev-1")).toEqual({
      image: null,
      title: "Høstfest",
    });
  });

  test("nothing for another id, no snapshot or bad JSON", () => {
    expect(storedLinkFrom(items, "ev-2")).toBeNull();
    expect(storedLinkFrom(null, "ev-1")).toBeNull();
    expect(storedLinkFrom("{oops", "ev-1")).toBeNull();
    expect(storedLinkFrom(items, null)).toBeNull();
  });
});
