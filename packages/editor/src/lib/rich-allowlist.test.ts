import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { doc, section } from "../editor/test-fixtures";
import type { TextBlock } from "../editor/types";
import { parseInert, sanitizeRichBody, sanitizeRichText } from "./sanitize";

// `server-only` throws outside a react-server build, which a test is not.
mock.module("server-only", () => ({}));
const { sanitizePageDocHtml, sanitizeRichBodyHtml } = await import(
  "../editor/sanitize-doc"
);

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

/** Serialised the way a browser does, so `<br>` and `<br />` read the same. */
const norm = (html: string): string => parseInert(html).innerHTML;

const CASES: [string, string][] = [
  [
    "<ul><li>a<ul><li>b</li></ul></li></ul>",
    "<ul><li>a<ul><li>b</li></ul></li></ul>",
  ],
  ['<ol start="3"><li>a</li></ol>', '<ol start="3"><li>a</li></ol>'],
  ['<ol start="1"><li>a</li></ol>', "<ol><li>a</li></ol>"],
  ['<ol start="x"><li>a</li></ol>', "<ol><li>a</li></ol>"],
  ['<p style="color:red" class="x" id="y">t</p>', "<p>t</p>"],
  ['<a href="javascript:alert(1)">x</a>', "<a>x</a>"],
  [
    '<a href="https://biso.no" target="_blank">x</a>',
    '<a href="https://biso.no">x</a>',
  ],
  ['<a href=".x">x</a>', '<a href=".x">x</a>'],
  ['<a href="..x">x</a>', '<a href="..x">x</a>'],
  ['<a href="ht&#9;tps://x">x</a>', "<a>x</a>"],
  ['<a href="&#1;https://x">x</a>', "<a>x</a>"],
  [
    '<a href="HTTPS://biso.no/a:b">x</a>',
    '<a href="HTTPS://biso.no/a:b">x</a>',
  ],
  ['<a href="/a:b#c?d">x</a>', '<a href="/a:b#c?d">x</a>'],
  ['<a href="mailto:a@b.no">x</a>', '<a href="mailto:a@b.no">x</a>'],
  ['<a href="tel:+4712345678">x</a>', '<a href="tel:+4712345678">x</a>'],
  ["<script>alert(1)</script><style>p{}</style><p>ok</p>", "<p>ok</p>"],
  ["<h1>Big</h1><table><tr><td>c</td></tr></table>", "Bigc"],
  ["<img src=x onerror=alert(1)><p>t</p>", "<p>t</p>"],
  [
    "<p><u>u</u> <s>s</s></p><hr><blockquote>q</blockquote>",
    "<p><u>u</u> <s>s</s></p><hr><blockquote>q</blockquote>",
  ],
];

describe("body sanitisers", () => {
  test.each(CASES)("client and server agree on %s", (input, expected) => {
    expect(norm(sanitizeRichBody(input))).toBe(norm(expected));
    expect(norm(sanitizeRichBodyHtml(input))).toBe(norm(expected));
  });

  test("inline sanitisers are unchanged for legacy items", () => {
    expect(sanitizeRichText("a<p>b</p>")).toBe("a<br>b");
  });
});

describe("sanitizeDoc text-block branch", () => {
  test("cleans a string body and leaves legacy arrays on the old path", () => {
    const page = doc(section("s1", "1", [["t-new", "t-old"]]));
    const fresh: TextBlock = {
      body: "<script>alert(1)</script><p>hei</p>",
      id: "t-new",
      type: "text",
    };
    const legacy: TextBlock = {
      body: [{ text: "<img src=x onerror=alert(1)>hei", type: "p" }],
      id: "t-old",
      type: "text",
    };
    page.sections[0].columns[0].blocks = [fresh, legacy];

    const [outNew, outOld] = sanitizePageDocHtml(page).sections[0].columns[0]
      .blocks as TextBlock[];
    expect(outNew.body).toBe("<p>hei</p>");
    expect(outOld.body).toEqual([{ text: "hei", type: "p" }]);
  });
});
