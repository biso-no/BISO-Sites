import { describe, expect, it } from "vitest";
import { pageDocText } from "./page-text";

const doc = {
  version: 2,
  meta: { title: "Winter Games", slug: "projects/winter-games" },
  header: {
    title: "Winter Games",
    lede: "<p>Three days in <b>Hafjell</b></p>",
    eyebrow: "",
    crumbs: [{ label: "Projects", href: "/projects" }],
    buttons: [],
    variant: "split",
  },
  sections: [
    {
      id: "s1",
      layout: "one",
      columns: [
        {
          id: "c1",
          blocks: [
            {
              id: "b1",
              type: "text",
              props: {
                body: "<p>Bring your student card &amp; a costume.</p>",
              },
            },
            {
              id: "b2",
              type: "image",
              props: { src: "https://x/y.png", alt: "Bus" },
            },
          ],
        },
      ],
    },
  ],
};

describe("pageDocText", () => {
  it("collects searchable text from a page document", () => {
    expect(pageDocText(doc)).toBe(
      "Winter Games Three days in Hafjell Projects Bring your student card & a costume."
    );
  });

  it("returns empty for non-documents", () => {
    expect(pageDocText(null)).toBe("");
    expect(pageDocText("garbage")).toBe("");
  });

  it("truncates to maxLength", () => {
    expect(
      pageDocText({ sections: [{ text: "a ".repeat(3000) }] }, 100).length
    ).toBeLessThanOrEqual(101);
  });
});
