import { expect, test } from "bun:test";
import { scanBody, textLines } from "./body-scan";

const CANONICAL = [
  '<h2>T</h2><p>a <strong>b</strong> <a href="https://biso.no?a=1&amp;b=2">l</a><br>c</p>',
  '<ul><li>x<ul><li>y</li></ul></li></ul><ol start="3"><li>z</li></ol><hr><blockquote>q &gt; r</blockquote>',
  "plain text, no tags",
  "",
];

test.each(CANONICAL)("accepts what the editor writes: %s", (html) =>
  expect(scanBody(html, 100)).toBe("canonical"));

test.each([
  "<P>x</P>",
  "<a href='x'>y</a>",
  "<a href=x>y</a>",
  '<p class="x">y</p>',
  '<p href="x">y</p>',
  "<br/>",
  "a</br>b",
  "<!-- c -->",
  "<!doctype html><p>x</p>",
  "<script>x</script>",
  "<div>x</div>",
  "<p>a > b</p>",
  '<a href="<">x</a>',
  "<b><i>x</b></i>",
  "<p>x",
  "x</p>",
  "<p >x</p>",
  "<p\n>x</p>",
  '<a  href="x">y</a>',
])("rejects anything else: %s", (html) =>
  expect(scanBody(html, 100)).toBe("other"));

test("depth is exact", () => {
  expect(scanBody(`${"<b>".repeat(100)}x${"</b>".repeat(100)}`, 100)).toBe(
    "canonical"
  );
  expect(scanBody(`${"<b>".repeat(101)}x${"</b>".repeat(101)}`, 100)).toBe(
    "too-deep"
  );
});

test("linear on any input", () => {
  for (const html of [
    "<p>a <strong>b</strong></p>".repeat(100_000),
    "<b>".repeat(200_000),
    "<b".repeat(200_000),
  ]) {
    const started = performance.now();
    scanBody(html, 100);
    expect(performance.now() - started).toBeLessThan(100);
  }
});

test("text lines split at blocks and keep entities as written", () => {
  expect(
    textLines("<h2>T</h2><p>a <b>b</b> &amp; c<br>d</p><ul><li>e</li></ul> f")
  ).toEqual(["T", "a b &amp; c", "d", "e", "f"]);
});

test("text lines drop raw text, comments and unterminated tags; a bare < is text", () => {
  expect(textLines("<p>a</p><SCRIPT>if (a < b) {}</SCRIPT><p>b</p>")).toEqual([
    "a",
    "b",
  ]);
  expect(textLines("a<!-- <p> -->b")).toEqual(["ab"]);
  expect(textLines("<p>a < b</p><p>c<b")).toEqual(["a < b", "c"]);
});
