import { describe, expect, test } from "bun:test";
import { pageFeedKey } from "./page-feeds";
import { pruneEmptyFeedBlocks } from "./prune-feeds";
import { block, doc, section } from "./test-fixtures";
import type { PageDoc } from "./types";

const EVENTS_KEY = pageFeedKey("events", "dept-1", "no", 3);

function page(blockTypes: ("events" | "text" | "team")[][]): PageDoc {
  const d = doc(
    ...blockTypes.map((types, i) => {
      const s = section(`s-${i}`, "1", [[]]);
      s.columns[0].blocks = types.map((t, j) => block(`b-${i}-${j}`, t));
      return s;
    })
  );
  d.meta.department = "dept-1";
  return d;
}

describe("pruneEmptyFeedBlocks", () => {
  test("a section whose only events block has an empty feed is dropped", () => {
    const pruned = pruneEmptyFeedBlocks(
      page([["text"], ["events"]]),
      { [EVENTS_KEY]: [] },
      "no"
    );
    expect(pruned.sections.map((s) => s.columns[0].blocks.length)).toEqual([
      1, 0,
    ]);
  });

  test("text beside an empty events block survives", () => {
    const pruned = pruneEmptyFeedBlocks(
      page([["text", "events"]]),
      { [EVENTS_KEY]: [] },
      "no"
    );
    expect(pruned.sections[0].columns[0].blocks.map((b) => b.type)).toEqual([
      "text",
    ]);
  });

  test("an unresolved feed (key absent) is kept", () => {
    const pruned = pruneEmptyFeedBlocks(page([["events"]]), {}, "no");
    expect(pruned.sections[0].columns[0].blocks).toHaveLength(1);
  });

  test("a feed with rows is kept", () => {
    const pruned = pruneEmptyFeedBlocks(
      page([["events"]]),
      { [EVENTS_KEY]: [{ title: "x" }] },
      "no"
    );
    expect(pruned.sections[0].columns[0].blocks).toHaveLength(1);
  });

  test("a live block with no department is dropped; a manual team stays", () => {
    const d = page([["events", "team"]]);
    d.meta.department = "";
    const pruned = pruneEmptyFeedBlocks(d, {}, "no");
    // emptyBlock("team") is manual, so only events goes.
    expect(pruned.sections[0].columns[0].blocks.map((b) => b.type)).toEqual([
      "team",
    ]);
  });

  test("never mutates its input", () => {
    const d = page([["text", "events"]]);
    const before = JSON.stringify(d);
    pruneEmptyFeedBlocks(d, { [EVENTS_KEY]: [] }, "no");
    expect(JSON.stringify(d)).toBe(before);
  });
});
