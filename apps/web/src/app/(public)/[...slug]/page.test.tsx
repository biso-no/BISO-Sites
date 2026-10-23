import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Everything between the stored document and the renderer is real here: the
// editor's normalizer and the feed resolver (`@/lib/data/page-feeds`). Only
// the Appwrite readers and the client renderer are stubbed.
const cachedPublishedPage = vi.hoisted(() => vi.fn());
const cachedPageEventsFeed = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/actions/locale", () => ({ getLocale: async () => "no" }));
vi.mock("@/lib/cookie-prefs", () => ({ SESSION_COOKIE: "session" }));
vi.mock("@repo/api/page-builder", () => ({ getPage: vi.fn() }));
vi.mock("@/lib/data/public-content", () => ({
  cachedPageDepartmentsFeed: vi.fn(async () => ({ departments: [] })),
  cachedPageEventsFeed,
  cachedPageJobsFeed: vi.fn(async () => []),
  cachedPageNewsFeed: vi.fn(async () => []),
  cachedPagePartnersFeed: vi.fn(async () => []),
  cachedPublishedPage,
  isPublishedPage: () => true,
}));
// The client renderer pulls in every block; the element's props are what
// these tests read.
vi.mock("./_components/rendered-page", () => ({ RenderedPage: () => null }));

import DynamicPage, { generateMetadata } from "./page";

const META = {
  accentColor: "#3DA9E0",
  department: "25",
  slug: "old-page",
  status: "published",
  title: "Old page",
};

function published(doc: unknown) {
  return {
    doc,
    row: { status: "published" },
    translation: { is_published: true, title: "Old page" },
  };
}

type Rendered = ReactElement<{
  doc: { sections: { columns: { blocks: unknown[] }[] }[]; version: number };
  feeds: Record<string, unknown[]>;
}>;

const render = async (slug: string) =>
  (await DynamicPage({
    params: Promise.resolve({ slug: [slug] }),
  })) as Rendered;

describe("block page route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedPageEventsFeed.mockResolvedValue([{ title: "Kickoff" }]);
  });

  it("renders an old flat document as an empty page instead of a 500", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({
        blocks: [{ id: "b-1", source: "auto", type: "events" }],
        meta: META,
      })
    );

    const page = await render("old-page");

    expect(page.props.doc).toEqual({ meta: META, sections: [], version: 2 });
    expect(page.props.feeds).toEqual({});
    expect(cachedPageEventsFeed).not.toHaveBeenCalled();
  });

  it("resolves feeds past a section stored without columns", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({
        meta: META,
        sections: [
          { id: "s-1", layout: {} },
          {
            columns: [
              {
                blocks: [null, { id: "b-1", source: "auto", type: "events" }],
                id: "c-1",
              },
            ],
            id: "s-2",
            layout: { columns: "1" },
          },
        ],
        version: 2,
      })
    );

    const page = await render("old-page");

    // The renderer gets the normalized document, not the stored one.
    expect(
      page.props.doc.sections.map((s) => s.columns.map((c) => c.blocks.length))
    ).toEqual([[0], [1]]);
    expect(page.props.feeds).toEqual({
      "events|25|no": [{ title: "Kickoff" }],
    });
  });

  it("returns no metadata title when the translation is published but has no document", async () => {
    cachedPublishedPage.mockResolvedValue({
      doc: null,
      row: { status: "published" },
      translation: { is_published: true, title: "Old page" },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ["old-page"] }),
    });

    expect(metadata).toEqual({});
  });

  it("returns no metadata title for an unpublished translation", async () => {
    cachedPublishedPage.mockResolvedValue({
      doc: { meta: META, sections: [], version: 2 },
      row: { status: "published" },
      translation: { is_published: false, title: "Old page" },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ["old-page"] }),
    });

    expect(metadata).toEqual({});
  });

  it("titles the metadata of a published page with a document", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({ meta: META, sections: [], version: 2 })
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ["old-page"] }),
    });

    expect(metadata.title).toBe("Old page | BISO");
  });
});
