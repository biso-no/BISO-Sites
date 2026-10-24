import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageFeedProvider } from "@/editor/page-feed-context";
import {
  collectPageFeedRequests,
  departmentsFeedKey,
  type PageFeedSnapshot,
  unitsScope,
} from "@/editor/page-feeds";
import type { DepartmentGridBlock } from "@/editor/types";
import { DepartmentGridRender } from "./render";

const block: DepartmentGridBlock = {
  heading: "Enheter",
  id: "d1",
  limit: 6,
  scope: "campus",
  type: "departmentGrid",
};

const ITEMS = [
  {
    campusId: "1",
    campusLabel: "Oslo",
    href: "/units/oslo/finance",
    id: "a",
    logoUrl: "/logo.png",
    name: "Finance Society",
  },
  { campusId: "1", campusLabel: "Oslo", id: "b", name: "Quiz Club" },
];

function html(
  props: Partial<DepartmentGridBlock> = {},
  feeds: PageFeedSnapshot = { [departmentsFeedKey("1", "")]: ITEMS },
  options: { campus?: string; edit?: boolean; surface?: boolean } = {}
) {
  const node = (
    <PageFeedProvider
      campus={options.campus ?? "1"}
      department=""
      feeds={feeds}
      locale="no"
    >
      <DepartmentGridRender
        block={{ ...block, ...props }}
        edit={options.edit ?? false}
        onPatch={() => undefined}
      />
    </PageFeedProvider>
  );
  return renderToStaticMarkup(
    options.surface ? <section data-surface="deep">{node}</section> : node
  );
}

function pageDoc(b: DepartmentGridBlock, campus: string) {
  return {
    meta: { campus, department: "", title: "t" },
    sections: [{ columns: [{ blocks: [b], id: "c" }], id: "s", layout: {} }],
    version: 2,
  } as never;
}

describe("DepartmentGridRender", () => {
  test("scope campus puts the page campus in the request key", () => {
    const [req] = collectPageFeedRequests(pageDoc(block, "2"), "no");
    expect(req?.campus).toBe("2");
    expect(req?.key).toBe(departmentsFeedKey("2", ""));
    expect(req?.key).not.toBe(departmentsFeedKey("", ""));
  });

  test("scope all and the category are keyed too", () => {
    const [all] = collectPageFeedRequests(
      pageDoc({ ...block, scope: "all", category: "society" }, "2"),
      "no"
    );
    expect(all?.campus).toBe("");
    expect(all?.category).toBe("society");
    expect(all?.key).toBe(departmentsFeedKey("", "society"));
  });

  test("renders one linked card per unit with crest, name and campus", () => {
    const out = html();
    expect(out.match(/<li/g)?.length).toBe(2);
    expect(out).toContain('href="/units/oslo/finance"');
    expect(out).toContain("Finance Society");
    expect(out).toContain("Oslo");
    expect(out).toContain('src="/logo.png"');
    expect(out).toContain("bg-surface-sunken");
    expect(out).toContain('<h2 class="type-heading-section');
  });

  test("a unit without href is not linked and a monogram stands in", () => {
    const out = html();
    expect(out.match(/<a /g)?.length).toBe(1);
    expect(out).toContain(">QC<");
  });

  test("limit slices the cards", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...ITEMS[1],
      id: `u${i}`,
    }));
    expect(
      html({ limit: 3 }, { [departmentsFeedKey("1", "")]: many }).match(/<li/g)
        ?.length
    ).toBe(3);
  });

  test("nothing on the site when empty, a placeholder in the editor", () => {
    expect(html({}, { [departmentsFeedKey("1", "")]: [] })).toBe("");
    expect(html({}, {})).toBe("");
    expect(
      html({}, { [departmentsFeedKey("1", "")]: [] }, { edit: true })
    ).toContain("No units");
  });

  test("an unknown or missing scope is the default, campus", () => {
    for (const scope of ["weird", undefined] as never[]) {
      const [req] = collectPageFeedRequests(
        pageDoc({ ...block, scope }, "2"),
        "no"
      );
      expect(req?.key).toBe(departmentsFeedKey("2", ""));
    }
    expect(unitsScope("weird")).toBe("campus");
  });

  test("tolerates a missing limit and junk rows", () => {
    const out = html(
      { limit: undefined as never },
      { [departmentsFeedKey("1", "")]: [null, 3, ...ITEMS] }
    );
    expect(out.match(/<li/g)?.length).toBe(2);
  });

  test("renders on a dark section", () => {
    expect(html({}, undefined, { surface: true })).toContain("text-ink");
  });
});
