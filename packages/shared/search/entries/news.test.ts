import { NewsStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { ctx, noText } from "./fixtures";
import { newsEntries } from "./news";

type Row = Parameters<typeof newsEntries>[0];
const news = (o: Partial<Row> = {}): Row => ({
  $id: "n1",
  $createdAt: "2026-10-01T00:00:00Z",
  slug: "hello",
  status: NewsStatus.PUBLISHED,
  campus_id: "2",
  department_id: null,
  image: "img1",
  ...o,
});

describe("newsEntries", () => {
  it("maps published news", () => {
    const e = newsEntries(news(), noText, ctx());
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({
      type: "news",
      url: "/news/hello",
      campus_id: "2",
      image: "img1",
      published_at: 1_790_812_800,
      department: null,
    });
  });
  it("hides drafts, slugless and untranslated", () => {
    expect(
      newsEntries(news({ status: NewsStatus.DRAFT }), noText, ctx())
    ).toEqual([]);
    expect(newsEntries(news({ slug: null }), noText, ctx())).toEqual([]);
    expect(newsEntries(news(), [], ctx())).toEqual([]);
  });
});
