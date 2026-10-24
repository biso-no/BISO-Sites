import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageFeedProvider } from "@/editor/page-feed-context";
import { type PageFeedSnapshot, pageFeedKey } from "@/editor/page-feeds";
import type { NewsBlock } from "@/editor/types";
import { NewsRender } from "./render";

const block: NewsBlock = {
  heading: "Latest news",
  id: "n1",
  limit: 3,
  seeAll: true,
  source: "auto",
  type: "news",
};

const ITEMS = [
  {
    department: "BISO Oslo",
    href: "/news/first",
    id: "a",
    image: "/images/campus/oslo.png",
    publishedAt: "1. nov. 2026",
    publishedAtIso: "2026-11-01T10:00:00.000Z",
    summary: "A short summary",
    title: "First story",
  },
  {
    department: "BISO Oslo",
    href: "/news/second",
    id: "b",
    publishedAt: "2. nov. 2026",
    summary: "",
    title: "Second story",
  },
];

function html(
  props: Partial<NewsBlock> = {},
  feeds: PageFeedSnapshot = {},
  options: { department?: string; edit?: boolean } = {}
) {
  const { department = "25", edit = false } = options;
  return renderToStaticMarkup(
    <PageFeedProvider department={department} feeds={feeds} locale="no">
      <NewsRender
        block={{ ...block, ...props }}
        edit={edit}
        onPatch={() => undefined}
      />
    </PageFeedProvider>
  );
}

const feeds: PageFeedSnapshot = { [pageFeedKey("news", "25", "no", 3)]: ITEMS };

describe("NewsRender", () => {
  test("renders one linked card per feed item", () => {
    const out = html({}, feeds);
    expect(out.match(/<li/g)?.length).toBe(2);
    expect(out).toContain('href="/news/first"');
    expect(out).toContain('href="/news/second"');
    expect(out).toContain("type-heading-card");
    expect(out).toContain("<time");
    expect(out).toContain("line-clamp-3");
    expect(out).toContain('<h2 class="type-heading-section');
    expect(out).toContain('href="/news"');
    expect(out).toContain("Se alle →");
  });

  test("renders nothing on the site without items", () => {
    expect(html({}, { [pageFeedKey("news", "25", "no", 3)]: [] })).toBe("");
    expect(html({}, {})).toBe("");
    expect(html({}, feeds, { department: "" })).toBe("");
  });

  test("the editor explains why nothing shows", () => {
    expect(
      html({}, { [pageFeedKey("news", "25", "no", 3)]: [] }, { edit: true })
    ).toContain("No news for 25");
    expect(html({}, {}, { edit: true })).toContain("Loading…");
    expect(html({}, feeds, { department: "", edit: true })).toContain(
      "Choose a department"
    );
  });

  test("cards are inert in the editor", () => {
    expect(html({}, feeds, { edit: true })).not.toContain('href="/news/first"');
  });
});
