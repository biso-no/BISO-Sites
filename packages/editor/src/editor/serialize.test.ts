import { describe, expect, test } from "bun:test";
import { emptyHeader } from "../header/empty-header";
import { DEFAULT_SECTION_LAYOUT } from "./sections";
import {
  fromJSON,
  LAYOUT_VALUES,
  normalizePageDoc,
  serializePageForAI,
} from "./serialize";
import { block, doc, section } from "./test-fixtures";
import type {
  PageDoc,
  PageHeader,
  SectionAlign,
  SectionBackground,
  SectionColumns,
  SectionLayout,
  SectionSpacing,
  SectionTablet,
} from "./types";

const SELECTED_TEXT_BLOCK = /\[b-2\] type=text.*← SELECTED/;
const SECTION_ID = /^s-/;
const COLUMN_ID = /^c-/;

describe("normalizePageDoc", () => {
  test("an old flat document becomes an empty v2 page with its meta", () => {
    const d = doc();
    const old = { blocks: [block("b-9")], meta: d.meta } as unknown as PageDoc;
    expect(normalizePageDoc(old)).toEqual({
      meta: d.meta,
      sections: [],
      version: 2,
    });
  });

  test("missing layout fields take the defaults", () => {
    const partial = doc({
      ...section("s-1", "1", [["b-1"]]),
      layout: { columns: "1" } as SectionLayout,
    });
    expect(normalizePageDoc(partial).sections[0].layout).toEqual(
      DEFAULT_SECTION_LAYOUT
    );
  });

  test("a two-column layout with one stored column gets an empty second column", () => {
    const s = section("s-1", "1", [["b-1"]]);
    const n = normalizePageDoc(
      doc({ ...s, layout: { ...s.layout, columns: "1-1" } })
    );
    expect(n.sections[0].columns.map((c) => c.blocks.length)).toEqual([1, 0]);
  });

  test("extra columns merge into the last kept column", () => {
    const s = section("s-1", "1-1", [["b-1"], ["b-2"]]);
    const n = normalizePageDoc(
      doc({ ...s, layout: { ...s.layout, columns: "1" } })
    );
    expect(n.sections[0].columns).toHaveLength(1);
    expect(n.sections[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "b-1",
      "b-2",
    ]);
  });

  test("fromJSON normalizes", () => {
    const legacy = { blocks: [block("b-9")], meta: doc().meta };
    expect(fromJSON(JSON.stringify(legacy))).toEqual({
      meta: doc().meta,
      sections: [],
      version: 2,
    });
    const s = section("s-1", "1", [["b-1"]]);
    const padded = fromJSON(
      JSON.stringify(doc({ ...s, layout: { ...s.layout, columns: "1-1" } }))
    );
    expect(padded.sections[0].columns.map((c) => c.blocks.length)).toEqual([
      1, 0,
    ]);
  });

  test("null, non-object and id- or type-less blocks are dropped", () => {
    const d = doc(section("s-1", "1", [["b-1"]]));
    const kept = d.sections[0].columns[0].blocks[0];
    const n = normalizePageDoc({
      ...d,
      sections: [
        {
          ...d.sections[0],
          columns: [
            {
              blocks: [
                null,
                "text",
                7,
                { type: "text" },
                { id: "b-2" },
                { id: 3, type: "text" },
                kept,
              ],
              id: "s-1-c0",
            },
          ],
        },
      ],
    } as unknown as PageDoc);
    expect(n.sections[0].columns[0].blocks).toEqual([kept]);
  });

  test("sections and columns without a string id get a fresh one", () => {
    const d = doc(section("s-1", "1-1", [["b-1"], ["b-2"]]));
    const s = d.sections[0];
    const n = normalizePageDoc({
      ...d,
      sections: [
        {
          ...s,
          columns: [
            { blocks: s.columns[0].blocks },
            { ...s.columns[1], id: 4 },
          ],
          id: undefined,
        },
      ],
    } as unknown as PageDoc);
    const [only] = n.sections;
    expect(only.id).toMatch(SECTION_ID);
    expect(only.columns.map((c) => c.id)).toEqual([
      expect.stringMatching(COLUMN_ID),
      expect.stringMatching(COLUMN_ID),
    ]);
    expect(only.columns[0].id).not.toBe(only.columns[1].id);
    expect(only.columns.map((c) => c.blocks.map((b) => b.id))).toEqual([
      ["b-1"],
      ["b-2"],
    ]);
  });

  test("a non-object layout takes the defaults", () => {
    const d = doc(section("s-1", "1", [["b-1"]]));
    const n = normalizePageDoc({
      ...d,
      sections: [{ ...d.sections[0], layout: "wide" }],
    } as unknown as PageDoc);
    expect(n.sections[0].layout).toEqual(DEFAULT_SECTION_LAYOUT);
  });

  test("an unknown column preset follows the stored column count", () => {
    const three = section("s-1", "1-1-1", [["b-1"], ["b-2"], ["b-3"]]);
    const n = normalizePageDoc(
      doc({ ...three, layout: { ...three.layout, columns: "5" as never } })
    );
    expect(n.sections[0].layout.columns).toBe("1-1-1");
    expect(n.sections[0].columns.map((c) => c.blocks.map((b) => b.id))).toEqual(
      [["b-1"], ["b-2"], ["b-3"]]
    );

    const five = section("s-2", "1", [["b-1"], ["b-2"], [], [], ["b-5"]]);
    const m = normalizePageDoc(
      doc({ ...five, layout: { ...five.layout, columns: "5" as never } })
    );
    expect(m.sections[0].layout.columns).toBe("1");
    expect(m.sections[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "b-1",
      "b-2",
      "b-5",
    ]);
  });

  test("a missing layout keeps the stored columns instead of collapsing them", () => {
    const s = section("s-1", "1-1", [["b-1"], ["b-2"]]);
    const n = normalizePageDoc(
      doc({ ...s, layout: undefined as unknown as SectionLayout })
    );
    expect(n.sections[0].layout).toEqual({
      ...DEFAULT_SECTION_LAYOUT,
      columns: "1-1",
    });
    expect(n.sections[0].columns.map((c) => c.blocks.map((b) => b.id))).toEqual(
      [["b-1"], ["b-2"]]
    );
  });

  test("unknown layout values fall back to the defaults", () => {
    const s = section("s-1", "1", [["b-1"]]);
    const n = normalizePageDoc(
      doc({
        ...s,
        layout: {
          ...s.layout,
          align: "start",
          background: "default",
          hideOnPhone: "yes",
          spacing: "roomy",
          tablet: "keep",
        } as unknown as SectionLayout,
      })
    );
    expect(n.sections[0].layout).toEqual({
      ...DEFAULT_SECTION_LAYOUT,
      spacing: "roomy",
    });
  });

  test("the input document is not mutated", () => {
    const s = section("s-1", "1-1", [["b-1"], ["b-2"]]);
    const input = doc(
      { ...s, layout: { ...s.layout, columns: "1" } },
      { ...section("s-2", "1", [["b-3"]]), layout: undefined as never }
    );
    const before = structuredClone(input);
    normalizePageDoc(input);
    expect(input).toEqual(before);
  });

  test("a section without a columns array renders as empty columns", () => {
    const d = doc(section("s-1", "1-1", [[], []]));
    const bad = { ...d.sections[0], columns: undefined };
    const n = normalizePageDoc({ ...d, sections: [bad] } as unknown as PageDoc);
    expect(n.sections[0].columns.map((c) => c.blocks.length)).toEqual([0, 0]);
    const str = { ...d.sections[0], columns: "nope" };
    const n2 = normalizePageDoc({
      ...d,
      sections: [str],
    } as unknown as PageDoc);
    expect(n2.sections[0].columns).toHaveLength(2);
  });

  test("a column without a blocks array becomes empty", () => {
    const d = doc(section("s-1", "1-1", [["b-1"], []]));
    const cols = [{ id: "x" }, { id: "y", blocks: "nope" }];
    const n = normalizePageDoc({
      ...d,
      sections: [{ ...d.sections[0], columns: cols }],
    } as unknown as PageDoc);
    expect(n.sections[0].columns.map((c) => c.blocks)).toEqual([[], []]);
  });

  test("non-object sections and columns are skipped", () => {
    const d = doc(section("s-1", "1-1", [["b-1"], ["b-2"]]));
    const s = d.sections[0];
    const n = normalizePageDoc({
      ...d,
      sections: [null, "x", { ...s, columns: [null, 5, s.columns[0]] }],
    } as unknown as PageDoc);
    expect(n.sections).toHaveLength(1);
    expect(n.sections[0].columns).toHaveLength(2);
    expect(n.sections[0].columns[0].blocks.map((b) => b.id)).toEqual(["b-1"]);
  });
});

