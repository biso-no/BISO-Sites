import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageFeedProvider } from "@/editor/page-feed-context";
import { type PageFeedSnapshot, pageFeedKey } from "@/editor/page-feeds";
import type { ProductGridBlock } from "@/editor/types";
import { ProductGridRender } from "./render";

const block: ProductGridBlock = {
  heading: "Butikk",
  id: "s1",
  limit: 4,
  source: "auto",
  type: "productGrid",
};

const ITEMS = [
  {
    href: "/shop/lue",
    id: "a",
    image: "/lue.png",
    memberOnly: true,
    memberPrice: 199,
    price: 250,
    soldOut: true,
    title: "Lue",
  },
  {
    href: "/shop/skjerf",
    id: "b",
    memberOnly: false,
    price: 120,
    soldOut: false,
    title: "Skjerf",
  },
];

const feeds = (limit = 4): PageFeedSnapshot => ({
  [pageFeedKey("products", "25", "no", limit)]: ITEMS,
});

function html(
  props: Partial<ProductGridBlock> = {},
  snapshot: PageFeedSnapshot = feeds(),
  options: { department?: string; edit?: boolean; surface?: boolean } = {}
) {
  const node = (
    <PageFeedProvider
      department={options.department ?? "25"}
      feeds={snapshot}
      locale="no"
    >
      <ProductGridRender
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

describe("ProductGridRender", () => {
  test("shows price, member price, members-only and sold-out", () => {
    const out = html();
    expect(out).toContain('href="/shop/lue"');
    expect(out).toContain("250 kr");
    expect(out).toContain("199 kr for medlemmer");
    expect(out).toContain("Kun for medlemmer");
    expect(out).toContain("Utsolgt");
    expect(out).toContain("120 kr");
    expect(out.match(/Utsolgt/g)?.length).toBe(1);
    expect(out.match(/kr for medlemmer/g)?.length).toBe(1);
  });

  test("limit 8 reads the 8 feed", () => {
    expect(html({ limit: 8 }, feeds(4))).toBe("");
    expect(html({ limit: 8 }, feeds(8)).match(/<li/g)?.length).toBe(2);
  });

  test("an unknown limit falls back to 4", () => {
    expect(html({ limit: 5 as never }).match(/<li/g)?.length).toBe(2);
  });

  test("nothing on the site for an empty or department-less feed", () => {
    expect(html({}, { [pageFeedKey("products", "25", "no", 4)]: [] })).toBe("");
    expect(html({}, feeds(), { department: "" })).toBe("");
  });

  test("the editor explains and keeps cards inert", () => {
    expect(html({}, feeds(), { department: "", edit: true })).toContain(
      "Choose a department"
    );
    const out = html({}, feeds(), { edit: true });
    expect(out).not.toContain('href="/shop/lue"');
    expect(out).toContain("Lue");
    expect(
      html({}, { [pageFeedKey("products", "25", "no", 4)]: [] }, { edit: true })
    ).toContain("No products for 25");
  });

  test("tolerates junk rows and renders on a dark section", () => {
    const out = html(
      {},
      { [pageFeedKey("products", "25", "no", 4)]: [null, "x", ...ITEMS] },
      { surface: true }
    );
    expect(out.match(/<li/g)?.length).toBe(2);
    expect(out).toContain("text-ink");
  });
});
