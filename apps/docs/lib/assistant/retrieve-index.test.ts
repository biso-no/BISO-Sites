import { expect, test } from "bun:test";

// Runs the real search index over the real pages. `bunfig.toml` preloads
// fumadocs-mdx's Bun plugin, so the pages compile as they do in the build.
// Each question must bring its page into the first three sources.
const QUESTIONS: [question: string, page: string][] = [
  ["How do I publish a vacancy?", "/guide/recruitment/publish-a-vacancy"],
  ["How do I refund an order?", "/guide/shop/orders-and-refunds"],
  [
    "How do I send a push to students?",
    "/guide/announcements/send-an-announcement",
  ],
  ["How do I deploy?", "/developers/keep-it-running/deploying"],
  [
    "Who can scan member passes?",
    "/guide/members-and-benefits/scan-member-passes",
  ],
  [
    "How do I hand over a role account?",
    "/guide/access-and-settings/hand-over-a-role-account",
  ],
  ["How do I add a product to the shop?", "/guide/shop/add-a-product"],
  [
    "How do I import the attendee list for an event?",
    "/guide/events/run-the-event",
  ],
  [
    "How do I send a candidate a booking link?",
    "/guide/recruitment/book-interviews",
  ],
  [
    "How do I upload a new version of a document?",
    "/guide/departments-and-documents/documents",
  ],
  [
    "How do I run the apps on my own computer?",
    "/developers/change-it/local-setup",
  ],
  [
    "How do I restore from a backup?",
    "/developers/keep-it-running/backups-and-recovery",
  ],
  [
    "How do I rotate a secret?",
    "/developers/keep-it-running/secrets-and-environment",
  ],
  [
    "How do I preview a page before publishing it?",
    "/guide/pages-and-news/edit-a-page",
  ],
];

const SLOW_MS = 30_000;

test(
  "natural questions bring their page into the first three sources",
  async () => {
    const { retrieveSources } = await import("./retrieve");
    const misses: string[] = [];
    for (const [question, page] of QUESTIONS) {
      const top = (await retrieveSources(question))
        .slice(0, 3)
        .map((s) => s.url);
      if (!top.includes(page)) {
        misses.push(`${question} → ${top.join(", ")}`);
      }
    }
    expect(misses).toEqual([]);
  },
  SLOW_MS
);

test(
  "a question that matches no page finds no sources",
  async () => {
    const { retrieveSources } = await import("./retrieve");
    expect(await retrieveSources("qzxv")).toEqual([]);
  },
  SLOW_MS
);

test(
  "the page being read comes first and its text is redacted",
  async () => {
    const { PRIVATE_PLACEHOLDER, retrieveSources } = await import("./retrieve");
    const url = "/developers/start-here/getting-access";
    const sources = await retrieveSources(
      "What is the Infisical address?",
      url
    );
    expect(sources[0]?.url).toBe(url);
    expect(sources.filter((s) => s.current).map((s) => s.url)).toEqual([url]);
    expect(sources[0]?.text).toContain(PRIVATE_PLACEHOLDER);
    expect(sources.some((s) => s.text.includes("<Private"))).toBe(false);
  },
  SLOW_MS
);