describe("serializePageForAI", () => {
  test("the AI sees the section and column structure", () => {
    const out = serializePageForAI(
      doc(section("s-1", "1-1", [["b-1"], ["b-2"]])),
      "b-2"
    );
    expect(out).toContain("sections: 1");
    expect(out).toContain("Section 1 [s-1] columns=1-1 background=white");
    expect(out).toContain("  Column 2 [s-1-c1]");
    expect(out).toMatch(SELECTED_TEXT_BLOCK);
  });
});

describe("LAYOUT_VALUES", () => {
  test("only holds valid union members (exhaustiveness is asserted in serialize.ts)", () => {
    const background: readonly SectionBackground[] = LAYOUT_VALUES.background;
    const columns: readonly SectionColumns[] = LAYOUT_VALUES.columns;
    const spacing: readonly SectionSpacing[] = LAYOUT_VALUES.spacing;
    const align: readonly SectionAlign[] = LAYOUT_VALUES.align;
    const tablet: readonly SectionTablet[] = LAYOUT_VALUES.tablet;
    expect(background).toEqual(["white", "tinted", "dark", "photo"]);
    expect(columns).toHaveLength(6);
    expect(spacing).toHaveLength(3);
    expect(align).toHaveLength(3);
    expect(tablet).toHaveLength(2);
  });

  test("normalizing a section keeps a dark background", () => {
    const result = normalizePageDoc({
      ...doc(),
      sections: [
        {
          columns: [],
          id: "s-1",
          layout: { ...DEFAULT_SECTION_LAYOUT, background: "dark" },
        },
      ],
    });
    expect(result.sections[0]?.layout.background).toBe("dark");
  });
});

