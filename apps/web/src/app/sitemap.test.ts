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

/** The pages stored at `projects/<project>`, by slug, as the public cache answers. */
const projectPages = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
const cachedPublishedPage = vi.hoisted(() =>
  vi.fn(async (slug: string) => projectPages.current[slug] ?? null)
);

vi.mock("@/lib/data/public-content", () => ({
  // The campus-5 national unit of a national project.
  cachedDepartmentBySlugAndCampus: vi.fn(async () => ({ $id: "d-nat" })),
  cachedPublishedPage,
  sitemapEntries: vi.fn(async () => entries.current),
}));

import sitemap from "./sitemap";

const SECTIONS = [{ columns: [{ blocks: [], id: "c" }], id: "s" }];

/** A published page at `projects/<project>`. */
function projectPage(
  project: string,
  departmentId: string | null,
  sections: unknown[] = SECTIONS
) {
  return {
    doc: { meta: {}, sections, version: 2 },
    row: {
      department_id: departmentId,
      slug: `projects/${project}`,
      status: "published",
    },
    translation: { is_published: true, title: project },
  };
}

const NATIONAL_WINTER_GAMES = {
  $updatedAt: "2026-10-01T00:00:00.000Z",
  campus_id: "5",
  slug: "wintergames",
};

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
    projectPages.current = {};
    cachedPublishedPage.mockReset();
    cachedPublishedPage.mockImplementation(
      async (slug: string) => projectPages.current[slug] ?? null
    );
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

  it("leaves projects/ page slugs to the projects listing", async () => {
    entries.current = {
      ...empty,
      pages: [
        {
          $updatedAt: "2026-10-01T00:00:00.000Z",
          slug: "projects/winter-games",
        },
        { $updatedAt: "2026-10-01T00:00:00.000Z", slug: "om-oss" },
      ],
      projects: [
        { $updatedAt: "2026-10-01T00:00:00.000Z", slug: "winter-games" },
      ],
    };
    const listed = await paths();
    expect(listed).toContain("/om-oss");
    expect(
      listed.filter((path) => path === "/projects/winter-games")
    ).toHaveLength(1);
  });

  it("lists a hub project once its own page is published, Bergensbaneløpet too", async () => {
    projectPages.current = {
      "projects/bergensbanelopet": projectPage("bergensbanelopet", null),
      "projects/fadderullan": projectPage("fadderullan", null),
    };
    const listed = await paths();
    expect(listed).toContain("/projects/bergensbanelopet");
    for (const hub of ["/projects/bergensbanelopet", "/projects/fadderullan"]) {
      expect(listed.filter((path) => path === hub)).toHaveLength(1);
    }
    // Crawlers carry no locale cookie: the default locale is what they get.
    expect(cachedPublishedPage).toHaveBeenCalledWith(
      "projects/bergensbanelopet",
      "no"
    );
  });

  it("does not list a hub page the project route would not serve", async () => {
    for (const page of [
      // Empty: the route falls back to the coded hub, and there is none.
      projectPage("bergensbanelopet", null, []),
      // A hub page carries no department.
      projectPage("bergensbanelopet", "d-x"),
    ]) {
      projectPages.current = { "projects/bergensbanelopet": page };
      expect(await paths()).not.toContain("/projects/bergensbanelopet");
    }
  });

  it("drops the Winter Games unit URL once it redirects to the project page", async () => {
    entries.current = { ...empty, units: [NATIONAL_WINTER_GAMES] };
    expect(await paths()).toContain("/units/national/wintergames");

    projectPages.current = {
      "projects/winter-games": projectPage("winter-games", "d-nat"),
    };
    const listed = await paths();
    expect(listed).not.toContain("/units/national/wintergames");
    expect(
      listed.filter((path) => path === "/projects/winter-games")
    ).toHaveLength(1);
  });

  it("keeps the Winter Games unit URL while the project page would not be served", async () => {
    entries.current = { ...empty, units: [NATIONAL_WINTER_GAMES] };
    for (const page of [
      projectPage("winter-games", "d-nat", []),
      projectPage("winter-games", "d-other"),
      projectPage("winter-games", null),
    ]) {
      projectPages.current = { "projects/winter-games": page };
      expect(await paths()).toContain("/units/national/wintergames");
    }
  });

  it("keeps a campus unit of a project and the national unit of a hub project", async () => {
    entries.current = {
      ...empty,
      units: [
        { ...NATIONAL_WINTER_GAMES, campus_id: "1" },
        { ...NATIONAL_WINTER_GAMES, slug: "fadderullan" },
      ],
    };
    projectPages.current = {
      "projects/fadderullan": projectPage("fadderullan", null),
      "projects/winter-games": projectPage("winter-games", "d-nat"),
    };
    const listed = await paths();
    expect(listed).toContain("/units/oslo/wintergames");
    expect(listed).toContain("/units/national/fadderullan");
  });

  it("a failed project page read leaves the sitemap as it was", async () => {
    entries.current = { ...empty, units: [NATIONAL_WINTER_GAMES] };
    cachedPublishedPage.mockRejectedValue(new Error("Appwrite down"));
    const listed = await paths();
    expect(listed).toContain("/units/national/wintergames");
    expect(listed).toContain("/projects/winter-games");
    expect(listed).not.toContain("/projects/bergensbanelopet");
  });
});
