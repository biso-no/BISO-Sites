import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cachedPageEventsFeed = vi.hoisted(() => vi.fn());
const stubs = vi.hoisted(() => ({ RenderedPage: () => null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/public-content", () => ({
  cachedDepartmentTheme: vi.fn(),
  cachedPageDepartmentsFeed: vi.fn(async () => ({ departments: [] })),
  cachedPageEventsFeed,
  cachedPageJobsFeed: vi.fn(async () => []),
  cachedPageNewsFeed: vi.fn(async () => []),
  cachedPagePartnersFeed: vi.fn(async () => []),
}));
vi.mock("@/app/(public)/[...slug]/_components/rendered-page", () => ({
  RenderedPage: stubs.RenderedPage,
}));

import { PageThemeStyle } from "@/components/page-theme-style";
import { renderPublishedEditorPage } from "./published-editor-page";

type El = ReactElement<{ children?: unknown; [key: string]: unknown }>;

const LIGHT = { theme_accent: "#c8a2f0", theme_dark: "#3b1c6b" };
const section = (blocks: unknown[]) => ({
  columns: [{ blocks, id: "c-1" }],
  id: "s-1",
  layout: { columns: "1" },
});
const result = (doc: unknown, departmentId: string | null = null) =>
  ({
    doc,
    row: { department_id: departmentId },
    translation: { is_published: true, title: "T" },
  }) as never;

const run = async (
  doc: unknown,
  extra: { departmentId?: string | null; theme?: typeof LIGHT | null } = {}
) =>
  (await renderPublishedEditorPage({
    departmentTheme: extra.theme ?? null,
    locale: "no",
    result: result(doc, extra.departmentId ?? null),
    slug: "projects/winter-games",
  })) as El & { props: { children: El[] } };

describe("renderPublishedEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedPageEventsFeed.mockResolvedValue([{ title: "Kickoff" }]);
  });

  it("puts the theme first and the page second, with the route's slug", async () => {
    const tree = await run({ meta: {}, sections: [], version: 2 });
    const [theme, page] = tree.props.children;

    expect(theme.type).toBe(PageThemeStyle);
    expect(page.type).toBe(stubs.RenderedPage);
    expect(page.props.slug).toBe("projects/winter-games");
    expect(page.props.locale).toBe("no");
  });

  it("normalizes an old flat document to an empty page", async () => {
    const tree = await run({
      blocks: [{ id: "b", source: "auto", type: "events" }],
      meta: {},
    });
    expect(tree.props.children[1].props.doc).toEqual({
      meta: {},
      sections: [],
      version: 2,
    });
    expect(cachedPageEventsFeed).not.toHaveBeenCalled();
  });

  it("sanitizes text-block HTML", async () => {
    const tree = await run({
      meta: {},
      sections: [
        section([
          {
            body: [{ text: "<script>x</script>Hei", type: "p" }],
            id: "b",
            type: "text",
          },
        ]),
      ],
      version: 2,
    });
    const doc = tree.props.children[1].props.doc as {
      sections: { columns: { blocks: { body: { text: string }[] }[] }[] }[];
    };
    expect(doc.sections[0].columns[0].blocks[0].body[0].text).toBe("Hei");
  });

  it("resolves feeds and prunes an empty one", async () => {
    cachedPageEventsFeed.mockResolvedValue([]);
    const tree = await run({
      meta: {},
      sections: [section([{ id: "b", source: "auto", type: "events" }])],
      version: 2,
    });
    const doc = tree.props.children[1].props.doc as {
      sections: { columns: { blocks: unknown[] }[] }[];
    };
    expect(doc.sections[0].columns[0].blocks).toEqual([]);
  });

  it("a bound page wears its department's theme, not the document's", async () => {
    const doc = {
      meta: { theme: { accent: "#ff0000", dark: "#000000" } },
      sections: [],
      version: 2,
    };
    const tree = await run(doc, { departmentId: "d-1", theme: LIGHT });
    expect(tree.props.children[0].props.theme).toEqual({
      accent: "#c8a2f0",
      dark: "#3b1c6b",
    });

    const missing = await run(doc, { departmentId: "d-1", theme: null });
    expect(missing.props.children[0].props.theme).toBeNull();
  });

  it("an unbound page wears the theme in its document", async () => {
    const tree = await run({
      meta: { theme: { accent: "#c8a2f0", dark: "#3b1c6b" } },
      sections: [],
      version: 2,
    });
    expect(tree.props.children[0].props.theme).toEqual({
      accent: "#c8a2f0",
      dark: "#3b1c6b",
    });
  });

  it("streams the body inside the caller's frame, theme still first", async () => {
    const Frame = ({ children }: { children?: ReactNode }) => children;
    const tree = (await renderPublishedEditorPage({
      departmentTheme: null,
      locale: "no",
      result: result({ meta: {}, sections: [], version: 2 }),
      slug: "units/oslo/x",
      stream: {
        fallback: "loading",
        frame: (body) => <Frame>{body}</Frame>,
      },
    })) as El & { props: { children: El[] } };

    expect(tree.props.children[0].type).toBe(PageThemeStyle);
    expect(tree.props.children[1].type).toBe(Frame);
  });
});