describe("section background image", () => {
  const withImage = (backgroundImage: unknown) =>
    normalizePageDoc({
      ...doc(),
      sections: [
        {
          columns: [],
          id: "s-1",
          layout: {
            ...DEFAULT_SECTION_LAYOUT,
            background: "photo",
            backgroundImage,
          } as SectionLayout,
        },
      ],
    }).sections[0]?.layout;

  test("a Photo background and a valid image are kept", () => {
    const layout = withImage({
      alt: "Storefjell",
      fileId: "f-1",
      src: "https://cdn.example/storefjell.jpg",
    });
    expect(layout?.background).toBe("photo");
    expect(layout?.backgroundImage).toEqual({
      alt: "Storefjell",
      fileId: "f-1",
      src: "https://cdn.example/storefjell.jpg",
    });
  });

  test("an image without a string src is dropped", () => {
    for (const bad of ["oops", null, 42, {}, { src: 7 }, { alt: "x" }]) {
      expect(withImage(bad)).not.toHaveProperty("backgroundImage");
    }
  });

  test("an image keeps only its known string fields", () => {
    expect(
      withImage({ alt: 3, extra: "x", fileId: null, src: "https://x/y.jpg" })
        ?.backgroundImage
    ).toEqual({ src: "https://x/y.jpg" });
  });
});

describe("page header", () => {
  const withHeader = (header: unknown): PageDoc =>
    ({ ...doc(), header }) as unknown as PageDoc;

  test("a valid header is kept as it is", () => {
    const header: PageHeader = {
      ...emptyHeader("Fadderullan"),
      buttons: [{ href: "/join", label: "Bli med", style: "primary" }],
      crumbs: [{ href: "/units", label: "Enheter" }, { label: "Fadderullan" }],
      eyebrow: "BISO Oslo",
      lede: "Tre dager på Storefjell",
      media: {
        alt: "Studenter",
        fileId: "f-1",
        kind: "video",
        poster: "https://x.no/p.jpg",
        posterFileId: "f-2",
        src: "https://x.no/v.mp4",
      },
      variant: "split",
    };
    expect(normalizePageDoc(withHeader(header)).header).toEqual(header);
  });

  test("a header missing crumbs (or any field) takes the empty header's", () => {
    const n = normalizePageDoc(withHeader({ title: "Om oss" }));
    expect(n.header).toEqual(emptyHeader("Om oss"));
    expect(n.header?.crumbs).toEqual([]);
  });

  test("a non-object header is dropped", () => {
    for (const header of ["oops", 3, null, ["x"]]) {
      const n = normalizePageDoc(withHeader(header));
      expect(n.header).toBeUndefined();
      expect("header" in n).toBe(false);
    }
  });

  test("media without a string src is dropped", () => {
    const n = normalizePageDoc(
      withHeader({ ...emptyHeader("A"), media: { kind: "image" } })
    );
    expect(n.header).toBeDefined();
    expect(n.header?.media).toBeUndefined();
  });

  test("unknown values fall back and malformed list items are dropped", () => {
    const n = normalizePageDoc(
      withHeader({
        buttons: [
          { href: "/a", label: "A", style: "loud" },
          { label: "no href" },
          "x",
        ],
        crumbs: [{ label: "Ok", href: 4 }, { href: "/x" }, null],
        media: { kind: "gif", src: "https://x.no/a.jpg", alt: 3 },
        title: 7,
        variant: "centered",
      })
    );
    expect(n.header).toEqual({
      ...emptyHeader(),
      buttons: [{ href: "/a", label: "A", style: "primary" }],
      crumbs: [{ label: "Ok" }],
      media: { kind: "image", src: "https://x.no/a.jpg" },
    });
  });

  test("an old flat document drops its header with everything else", () => {
    const n = normalizePageDoc({
      blocks: [],
      header: emptyHeader("A"),
      meta: doc().meta,
    } as unknown as PageDoc);
    expect(n.header).toBeUndefined();
  });

  test("the AI sees the header, or that there is none", () => {
    expect(serializePageForAI(doc(), null)).toContain("header: none");
    const out = serializePageForAI(
      { ...doc(), header: { ...emptyHeader("Om oss"), variant: "split" } },
      null
    );
    expect(out).toContain('header: variant=split title="Om oss"');
    expect(out.indexOf("header:")).toBeLessThan(out.indexOf("== BLOCKS =="));
  });
});
