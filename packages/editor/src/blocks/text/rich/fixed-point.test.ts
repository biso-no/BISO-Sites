import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { TEXT_COLOUR_TOKENS } from "@repo/shared/utils/text-colours";
import { Window } from "happy-dom";
import type { Descendant, TElement, TText, Value } from "platejs";
import { scanBody } from "@/editor/body-scan";
import { htmlToValue, valueToHtml } from "./html";

// `server-only` throws outside a react-server build, which a test is not.
mock.module("server-only", () => ({}));
const { sanitizeRichBodyHtml } = await import("@/editor/sanitize-doc");

const previous = { Node: globalThis.Node, document: globalThis.document };

beforeAll(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
});

afterAll(() => {
  Object.assign(globalThis, previous);
});

// Park–Miller "minimal standard": the same values on every run.
const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;
const SEED = 20_261_103;

const WORD_CHARS = ["a", "b", "&", "<", ">", '"', " "] as const;
/** A space three times as often as a line break. */
const SEPARATORS = [" ", " ", " ", "\n"] as const;
const MARKS = ["bold", "italic", "underline", "strikethrough"] as const;
const COLOURS = [...TEXT_COLOUR_TOKENS, "pink"] as const;
const URLS = [
  "https://biso.no",
  "/events",
  "mailto:it@biso.no",
  "javascript:x",
] as const;
const BLOCKS = ["p", "h2", "h3", "blockquote", "hr", "list", "table"] as const;
const LIST_STYLES = ["disc", "decimal"] as const;

function randomValues(count: number): Value[] {
  let state = SEED;
  const next = (): number => {
    state = (state * MULTIPLIER) % MODULUS;
    return state;
  };
  /** From `min` to `max`, both included. */
  const int = (min: number, max: number): number =>
    min + (next() % (max - min + 1));
  const chance = (): boolean => int(0, 1) === 1;
  const pick = <T>(items: readonly T[]): T =>
    items[int(0, items.length - 1)] as T;

  /**
   * Words joined by one separator each: already collapsed as HTML collapses
   * it (no space at either end, none doubled, none beside a line break).
   */
  const blockText = (): string => {
    const words = Array.from({ length: int(1, 5) }, () =>
      Array.from({ length: int(1, 3) }, () => pick(WORD_CHARS)).join("")
    );
    return words.reduce((text, word) => `${text}${pick(SEPARATORS)}${word}`);
  };

  /** The text cut anywhere into one to four non-empty pieces. */
  const pieces = (text: string): string[] => {
    const count = int(1, Math.min(4, text.length));
    const cuts = new Set<number>();
    while (cuts.size < count - 1) {
      cuts.add(int(1, text.length - 1));
    }
    const ends = [...cuts].sort((a, b) => a - b);
    return [0, ...ends].map((start, i) => text.slice(start, ends[i]));
  };

  const leaf = (text: string): TText => {
    const node: TText = { text };
    for (const mark of MARKS) {
      if (chance()) {
        node[mark] = true;
      }
    }
    if (chance()) {
      node.color = pick(COLOURS);
    }
    return node;
  };

  /** Some runs of leaves sit inside a link. */
  const inline = (): Descendant[] => {
    const leaves = pieces(blockText()).map(leaf);
    const nodes: Descendant[] = [];
    let at = 0;
    while (at < leaves.length) {
      if (int(0, 2) === 0) {
        const end = int(at + 1, leaves.length);
        nodes.push({
          type: "a",
          url: pick(URLS),
          children: leaves.slice(at, end),
        });
        at = end;
      } else {
        nodes.push(leaves[at] as TText);
        at += 1;
      }
    }
    return nodes;
  };

  const listItem = (): TElement => {
    const listStyleType = pick(LIST_STYLES);
    const item: TElement = {
      type: "p",
      indent: int(1, 3),
      listStyleType,
      children: inline(),
    };
    if (listStyleType === "decimal") {
      item.listStart = int(1, 5);
    }
    return item;
  };

  /** Some cells span 1 to 3 columns or rows, as Plate's merge writes it. */
  const cell = (type: "td" | "th"): TElement => {
    const node: TElement = {
      type,
      children: Array.from({ length: int(1, 2) }, () => ({
        type: "p",
        children: inline(),
      })),
    };
    if (int(0, 3) === 0) {
      node.colSpan = int(1, 3);
    }
    if (int(0, 3) === 0) {
      node.rowSpan = int(1, 3);
    }
    return node;
  };

  /** 1 to 4 rows of 1 to 4 cells; the first is a header row half the time. */
  const table = (): TElement => {
    const header = chance();
    return {
      type: "table",
      children: Array.from({ length: int(1, 4) }, (_, row) => ({
        type: "tr",
        children: Array.from({ length: int(1, 4) }, () =>
          cell(header && row === 0 ? "th" : "td")
        ),
      })),
    };
  };

  const blocks = (): TElement[] => {
    const kind = pick(BLOCKS);
    if (kind === "hr") {
      return [{ type: "hr", children: [{ text: "" }] }];
    }
    if (kind === "list") {
      return Array.from({ length: int(1, 4) }, listItem);
    }
    if (kind === "table") {
      return [table()];
    }
    return [{ type: kind, children: inline() }];
  };

  return Array.from({ length: count }, () =>
    Array.from({ length: int(1, 6) }, blocks).flat()
  );
}

const VALUES = randomValues(2000);
/** A list nested in a list item, as it ends. */
const NESTED_LIST_END = /<\/li><\/(?:ol|ul)><\/li>/;

test("the random values hold every feature the serializer writes", () => {
  const html = VALUES.map(valueToHtml).join("");
  for (const feature of [
    ...TEXT_COLOUR_TOKENS.map((token) => `<span data-color="${token}">`),
    '<a href="https://biso.no">',
    '<a href="/events">',
    '<a href="mailto:it@biso.no">',
    "<strong><em><u><s>",
    '<ol start="',
    "<ul><li>",
    "<h2>",
    "<h3>",
    "<blockquote>",
    "<hr>",
    "<table><thead><tr><th",
    "<table><tbody><tr><td",
    "</td></tr><tr><td",
    "<td></td>",
    ' colspan="2"',
    ' colspan="3"',
    ' rowspan="2"',
    ' rowspan="3"',
    "<br>",
    " ",
    "&amp;",
    "&lt;",
    "&gt;",
    '"',
  ]) {
    expect(html).toContain(feature);
  }
  expect(html).toMatch(NESTED_LIST_END);
  // A span of 1 is redundant and left out.
  expect(html).not.toContain('span="1"');
  expect(html).not.toContain("javascript:");
  expect(html).not.toContain("pink");
});

test("2,000 random values serialize to a fixed point the server leaves alone", () => {
  for (const value of VALUES) {
    const once = valueToHtml(value);
    expect({ again: valueToHtml(htmlToValue(once)), once }).toEqual({
      again: once,
      once,
    });
    expect(sanitizeRichBodyHtml(once)).toBe(once.replaceAll(" ", "&nbsp;"));
    expect(scanBody(once, 100)).toBe("canonical");
  }
}, 60_000);
