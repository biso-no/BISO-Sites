import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { safeHref } from "../blocks/_v2/links";
import { sanitizeRichText } from "../lib/sanitize";
import { sanitizePageDocHtml, sanitizeRichHtml } from "./sanitize-doc";
import { block, doc, section } from "./test-fixtures";
import type { Block, PageDoc, TextBlock } from "./types";

/** A `<` that opens anything but an allowlisted tag. */
const OTHER_TAG = /<(?!\/?(?:b|strong|i|em|a|br|span)[\s>])/i;

describe("sanitizeRichHtml: script vectors", () => {
  test("drops an image that runs its error handler", () => {
    const out = sanitizeRichHtml("<img src=x onerror=alert(1)>");
    expect(out).not.toContain("<img");
    expect(out).toBe("");
  });

  test("removes a script together with its source", () => {
    expect(sanitizeRichHtml("<script>alert(1)</script>hei")).toBe("hei");
  });

  test("drops a javascript: href but keeps the link text", () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      "<a>x</a>"
    );
  });

  test("strips event handlers from allowed tags", () => {
    expect(sanitizeRichHtml('<span onclick="x">y</span>')).toBe(
      "<span>y</span>"
    );
    expect(sanitizeRichHtml('<b onmouseover="x" style="color:red">y</b>')).toBe(
      "<b>y</b>"
    );
  });

  test("removes an svg entirely", () => {
    expect(sanitizeRichHtml("<svg onload=x>")).toBe("");
  });

  test.each([
    ["<style>b{color:red}</style>ok"],
    ['<iframe src="https://evil.example">fallback</iframe>ok'],
    ['<object data="x.swf">fallback</object>ok'],
    ['<embed src="x.swf">ok'],
    ["<svg><text>label</text></svg>ok"],
    ["<math><mi>x</mi></math>ok"],
    ["<textarea>typed</textarea>ok"],
    ["<noscript>enable js</noscript>ok"],
    ["<template><b>hidden</b></template>ok"],
  ])("removes %p with its content", (input) => {
    expect(sanitizeRichHtml(input)).toBe("ok");
  });

  test.each([
    ["data:text/html,<script>alert(1)</script>"],
    [" JaVaScRiPt:alert(1)"],
    ["java&#x09;script:alert(1)"],
    ["&#106;avascript:alert(1)"],
    ["vbscript:msgbox(1)"],
    ["ftp://files.example"],
    ["om-oss"],
    [""],
  ])("drops the unsafe or unanchored href %p", (href) => {
    expect(sanitizeRichHtml(`<a href="${href}">x</a>`)).toBe("<a>x</a>");
  });

  test("drops every attribute but href, even on links", () => {
    expect(
      sanitizeRichHtml(
        '<a href="/om-oss" target="_blank" onclick="x" style="x">x</a>'
      )
    ).toBe('<a href="/om-oss">x</a>');
  });

  test("drops comments", () => {
    expect(sanitizeRichHtml("a<!-- <img src=x onerror=alert(1)> -->b")).toBe(
      "ab"
    );
  });

  // Parser-differential and obfuscation vectors. Whatever text survives, a
  // browser parsing the output must find nothing but the allowlist.
  const VECTORS = [
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    "<svg><style><img src=x onerror=alert(1)></style></svg>",
    "<svg/>after",
    "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
    '<a href="jav&#x0A;ascript:alert(1)">x</a>',
    '<a href="&#x6A;&#x61;vascript:alert(1)">x</a>',
    "<<script>script>alert(1)<</script>/script>",
    "<scr<script>ipt>alert(1)</script>",
    "<img/src=x/onerror=alert(1)>",
    '<div><a href="/x" <img onerror=alert(1)>',
    '<a href="/x"onclick="y">z</a>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    "<iframe><img src=x onerror=alert(1)></iframe>",
    "<textarea></textarea><img src=x onerror=alert(1)>",
    "<xmp><img src=x onerror=alert(1)></xmp>",
    "<title><img src=x onerror=alert(1)></title>",
    "<!--><img src=x onerror=alert(1)>-->",
    "<![CDATA[><img src=x onerror=alert(1)>]]>",
    "<form><button formaction=javascript:alert(1)>x",
    '<a href="https://biso.no" xlink:href="javascript:alert(1)">x</a>',
    '<base href="javascript:/"><a href="x">y</a>',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    '<span style="background:url(javascript:alert(1))">x</span>',
    "<b>unclosed <i>tags",
    "</p>stray</div>",
    '<a href="/a"><a href="javascript:alert(1)">nested</a></a>',
  ];
  const ALLOWLIST = new Set(["b", "strong", "i", "em", "a", "br", "span"]);
  const window = new Window();

  test.each(
    VECTORS.map((html) => [html])
  )("%p parses to the allowlist only", (html) => {
    const out = sanitizeRichHtml(html);
    const host = window.document.createElement("div");
    host.innerHTML = out;

    for (const el of host.querySelectorAll("*")) {
      const tag = el.tagName.toLowerCase();
      expect(ALLOWLIST.has(tag)).toBe(true);
      for (const attr of el.attributes) {
        expect(`${tag}[${attr.name}]`).toBe("a[href]");
        expect(safeHref(attr.value)).not.toBeNull();
      }
    }
    expect(out).not.toMatch(OTHER_TAG);
  });
});

