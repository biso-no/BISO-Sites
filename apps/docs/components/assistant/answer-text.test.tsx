import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerText, citedSources } from "./answer-text";

const SOURCES = [
  { n: 1, title: "How recruitment works", url: "/guide/recruitment" },
  { n: 2, title: "Book interviews", url: "/guide/recruitment/book" },
];

const SOURCE_2_LINK = /<a[^>]*href="\/guide\/recruitment\/book"[^>]*>\[2\]/;
const LIST_ITEM = /<li/g;
const BOLD_JOBS = /<strong[^>]*>Jobs<\/strong>/;
const SR_ONLY = /<span class="sr-only">[^<]*<\/span>/g;
const TAG = /<[^>]+>/g;
const LINK_OPEN = /<a /g;
const WARN_CALLOUT =
  /<div class="[^"]*border-sun[^"]*">([\s\S]*?)<\/div><\/div>/;

function html(text: string): string {
  return renderToStaticMarkup(<AnswerText sources={SOURCES} text={text} />);
}

test("markup in the answer renders as escaped text", () => {
  const out = html("<script>alert(1)</script>");
  expect(out).not.toContain("<script");
  expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("[2] links to source 2", () => {
  expect(html("Choose Pipeline [2].")).toMatch(SOURCE_2_LINK);
});

test("a Watch out: line renders inside the warn callout", () => {
  const out = html("Open the vacancy.\nWatch out: the link expires.");
  const callout = out.match(WARN_CALLOUT)?.[1] ?? "";
  expect(callout).toContain("Watch out:");
  expect(callout).toContain("the link expires.");
  expect(callout).not.toContain("Open the vacancy.");
});

test("numbered lines render as an ordered list", () => {
  const out = html("Do this:\n1. In **Jobs**, open it.\n2. Choose Pipeline.");
  expect(out).toContain("<ol");
  expect(out.match(LIST_ITEM)).toHaveLength(2);
  expect(out).toMatch(BOLD_JOBS);
});

test("a citation stays on the line of the word before it", () => {
  expect(html("Choose Pipeline [2].")).toContain("Pipeline <a");
});

test("a list that starts past 1 keeps its numbering", () => {
  expect(html("3. Save it.")).toContain('start="3"');
});

test("a citation with no matching source stays text", () => {
  const out = html("See [9].");
  expect(out).toContain("[9]");
  expect(out).not.toContain("<a");
});

test("links and html in the answer are not followed", () => {
  const out = html(
    '[click](javascript:alert(1)) <a href="https://x.test">x</a>'
  );
  expect(out).not.toContain("<a");
  expect(out).not.toContain('href="javascript');
});

test("a grouped citation links each source", () => {
  const out = html("Both apply [1, 2].");
  expect(out).toContain('href="/guide/recruitment"');
  expect(out).toContain('href="/guide/recruitment/book"');
});

function visibleText(out: string): string {
  return out.replace(SR_ONLY, "").replace(TAG, "");
}

test("a group keeps its commas and an unmatched number stays text", () => {
  const out = html("Both [1, 9].");
  expect(visibleText(out)).toBe("Both\u00a0[1, 9].");
  expect(out.match(LINK_OPEN)).toHaveLength(1);
});

test("a repeated number in a group links once", () => {
  const out = html("Twice [2, 2].");
  expect(out.match(LINK_OPEN)).toHaveLength(1);
  expect(out).toMatch(SOURCE_2_LINK);
});

/** Each of these is rejected; several resolve to another origin. */
const NOT_DOCS_PATHS = [
  "/\\evil.test/x",
  "/\t/evil.test/x",
  "/\n/evil.test",
  "//evil.test",
  "https://evil.test",
  "javascript:alert(1)",
  "/.//evil",
  "/..//evil",
  "/a/..//evil",
  "/x/../..//evil.test/x",
  "%2F%2Fevil",
  "/a?b=1",
];

test("a source that isn't a docs page path is never linked", () => {
  for (const url of NOT_DOCS_PATHS) {
    const sources = [{ n: 1, title: "Off", url }];
    expect(
      renderToStaticMarkup(<AnswerText sources={sources} text="See [1]." />)
    ).not.toContain("<a");
    expect(citedSources("See [1].", sources)).toEqual([]);
  }
});

test("cited sources are only those cited, and none when nothing is", () => {
  expect(citedSources("Do it [2].", SOURCES).map((s) => s.n)).toEqual([2]);
  expect(citedSources("No citations.", SOURCES)).toEqual([]);
  expect(citedSources("Only [7].", SOURCES)).toEqual([]);
});
