import { describe, expect, test } from "bun:test";
import { emptyHeader } from "../header/empty-header";
import { DEFAULT_SECTION_LAYOUT } from "./sections";
import {
  AI_BODY_CHARS,
  AI_BODY_TOTAL_CHARS,
  bodyForAI,
  fromJSON,
  LAYOUT_VALUES,
  normalizePageDoc,
  pageStateForAI,
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
/** A block line's `body=` value: the JSON string and anything after it. */
const BODY_VALUE = / body=("(?:[^"\\]|\\.)*")(.*)$/;
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

  /** The page-state line of the text block `b-1` with `body` (none when undefined). */
  const lineWithBody = (body: unknown): string => {
    const d = doc(section("s-1", "1", [["b-1"]]));
    const [b1] = d.sections[0].columns[0].blocks;
    if (body === undefined) {
      Reflect.deleteProperty(b1, "body");
    } else {
      Object.assign(b1, { body });
    }
    const line = serializePageForAI(d, null)
      .split("\n")
      .find((l) => l.includes("[b-1]"));
    if (!line) {
      throw new Error("no line for b-1");
    }
    return line;
  };

  /** The body preview a line shows, decoded, and the note after it. */
  const previewOf = (line: string): { note: string; preview: string } => {
    const match = BODY_VALUE.exec(line);
    if (!match) {
      throw new Error(`no body on ${line}`);
    }
    return { note: match[2], preview: JSON.parse(match[1]) as string };
  };

  test("the AI sees every text block's body, selected or not", () => {
    const lines = serializePageForAI(
      doc(section("s-1", "1", [["b-1", "b-2"]])),
      "b-2"
    ).split("\n");
    const body =
      'body="<h2>Section heading</h2><p>Tell the story like you\'d tell a friend.</p>"';
    expect(lines.find((l) => l.includes("[b-1]"))).toContain(body);
    expect(lines.find((l) => l.includes("[b-2]"))).toContain(body);
  });

  test("a legacy body is shown as the HTML it renders", () => {
    expect(
      lineWithBody([
        { text: "T", type: "h" },
        { text: "a", type: "li" },
      ])
    ).toContain('body="<h2>T</h2><ul><li>a</li></ul>"');
  });

  test("a long body is cut after an end tag, with a note saying so", () => {
    const body = "<p>abcdefgh</p>".repeat(300);
    expect(body).toHaveLength(4500);
    const line = lineWithBody(body);
    const { note, preview } = previewOf(line);
    expect(preview).toBe("<p>abcdefgh</p>".repeat(133));
    expect(preview).toHaveLength(1995);
    expect(note).toStartWith(
      " (cut: the first 1995 of 4500 characters; set_prop body replaces all of it"
    );
    expect(note).toContain(
      "ask the volunteer to select this block before you rewrite part of it)"
    );
  });

  test("a body with no end tag before the limit is cut at the limit", () => {
    const body = `<p><a href="https://biso.no/${"x".repeat(3000)}">l</a></p>`;
    const { note, preview } = previewOf(lineWithBody(body));
    expect(preview).toHaveLength(AI_BODY_CHARS);
    expect(preview).toBe(body.slice(0, AI_BODY_CHARS));
    expect(note).toContain(`(cut: the first 2000 of ${body.length} characters`);
  });

  test("a body of exactly the limit is shown whole", () => {
    const body = `<p>${"x".repeat(1993)}</p>`;
    expect(body).toHaveLength(AI_BODY_CHARS);
    const line = lineWithBody(body);
    expect(previewOf(line)).toEqual({ note: "", preview: body });
    expect(line).not.toContain("(cut:");
  });

  test("an empty or missing body shows as empty", () => {
    expect(lineWithBody("")).toContain('body=""');
    expect(lineWithBody(undefined)).toContain('body=""');
  });

  test("the selected block's full props still hold its whole body", () => {
    const d = doc(section("s-1", "1", [["b-1"]]));
    const body = "<p>abcdefgh</p>".repeat(300);
    Object.assign(d.sections[0].columns[0].blocks[0], { body });
    const out = serializePageForAI(d, "b-1");
    expect(out).toContain("(cut: the first 1995 of 4500 characters");
    expect(out).toContain(`"body": ${JSON.stringify(body)}`);
  });

  test("a cut with no end tag drops a trailing high surrogate", () => {
    // The emoji's high surrogate is character 2000, its low one 2001.
    const body = `<p>${"x".repeat(1996)}😀</p>`;
    const { note, preview } = previewOf(lineWithBody(body));
    expect(preview).toBe(`<p>${"x".repeat(1996)}`);
    expect(note).toContain(`(cut: the first 1999 of ${body.length} characters`);
  });

  /** A one-column page of text blocks b-1, b-2, … holding `bodies`, and its lines by id. */
  const pageWithBodies = (
    bodies: string[],
    selection: string | null = null
  ) => {
    const ids = bodies.map((_, i) => `b-${i + 1}`);
    const d = doc(section("s-1", "1", [ids]));
    for (const [i, b] of d.sections[0].columns[0].blocks.entries()) {
      Object.assign(b, { body: bodies[i] });
    }
    const out = serializePageForAI(d, selection);
    const lines = out.split("\n");
    const lineOf = (id: string): string =>
      lines.find((l) => l.includes(`[${id}]`)) ?? "";
    return { lineOf, out };
  };

  test("past the page's body budget, later blocks show only their length", () => {
    const full = `<p>${"x".repeat(1993)}</p>`;
    const long = "<p>abcdefgh</p>".repeat(300);
    const bodies = [
      ...new Array<string>(AI_BODY_TOTAL_CHARS / AI_BODY_CHARS).fill(full),
      long,
      "<p>a</p>",
      "",
    ];
    const { lineOf, out } = pageWithBodies(bodies, "b-11");
    for (let i = 1; i <= 10; i += 1) {
      expect(lineOf(`b-${i}`)).toContain(` body=${JSON.stringify(full)}`);
    }
    expect(lineOf("b-11")).toContain(
      " body=(4500 characters, select the block to read it)"
    );
    // Spent in document order: a short body after the budget is gone waits too.
    expect(lineOf("b-12")).toContain(
      " body=(8 characters, select the block to read it)"
    );
    // An empty body costs nothing.
    expect(lineOf("b-13")).toContain(' body=""');
    // The selected block's full props still hold its whole body.
    expect(out).toContain(`"body": ${JSON.stringify(long)}`);
  });

  test("the page state names the unselected text blocks whose body it cuts or withholds", () => {
    const full = `<p>${"x".repeat(1993)}</p>`;
    const long = "<p>abcdefgh</p>".repeat(300);
    const bodies = [
      long,
      ...new Array<string>(AI_BODY_TOTAL_CHARS / AI_BODY_CHARS - 1).fill(full),
      "<p>a</p>",
      long,
      "",
    ];
    const ids = bodies.map((_, i) => `b-${i + 1}`);
    const d = doc(section("s-1", "1", [ids]));
    for (const [i, b] of d.sections[0].columns[0].blocks.entries()) {
      Object.assign(b, { body: bodies[i] });
    }
    // b-1 is cut; b-11 and b-12 are withheld once the budget runs out; b-12
    // is selected, so its full props show it whole.
    const state = pageStateForAI(d, "b-12");
    expect([...state.partBodies]).toEqual(["b-1", "b-11"]);
    expect(state.text).toBe(serializePageForAI(d, "b-12"));
  });

  test("a page under the body budget shows every body as on its own", () => {
    const bodies = [
      "<p>abcdefgh</p>".repeat(300),
      "<h2>T</h2><p>short</p>",
      `<p><a href="https://biso.no/${"x".repeat(3000)}">l</a></p>`,
    ];
    const { lineOf } = pageWithBodies(bodies);
    for (const [i, body] of bodies.entries()) {
      expect(lineOf(`b-${i + 1}`)).toContain(` body=${bodyForAI(body)}`);
    }
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

  test("an image keeps its mime type when it is a string", () => {
    expect(
      withImage({ mime: "image/svg+xml", src: "https://x/y" })?.backgroundImage
    ).toEqual({ mime: "image/svg+xml", src: "https://x/y" });
    expect(withImage({ mime: 4, src: "https://x/y" })?.backgroundImage).toEqual(
      { src: "https://x/y" }
    );
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
        mime: "video/mp4",
        poster: "https://x.no/p.jpg",
        posterFileId: "f-2",
        posterMime: "image/gif",
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
        media: { kind: "gif", mime: 3, src: "https://x.no/a.jpg", alt: 3 },
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

test("the AI view shows the department's theme on a page that has none of its own", () => {
  const d = doc(section("s-1", "1", [["b-1"]]));
  d.meta = { ...d.meta, department: "dep-1" };
  d.meta = { ...d.meta, theme: undefined };
  const text = serializePageForAI(d, null, [
    {
      campusId: null,
      id: "dep-1",
      name: "Dept",
      theme: { accent: "#3aa3e1", dark: "#112233" },
    },
  ]);
  expect(text).toContain(
    "theme: dark #112233, accent #3aa3e1 (from the department)"
  );
});
