import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SitemapEntries } from "@/lib/data/public-content";

const entries = vi.hoisted(() => ({
  current: {
    events: [],
    jobs: [],
    news: [],
    pages: [],
    products: [],
    projects: [],
    units: [],
  } as SitemapEntries,
}));

vi.mock("@/lib/data/public-content", () => ({
  sitemapEntries: vi.fn(async () => entries.current),
}));

import sitemap from "./sitemap";

const empty: SitemapEntries = {
  events: [],
  jobs: [],
  news: [],
  pages: [],
  products: [],
  projects: [],
  units: [],
};

const paths = async () =>
  (await sitemap()).map((entry) => new URL(entry.url).pathname);

describe("sitemap.xml", () => {
  beforeEach(() => {
    entries.current = empty;
  });

  it("lists /students", async () => {
    expect(await paths()).toContain("/students");
  });

  it("lists the flagship hubs while `large_event` is empty", async () => {
    // The hubs render from their own copy, so they exist with no row behind
    // them — and with the table empty they were missing from the sitemap.
    const listed = await paths();
    for (const hub of [
      "/projects/fadderullan",
      "/projects/karrieredagene",
      "/projects/winter-games",
    ]) {
      expect(listed).toContain(hub);
    }
    expect(listed).not.toContain("/projects/bergensbanelopet");
  });

  it("lists a hub once when `large_event` lists it too", async () => {
    entries.current = {
      ...empty,
      projects: [
        { $updatedAt: "2026-10-01T00:00:00.000Z", slug: "fadderullan" },
      ],
    };
    const listed = await paths();
    expect(
      listed.filter((path) => path === "/projects/fadderullan")
    ).toHaveLength(1);
  });

  it("lists no URL twice", async () => {
    const listed = await paths();
    expect(new Set(listed).size).toBe(listed.length);
  });
});
