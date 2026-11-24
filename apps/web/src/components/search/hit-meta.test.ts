import { describe, expect, it } from "vitest";
import { FEB_12_2027, searchHit } from "@/test/search-fixtures";
import { hitMeta, intlLocaleOf, leadOf, pageParents } from "./hit-meta";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key} ${Object.values(values).join(" ")}` : key;

const NBSP = / /g;
const plain = (text: string) => text.replace(NBSP, " ");

describe("pageParents", () => {
  it("reads the parent path with words instead of slugs", () => {
    expect(pageParents("/projects/winter-games/packing-list")).toBe(
      "Projects / Winter games"
    );
  });

  it("is empty for a top-level page and ignores query and hash", () => {
    expect(pageParents("/membership")).toBe("");
    expect(pageParents("/students/fund?x=1#apply")).toBe("Students");
  });
});

describe("hitMeta", () => {
  const en = intlLocaleOf("en");

  it("gives an event its day and place", () => {
    const meta = hitMeta(
      searchHit({
        id: "e",
        group: "event",
        starts_at: FEB_12_2027,
        location: "Hafjell",
      }),
      en,
      t
    );
    expect(meta).toBe("Fri 12 Feb · Hafjell");
  });

  it("falls back to the campus, and drops it for all campuses", () => {
    expect(hitMeta(searchHit({ id: "n", group: "news" }), en, t)).toBe(
      "Bergen"
    );
    expect(
      hitMeta(
        searchHit({
          id: "n",
          group: "news",
          campus_id: "all",
          campus_name: "All campuses",
        }),
        en,
        t
      )
    ).toBe("");
  });

  it("gives a job its deadline and department", () => {
    expect(
      hitMeta(
        searchHit({
          id: "j",
          group: "job",
          deadline: FEB_12_2027,
          department: "Case Club",
        }),
        en,
        t
      )
    ).toBe("meta.applyBy 12 Feb · Case Club");
  });

  it("prices a product and says out of stock, never a count", () => {
    const meta = plain(
      hitMeta(
        searchHit({
          id: "p",
          group: "product",
          price: 449,
          member_price: 349,
          in_stock: false,
        }),
        intlLocaleOf("no"),
        t
      )
    );
    expect(meta).toBe("449 kr · meta.memberPrice 349 kr · meta.outOfStock");
  });

  it("says free for members when the member price is zero", () => {
    expect(
      plain(
        hitMeta(
          searchHit({ id: "p", group: "product", price: 100, member_price: 0 }),
          en,
          t
        )
      )
    ).toBe("NOK 100 · meta.freeForMembers");
  });

  it("shows a page's parents, and a document's department instead of its download URL", () => {
    expect(
      hitMeta(
        searchHit({
          id: "pg",
          group: "page",
          url: "/projects/winter-games/packing-list",
        }),
        en,
        t
      )
    ).toBe("Projects / Winter games");
    expect(
      hitMeta(
        searchHit({
          id: "d",
          group: "page",
          type: "document",
          department: "Board",
          url: "/api/documents/d/download",
        }),
        en,
        t
      )
    ).toBe("Board · Bergen");
  });

  it("names a unit's campus", () => {
    expect(hitMeta(searchHit({ id: "u", group: "unit" }), en, t)).toBe(
      "Bergen"
    );
  });
});

describe("leadOf", () => {
  it("leads events with a date, news and products with a picture, and nothing else", () => {
    const image = "https://appwrite.biso.no/x.jpg";
    expect(
      leadOf(searchHit({ id: "e", group: "event", starts_at: FEB_12_2027 }))
    ).toBe("date");
    expect(leadOf(searchHit({ id: "e", group: "event", image }))).toBe("image");
    expect(leadOf(searchHit({ id: "n", group: "news", image }))).toBe("image");
    expect(leadOf(searchHit({ id: "p", group: "product", image }))).toBe(
      "image"
    );
    expect(leadOf(searchHit({ id: "n", group: "news" }))).toBeNull();
    expect(leadOf(searchHit({ id: "u", group: "unit", image }))).toBeNull();
    expect(leadOf(searchHit({ id: "j", group: "job", image }))).toBeNull();
  });
});