describe("sanitizeRichHtml: what the editor stores", () => {
  test("keeps inline formatting and a relative link unchanged", () => {
    const html = '<b>fet</b> <a href="/om-oss">lenke</a>';
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  test("keeps every allowed tag", () => {
    const html =
      "<b>b</b><strong>s</strong><i>i</i><em>e</em><span>sp</span>a<br>b";
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  test.each([
    ["https://biso.no/om-oss"],
    ["http://biso.no"],
    ["mailto:hei@biso.no"],
    ["tel:+4712345678"],
    ["#kontakt"],
    ["?side=2"],
    ["./arrangementer"],
    ["../om-oss"],
    ["//cdn.biso.no/fil.pdf"],
  ])("keeps the safe href %p", (href) => {
    const html = `<a href="${href}">x</a>`;
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  test("keeps the text of other disallowed tags", () => {
    expect(
      sanitizeRichHtml('<u>a</u><h1>b</h1><font color="red">c</font>')
    ).toBe("abc");
  });

  test("writes line breaks the way a browser serializes them", () => {
    expect(sanitizeRichHtml("a<br/>b<br />c<BR>d")).toBe("a<br>b<br>c<br>d");
  });

  test("escapes text and attributes the way a browser serializes them", () => {
    expect(sanitizeRichHtml("a &amp; b &lt;i&gt; \"q\" 's'")).toBe(
      "a &amp; b &lt;i&gt; \"q\" 's'"
    );
    expect(sanitizeRichHtml("a & b")).toBe("a &amp; b");
    // An entity and a raw no-break space (U+00A0) both come out as the entity.
    expect(sanitizeRichHtml("a&nbsp;b\u00a0c")).toBe("a&nbsp;b&nbsp;c");
    expect(sanitizeRichHtml('<a href="/s?a=1&amp;b=2">x</a>')).toBe(
      '<a href="/s?a=1&amp;b=2">x</a>'
    );
  });
});

describe("sanitizeRichHtml: lines typed with Enter", () => {
  test.each([
    ["one<div>two</div><div>three</div>", "one<br>two<br>three"],
    ["<div>only</div>", "only"],
    ["<p>a</p><p>b</p>", "a<br>b"],
    ["<p>a</p>\n<p>b</p>", "a\n<br>b"],
    ["one<div><br></div><div>two</div>", "one<br><br><br>two"],
    ["<div><div>x</div></div>", "x"],
    ["<div>a<div>b</div></div><div>c</div>", "a<br>b<br>c"],
    ["<b></b><div>x</div>", "<b></b><br>x"],
    ["<u></u><div>x</div>", "x"],
    ["a<div></div>", "a<br>"],
    [
      '<div class="x"><b>fet</b></div><p style="x">neste</p>',
      "<b>fet</b><br>neste",
    ],
    ["<b>a<div>b</div></b>", "<b>a<br>b</b>"],
  ])("%p becomes %p", (input, expected) => {
    expect(sanitizeRichHtml(input)).toBe(expected);
  });
});

describe("sanitizeRichHtml against the editor's browser sanitizer", () => {
  const previous = { Node: globalThis.Node, document: globalThis.document };

  beforeAll(() => {
    const window = new Window();
    globalThis.document = window.document as unknown as Document;
    globalThis.Node = window.Node as unknown as typeof Node;
  });

  afterAll(() => {
    globalThis.document = previous.document;
    globalThis.Node = previous.Node;
  });

  // Markup a contentEditable produces or a paste carries in. Script vectors
  // are left out on purpose: the server removes <script>/<svg> with their
  // content, where the browser sanitizer keeps the (inert) text.
  const corpus = [
    "Hei <b>der</b>",
    '<b>fet</b> <a href="/om-oss">lenke</a>',
    '<a href="https://biso.no" target="_blank" rel="noopener">x</a>',
    '<a href="mailto:hei@biso.no">skriv</a> eller <a href="tel:+47">ring</a>',
    '<a href="javascript:alert(1)">x</a>',
    '<span style="font-weight: 700;" class="x">y</span>',
    "one<div>two</div><div>three</div>",
    "<div>only</div>",
    "<p>a</p><p>b</p>",
    "<p>a</p>\n<p>b</p>",
    "one<div><br></div><div>two</div>",
    "<div>a<div>b</div></div><div>c</div>",
    "<b></b><div>x</div>",
    "a<div></div>",
    "<b>a<div>b</div></b>",
    '<u>a</u><h1>b</h1><font color="red">c</font>',
    "a &amp; b &lt;i&gt; \"q\" 's'",
    "a&nbsp;b",
    "a<!-- note -->b",
    "<img src=x onerror=alert(1)>",
    "<i>kursiv</i><br><em>vekt</em><strong>sterk</strong>",
  ];

  test.each(corpus.map((html) => [html]))("%p", (html) => {
    expect(sanitizeRichHtml(html)).toBe(sanitizeRichText(html));
  });

  test("the editor's blur leaves server output unchanged", () => {
    // A stored value that the blur handler rewrites would mark an untouched
    // block dirty and resave it on every focus.
    for (const html of corpus) {
      const stored = sanitizeRichHtml(html);
      expect(sanitizeRichText(stored)).toBe(stored);
      expect(sanitizeRichHtml(stored)).toBe(stored);
    }
  });
});

function textBlock(id: string, texts: string[]): TextBlock {
  return {
    body: texts.map((text) => ({ text, type: "p" as const })),
    id,
    type: "text",
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

describe("sanitizePageDocHtml", () => {
  function fixture(): PageDoc {
    const page = doc(
      section("s1", "1", [["s1-heading"]]),
      section("s2", "1-1", [["s2-left"], ["s2-right"]])
    );
    page.header = {
      buttons: [],
      crumbs: [],
      eyebrow: "<b>eyebrow</b>",
      lede: "",
      title: "Tittel",
      variant: "plain",
    };
    page.sections[0].columns[0].blocks = [
      block("s1-heading", "heading"),
      textBlock("s1-text", ['<b>fet</b> <a href="/om-oss">lenke</a>']),
    ];
    page.sections[1].columns[1].blocks = [
      block("s2-image", "image"),
      textBlock("s2-text", [
        "<img src=x onerror=alert(1)>hei",
        '<a href="javascript:alert(1)">x</a>',
      ]),
    ];
    return page;
  }

  test("cleans a text block nested in column 2 of section 2", () => {
    const out = sanitizePageDocHtml(fixture());
    const nested = out.sections[1].columns[1].blocks[1] as TextBlock;

    expect(nested.body.map((item) => item.text)).toEqual(["hei", "<a>x</a>"]);
    expect(nested.body.map((item) => item.type)).toEqual(["p", "p"]);
  });

  test("leaves every other block, the header and the meta identical", () => {
    const input = fixture();
    const out = sanitizePageDocHtml(input);

    expect(out.sections[0].columns[0].blocks[0]).toBe(
      input.sections[0].columns[0].blocks[0]
    );
    expect(out.sections[1].columns[1].blocks[0]).toBe(
      input.sections[1].columns[1].blocks[0]
    );
    expect(out.sections[0].columns[0].blocks[1]).toEqual(
      input.sections[0].columns[0].blocks[1]
    );
    expect(out.header).toBe(input.header);
    expect(out.meta).toBe(input.meta);
    expect(out.sections[1].layout).toBe(input.sections[1].layout);
  });

  test("never mutates its input", () => {
    const input = deepFreeze(fixture());
    const before = structuredClone(input);

    const out = sanitizePageDocHtml(input);

    expect(input).toEqual(before);
    expect(out).not.toBe(input);
    expect(out.sections).not.toBe(input.sections);
  });

  test("survives malformed documents from copilot or seed scripts", () => {
    const malformed = {
      meta: fixture().meta,
      sections: [
        null,
        "section",
        { id: "s-no-columns" },
        {
          columns: [
            null,
            { blocks: "not a list" },
            {
              blocks: [
                null,
                { body: "not a list", id: "t1", type: "text" },
                {
                  body: [
                    null,
                    "item",
                    { text: ["<img src=x onerror=alert(1)>"], type: "p" },
                    { text: 42, type: "p" },
                    { type: "p" },
                    { text: "<script>x</script>ok", type: "li" },
                  ],
                  id: "t2",
                  type: "text",
                },
              ],
            },
          ],
          id: "s-ok",
        },
      ],
      version: 2,
    } as unknown as PageDoc;

    const out = sanitizePageDocHtml(malformed);
    const sections = out.sections as unknown as Record<string, unknown>[];
    const column = (
      sections[3].columns as { blocks: Record<string, unknown>[] }[]
    )[2];

    expect(sections.slice(0, 3)).toEqual([
      null,
      "section",
      { id: "s-no-columns" },
    ] as unknown as Record<string, unknown>[]);
    expect(column.blocks[1]).toEqual({
      body: "not a list",
      id: "t1",
      type: "text",
    });
    expect(column.blocks[2].body).toEqual([
      null,
      "item",
      { text: "", type: "p" },
      { text: "", type: "p" },
      { text: "", type: "p" },
      { text: "ok", type: "li" },
    ]);
  });

  test("returns a document without sections as it was", () => {
    const legacy = {
      blocks: [textBlock("t", ["<img src=x onerror=alert(1)>"])],
      meta: fixture().meta,
    } as unknown as PageDoc;

    expect(sanitizePageDocHtml(legacy)).toEqual(legacy);
  });

  test("accepts the API's loosely typed document", () => {
    // `@repo/api/page-builder`'s PageDoc types sections as unknown[].
    const loose: { meta: PageDoc["meta"]; sections: unknown[]; version: 2 } = {
      meta: fixture().meta,
      sections: fixture().sections,
      version: 2,
    };
    const out = sanitizePageDocHtml(loose);
    const blocks = (out.sections as PageDoc["sections"])[1].columns[1]
      .blocks as Block[];

    expect((blocks[1] as TextBlock).body[0].text).toBe("hei");
  });
});
