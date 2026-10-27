import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The editor's normalizer and the feed resolver (`@/lib/data/page-feeds`) are
// real; only the Appwrite readers and the rendering leaves are stubbed.
const cachedPublishedPage = vi.hoisted(() => vi.fn());
const cachedPageEventsFeed = vi.hoisted(() => vi.fn());
const cachedUnitDetail = vi.hoisted(() => vi.fn());
const resolveUnit = vi.hoisted(() =>
  vi.fn(async () => ({
    canonical: "/units/oslo/fadderullan",
    department: { $id: "d-1", Name: "OSL Fadderullan" } as Record<
      string,
      unknown
    >,
    kind: "department",
  }))
);
const stubs = vi.hoisted(() => ({
  RenderedPage: () => null,
  UnitView: () => null,
}));

// `@repo/editor/sanitize` opens with `import "server-only"`, which throws
// outside a react-server build.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/app/actions/locale", () => ({ getLocale: async () => "no" }));
vi.mock("./resolve", () => ({ resolveUnit }));
vi.mock("@/lib/data/public-content", () => ({
  cachedDepartmentBySlugAndCampus: vi.fn(async () => ({ $id: "d-nat" })),
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

import { PageThemeStyle } from "@/components/page-theme-style";
import UnitPage, { generateMetadata } from "./page";

const META = {
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
// The page returns <><PageThemeStyle/>{body}</>; `renderBody` is the body.
const renderBody = async () =>
  (
    (await UnitPage({ params })) as Element & {
      props: { children: Element[] };
    }
  ).props.children[1] as Element;
const themeOf = (el: Element) =>
  (el.props.children as Element[])[0] as Element & {
    props: { theme: unknown };
  };
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

    const page = await renderBody();

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

    const page = await renderBody();
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
      "events|d-1|no|3": [{ title: "Kickoff" }],
    });
  });

  it("an empty feed leaves the unit page no empty band", async () => {
    cachedPageEventsFeed.mockResolvedValue([]);
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

    const page = await renderBody();
    const publishedUnit = child(child(page));
    const render = publishedUnit.type as (props: unknown) => Promise<Element>;
    const rendered = await render(publishedUnit.props);
    const doc = rendered.props.doc as {
      sections: { columns: { blocks: unknown[] }[] }[];
    };

    expect(doc.sections[0].columns[0].blocks).toEqual([]);
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

    const page = await renderBody();
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

    const page = await renderBody();
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

    const page = await renderBody();
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

describe("unit route: department theme", () => {
  const THEMED = {
    $id: "d-1",
    Name: "OSL Fadderullan",
    theme_accent: "#c8a2f0",
    theme_dark: "#3b1c6b",
  };
  const EXPECTED = { dark: "#3b1c6b", accent: "#c8a2f0" };

  beforeEach(() => {
    vi.clearAllMocks();
    cachedUnitDetail.mockResolvedValue(UNIT);
    resolveUnit.mockResolvedValue({
      canonical: "/units/oslo/fadderullan",
      department: THEMED,
      kind: "department",
    });
  });

  afterEach(() => {
    resolveUnit.mockResolvedValue({
      canonical: "/units/oslo/fadderullan",
      department: { $id: "d-1", Name: "OSL Fadderullan" },
      kind: "department",
    });
  });

  it("the coded default view wears the department's theme, first in the tree", async () => {
    cachedPublishedPage.mockResolvedValue(null);

    const page = (await UnitPage({ params })) as Element;

    expect(themeOf(page).type).toBe(PageThemeStyle);
    expect(themeOf(page).props.theme).toEqual(EXPECTED);
    expect(child(page).type).not.toBe(PageThemeStyle);
  });

  it("the custom page wears the same theme, outside the Suspense boundary", async () => {
    cachedPublishedPage.mockResolvedValue(
      ownPage({
        header: { title: "Fadderullan", variant: "plain" },
        meta: META,
        sections: [],
        version: 2,
      })
    );

    const page = (await UnitPage({ params })) as Element;

    expect(themeOf(page).type).toBe(PageThemeStyle);
    expect(themeOf(page).props.theme).toEqual(EXPECTED);
  });

  it("a department with no theme renders BISO", async () => {
    resolveUnit.mockResolvedValue({
      canonical: "/units/oslo/fadderullan",
      department: { $id: "d-1", Name: "OSL Fadderullan" },
      kind: "department",
    });
    cachedPublishedPage.mockResolvedValue(null);

    const page = (await UnitPage({ params })) as Element;

    expect(themeOf(page).props.theme).toBeNull();
  });
});

describe("unit route: national project redirect (C3)", () => {
  const NATIONAL = {
    $id: "d-nat",
    campus_id: "5",
    Name: "Winter Games",
    slug: "wintergames",
  };
  const nationalParams = Promise.resolve({
    segments: ["national", "wintergames"],
  });
  const projectPage = {
    doc: {
      meta: {},
      sections: [{ columns: [{ blocks: [], id: "c" }], id: "s" }],
      version: 2,
    },
    row: {
      department_id: "d-nat",
      slug: "projects/winter-games",
      status: "published",
    },
    translation: { is_published: true, title: "Winter Games" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cachedUnitDetail.mockResolvedValue(UNIT);
    resolveUnit.mockResolvedValue({
      canonical: "/units/national/wintergames",
      department: NATIONAL,
      kind: "department",
    });
  });

  afterEach(() => {
    resolveUnit.mockResolvedValue({
      canonical: "/units/oslo/fadderullan",
      department: { $id: "d-1", Name: "OSL Fadderullan" },
      kind: "department",
    });
  });

  it("redirects permanently once a page exists at projects/winter-games", async () => {
    cachedPublishedPage.mockImplementation(async (slug: string) =>
      slug === "projects/winter-games" ? projectPage : null
    );

    await expect(UnitPage({ params: nationalParams })).rejects.toThrow(
      "NEXT_REDIRECT /projects/winter-games"
    );
  });

  it("does not redirect to a squatter row at the project address", async () => {
    for (const row of [
      { ...projectPage.row, department_id: null },
      { ...projectPage.row, department_id: "d-other" },
      { ...projectPage.row, slug: "projécts/winter-games" },
    ]) {
      cachedPublishedPage.mockImplementation(async (slug: string) =>
        slug === "projects/winter-games" ? { ...projectPage, row } : null
      );
      await expect(UnitPage({ params: nationalParams })).resolves.toBeDefined();
    }
  });

  it("a national unit of a hub project does not redirect", async () => {
    resolveUnit.mockResolvedValue({
      canonical: "/units/national/fadderullan",
      department: { ...NATIONAL, slug: "fadderullan" },
      kind: "department",
    });
    cachedPublishedPage.mockResolvedValue({
      ...projectPage,
      row: {
        ...projectPage.row,
        department_id: null,
        slug: "projects/fadderullan",
      },
    });
    await expect(
      UnitPage({
        params: Promise.resolve({ segments: ["national", "fadderullan"] }),
      })
    ).resolves.toBeDefined();
  });

  it("stays as today while no page exists there", async () => {
    cachedPublishedPage.mockResolvedValue(null);

    const tree = (await UnitPage({ params: nationalParams })) as Element & {
      props: { children: Element[] };
    };

    // <><PageThemeStyle/><Suspense><UnitView/></Suspense></>
    expect(child(tree.props.children[1]).type).toBe(stubs.UnitView);
  });

  it("an unpublished page does not redirect", async () => {
    cachedPublishedPage.mockImplementation(async (slug: string) =>
      slug === "projects/winter-games"
        ? { ...projectPage, translation: { is_published: false } }
        : null
    );

    const tree = (await UnitPage({ params: nationalParams })) as Element & {
      props: { children: Element[] };
    };

    // <><PageThemeStyle/><Suspense><UnitView/></Suspense></>
    expect(child(tree.props.children[1]).type).toBe(stubs.UnitView);
  });

  it("an empty project page does not redirect: the project route would not serve it", async () => {
    cachedPublishedPage.mockImplementation(async (slug: string) =>
      slug === "projects/winter-games"
        ? { ...projectPage, doc: { meta: {}, sections: [], version: 2 } }
        : null
    );

    const tree = (await UnitPage({ params: nationalParams })) as Element & {
      props: { children: Element[] };
    };

    // <><PageThemeStyle/><Suspense><UnitView/></Suspense></>
    expect(child(tree.props.children[1]).type).toBe(stubs.UnitView);
  });

  it("a campus unit of the same project does not redirect", async () => {
    resolveUnit.mockResolvedValue({
      canonical: "/units/oslo/wintergames",
      department: { ...NATIONAL, $id: "d-osl", campus_id: "1" },
      kind: "department",
    });
    cachedPublishedPage.mockResolvedValue(projectPage);

    await expect(UnitPage({ params: nationalParams })).resolves.toBeDefined();
  });
});
