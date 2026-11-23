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

const enText = {
  locale: "en" as const,
  title: "Winter games",
  description: "<p>Three days</p>",
  short_description: null,
};

describe("newsEntries", () => {
  it("maps published news", () => {
    const e = newsEntries(news(), noText, ctx());
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({
      type: "news",
      url: "/news/hello",
      campus_id: "2",
      image: "img1",
      published_at: 1_790_812_800,
      department: null,
    });
  });
  it("indexes only the locales with their own translation", () => {
    // The news page reads the translation in the request locale only, so a
    // fallback entry would link to a 404.
    const [only] = newsEntries(news(), noText, ctx());
    expect(only).toMatchObject({ locale: "no", text_locale: "no" });
    const both = newsEntries(news(), [...noText, enText], ctx());
    expect(both.map((e) => [e.locale, e.text_locale, e.title])).toEqual([
      ["no", "no", "Vinterleker"],
      ["en", "en", "Winter games"],
    ]);
    expect(newsEntries(news(), [enText], ctx()).map((e) => e.locale)).toEqual([
      "en",
    ]);
  });

  it("hides drafts, slugless and untranslated", () => {
    expect(
      newsEntries(news({ status: NewsStatus.DRAFT }), noText, ctx())
    ).toEqual([]);
    expect(newsEntries(news({ slug: null }), noText, ctx())).toEqual([]);
    expect(newsEntries(news(), [], ctx())).toEqual([]);
  });
});
