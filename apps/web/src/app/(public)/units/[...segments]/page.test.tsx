import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The editor's normalizer and the feed resolver (`@/lib/data/page-feeds`) are
// real; only the Appwrite readers and the rendering leaves are stubbed.
const cachedPublishedPage = vi.hoisted(() => vi.fn());
const cachedPageEventsFeed = vi.hoisted(() => vi.fn());
const cachedUnitDetail = vi.hoisted(() => vi.fn());
const stubs = vi.hoisted(() => ({
  RenderedPage: () => null,
  UnitView: () => null,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/app/actions/locale", () => ({ getLocale: async () => "no" }));
vi.mock("./resolve", () => ({
  resolveUnit: async () => ({
    canonical: "/units/oslo/fadderullan",
    department: { $id: "d-1", Name: "OSL Fadderullan" },
    kind: "department",
  }),
}));
vi.mock("@/lib/data/public-content", () => ({
  cachedPageDepartmentsFeed: vi.fn(async () => ({ departments: [] })),
  cachedPageEventsFeed,
  cachedPageJobsFeed: vi.fn(async () => []),
  cachedPageNewsFeed: vi.fn(async () => []),
  cachedPagePartnersFeed: vi.fn(async () => []),
  cachedPublishedPage,
}));
vi.mock("@/lib/data/units", () => ({ cachedUnitDetail }));
vi.mock("../../[...slug]/_components/rendered-page", () => ({
  RenderedPage: stubs.RenderedPage,
}));
vi.mock("./_components/unit-view", () => ({ UnitView: stubs.UnitView }));
vi.mock("./_components/campus-chooser", () => ({ CampusChooser: () => null }));
vi.mock("./loading", () => ({ default: () => null }));

import UnitPage, { generateMetadata } from "./page";

const META = {
  accentColor: "#3DA9E0",
  department: "d-1",
  slug: "units/oslo/fadderullan",
  status: "published",
  title: "Fadderullan",
};

const UNIT = { name: "Fadderullan", summary: "The coded default page." };

function ownPage(doc: unknown) {
  return {
    doc,
    row: { department_id: "d-1", status: "published" },
    translation: {
      description: "Stored page",
      is_published: true,
      title: "Stored page",
    },
  };
}

type Element = ReactElement<{ children?: unknown; [key: string]: unknown }>;
const child = (el: Element) => el.props.children as Element;
const params = Promise.resolve({ segments: ["oslo", "fadderullan"] });

describe("unit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedUnitDetail.mockResolvedValue(UNIT);
    cachedPageEventsFeed.mockResolvedValue([{ title: "Kickoff" }]);
  });

  it("an old flat document falls back to the coded default unit page", async () => {
    cachedPublishedPage.mockResolvedValue(
      ownPage({
        blocks: [{ id: "b-1", source: "auto", type: "events" }],
        meta: META,
      })
    );

    const page = (await UnitPage({ params })) as Element;

    expect(child(page).type).toBe(stubs.UnitView);
    expect(cachedPageEventsFeed).not.toHaveBeenCalled();
    // generateMetadata shares the predicate, so it describes the default
    // view, not the page that did not render.
    expect((await generateMetadata({ params })).title).toBe(
      "Fadderullan | BISO"
    );
  });

  it("a published page renders its normalized document with its feeds", async () => {
    cachedPublishedPage.mockResolvedValue(
      ownPage({
        meta: META,
        sections: [
          {
            columns: [
              { blocks: [{ id: "b-1", source: "auto", type: "events" }] },
            ],
            id: "s-1",
          },
        ],
        version: 2,
      })
    );

    const page = (await UnitPage({ params })) as Element;
    // <div><Suspense><PublishedUnit/></Suspense></div>
    const publishedUnit = child(child(page));
    const render = publishedUnit.type as (props: unknown) => Promise<Element>;
    const rendered = await render(publishedUnit.props);

    expect(rendered.type).toBe(stubs.RenderedPage);
    const doc = rendered.props.doc as {
      sections: { columns: { id: string }[]; layout: { columns: string } }[];
    };
    expect(doc.sections[0].layout.columns).toBe("1");
    expect(typeof doc.sections[0].columns[0].id).toBe("string");
    expect(rendered.props.feeds).toEqual({
      "events|d-1|no": [{ title: "Kickoff" }],
    });
  });

  it("a published page with only a page header is the unit's page, not the default", async () => {
    cachedPublishedPage.mockResolvedValue(
      ownPage({
        header: { title: "Fadderullan", variant: "plain" },
        meta: META,
        sections: [],
        version: 2,
      })
    );

    const page = (await UnitPage({ params })) as Element;
    expect(child(page).type).not.toBe(stubs.UnitView);
    const publishedUnit = child(child(page));
    const render = publishedUnit.type as (props: unknown) => Promise<Element>;
    const rendered = await render(publishedUnit.props);

    expect(rendered.type).toBe(stubs.RenderedPage);
    expect(
      (rendered.props.doc as { header?: { title: string } }).header?.title
    ).toBe("Fadderullan");
    // The metadata follows the same predicate: it describes the stored page.
    expect((await generateMetadata({ params })).title).toBe(
      "Stored page | BISO"
    );
  });

  it("a published page with neither sections nor a header falls back to the default", async () => {
    cachedPublishedPage.mockResolvedValue(
      ownPage({ meta: META, sections: [], version: 2 })
    );

    const page = (await UnitPage({ params })) as Element;
    expect(child(page).type).toBe(stubs.UnitView);
    expect((await generateMetadata({ params })).title).toBe(
      "Fadderullan | BISO"
    );
  });
});

describe("unit route: rich text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedUnitDetail.mockResolvedValue(UNIT);
  });

  it("a published page reaches RenderedPage with sanitized text-block HTML", async () => {
    cachedPublishedPage.mockResolvedValue(
      ownPage({
        meta: META,
        sections: [
          {
            columns: [
              {
                blocks: [
                  {
                    body: [
                      { text: "<script>alert(1)</script>Velkommen", type: "p" },
                    ],
                    id: "b-1",
                    type: "text",
                  },
                ],
                id: "c-1",
              },
            ],
            id: "s-1",
            layout: { columns: "1" },
          },
        ],
        version: 2,
      })
    );

    const page = (await UnitPage({ params })) as Element;
    const publishedUnit = child(child(page));
    const render = publishedUnit.type as (props: unknown) => Promise<Element>;
    const rendered = await render(publishedUnit.props);
    const doc = rendered.props.doc as {
      sections: { columns: { blocks: { body: { text: string }[] }[] }[] }[];
    };

    expect(rendered.type).toBe(stubs.RenderedPage);
    expect(doc.sections[0].columns[0].blocks[0].body[0].text).toBe("Velkommen");
  });
});
