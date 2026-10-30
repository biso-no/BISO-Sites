import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRIVATE_PLACEHOLDER,
  rankPages,
  redactPrivate,
  searchTerms,
  selectSources,
} from "./retrieve";

const PRIVATE_IMPORT = /lib\/private|\.\.\/private|\.\/private/;
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;

const page = (url: string, length: number) => ({
  url,
  title: url,
  text: "x".repeat(length),
});

test("redactPrivate replaces self-closing and paired Private tags, including multi-line", () => {
  const input = [
    'Open <Private name="a" label="Tenant id" /> first.',
    '<Private name="b" label="Key">',
    "secret value",
    "on two lines",
    "</Private>",
    "Then <Private name='c'>inline</Private> done.",
  ].join("\n");
  const out = redactPrivate(input);
  expect(out).toContain(PRIVATE_PLACEHOLDER);
  expect(out).not.toContain("<Private");
  expect(out).not.toContain("secret value");
  expect(out.split(PRIVATE_PLACEHOLDER).length - 1).toBe(3);
});

test("selectSources puts the current page first even when it ranks low", () => {
  const out = selectSources([page("/a", 10), page("/b", 10), page("/c", 10)], {
    currentUrl: "/c",
    maxSources: 6,
    maxChars: 1000,
  });
  expect(out.map((s) => s.url)).toEqual(["/c", "/a", "/b"]);
});

test("selectSources marks the current page, and only it", () => {
  const out = selectSources([page("/a", 10), page("/b", 10)], {
    currentUrl: "/b",
    maxSources: 6,
    maxChars: 1000,
  });
  expect(out.map((s) => [s.url, s.current])).toEqual([
    ["/b", true],
    ["/a", undefined],
  ]);
  const none = selectSources([page("/a", 10)], {
    maxSources: 6,
    maxChars: 1000,
  });
  expect(none[0]?.current).toBeUndefined();
});

test("selectSources dedupes by url and numbers from 1", () => {
  const out = selectSources([page("/a", 10), page("/a", 10), page("/b", 10)], {
    maxSources: 6,
    maxChars: 1000,
  });
  expect(out.map((s) => [s.n, s.url])).toEqual([
    [1, "/a"],
    [2, "/b"],
  ]);
});

test("selectSources never cuts a page and stops before the char limit", () => {
  const out = selectSources([page("/a", 60), page("/b", 50), page("/c", 30)], {
    maxSources: 6,
    maxChars: 100,
  });
  expect(out.map((s) => s.url)).toEqual(["/a", "/c"]);
  expect(out[0]?.text.length).toBe(60);
});

test("selectSources keeps the current page even when it alone exceeds maxChars", () => {
  const out = selectSources([page("/a", 10), page("/big", 500)], {
    currentUrl: "/big",
    maxSources: 6,
    maxChars: 100,
  });
  expect(out.map((s) => s.url)).toEqual(["/big"]);
});

test("selectSources respects maxSources", () => {
  const out = selectSources(
    [page("/a", 1), page("/b", 1), page("/c", 1), page("/d", 1)],
    { maxSources: 2, maxChars: 1000 }
  );
  expect(out).toHaveLength(2);
});

test("searchTerms drops question and stop words, punctuation and repeats", () => {
  expect(searchTerms("How do I publish a vacancy?")).toEqual([
    "publish",
    "vacancy",
  ]);
  expect(searchTerms("Who can scan member passes? Passes!")).toEqual([
    "scan",
    "member",
    "passes",
  ]);
});

test("searchTerms keeps words the index keeps whole, without a possessive 's", () => {
  expect(
    searchTerms("How do I reset a user's password in 24SevenOffice?")
  ).toEqual(["reset", "user", "password", "24sevenoffice"]);
  expect(searchTerms("What is the page-builder?")).toEqual(["page-builder"]);
});

test("searchTerms is empty when only stop words are left", () => {
  expect(searchTerms("How do I do it?")).toEqual([]);
  expect(searchTerms("?!")).toEqual([]);
});

const rankable = (url: string, title: string, text: string) => ({
  url,
  title,
  text,
});

test("rankPages puts the page holding more of the terms first", () => {
  const out = rankPages(
    [
      rankable("/a", "Scheduled jobs", "Sends the pushes that are due."),
      rankable("/b", "Local setup", "Run the apps on your computer."),
    ],
    ["run", "apps", "computer"]
  );
  expect(out.map((p) => p.url)).toEqual(["/b", "/a"]);
});

test("rankPages counts a term in the title once more", () => {
  const out = rankPages(
    [
      rankable("/jobs", "Scheduled jobs", "Send pushes to students."),
      rankable("/send", "Send an announcement", "Send a push to students."),
    ],
    ["send", "push", "students"]
  );
  expect(out.map((p) => p.url)).toEqual(["/send", "/jobs"]);
});

test("rankPages matches a term to any word it starts, as the index does", () => {
  const out = rankPages(
    [
      rankable("/a", "Other", "Nothing here."),
      rankable("/b", "Orders and refunds", "Refunds go back to the buyer."),
    ],
    ["refund", "order"]
  );
  expect(out.map((p) => p.url)).toEqual(["/b", "/a"]);
});

test("rankPages keeps the search order on a tie and with no terms", () => {
  const pages = [
    rankable("/a", "A", "alpha"),
    rankable("/b", "B", "alpha"),
    rankable("/c", "C", "alpha"),
  ];
  expect(rankPages(pages, ["alpha"]).map((p) => p.url)).toEqual([
    "/a",
    "/b",
    "/c",
  ]);
  expect(rankPages(pages, []).map((p) => p.url)).toEqual(["/a", "/b", "/c"]);
});

test("the assistant code, its panel and the ask route never import the private source", () => {
  const dirs = [
    import.meta.dir,
    join(import.meta.dir, "../../app/api/ask"),
    join(import.meta.dir, "../../components/assistant"),
  ];
  let read = 0;
  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      if (!SOURCE_FILE.test(file) || TEST_FILE.test(file)) {
        continue;
      }
      read += 1;
      const text = readFileSync(join(dir, file), "utf8");
      expect(text, file).not.toMatch(PRIVATE_IMPORT);
    }
  }
  // The assistant's ts files and the panel's tsx files were all read.
  expect(read).toBeGreaterThan(10);
});
