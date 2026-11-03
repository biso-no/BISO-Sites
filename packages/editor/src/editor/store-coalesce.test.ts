import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { useEditorStore } from "./store";
import { doc, section } from "./test-fixtures";

const state = () => useEditorStore.getState();
const bodyOf = (id: string) => {
  const found = state()
    .doc.sections.flatMap((s) => s.columns.flatMap((c) => c.blocks))
    .find((b) => b.id === id);
  return (found as Record<string, unknown> | undefined)?.body;
};
const type = (id: string, html: string) =>
  state().setProp(id, "body", html, { coalesce: `${id}:body` });

describe("coalesced history", () => {
  let original: unknown;

  beforeEach(() => {
    setSystemTime(new Date("2026-11-03T10:00:00Z"));
    state().setDoc(doc(section("s-1", "1-1", [["b1"], ["b2"]])));
    original = bodyOf("b1");
  });

  afterEach(() => {
    setSystemTime();
  });

  test("a burst of coalesced edits is one undo step", () => {
    type("b1", "<p>a</p>");
    type("b1", "<p>ab</p>");
    type("b1", "<p>abc</p>");
    expect(state().past.length).toBe(1);
    expect(bodyOf("b1")).toBe("<p>abc</p>");
    state().undo();
    expect(bodyOf("b1")).toEqual(original);
  });

  test("a pause longer than 1000 ms starts a new step", () => {
    type("b1", "<p>a</p>");
    setSystemTime(new Date("2026-11-03T10:00:01.001Z"));
    type("b1", "<p>ab</p>");
    expect(state().past.length).toBe(2);
  });

  test("the window slides with each keystroke", () => {
    type("b1", "<p>a</p>");
    setSystemTime(new Date("2026-11-03T10:00:00.900Z"));
    type("b1", "<p>ab</p>");
    setSystemTime(new Date("2026-11-03T10:00:01.800Z"));
    type("b1", "<p>abc</p>");
    expect(state().past.length).toBe(1);
  });

  test("another edit in between breaks the burst", () => {
    type("b1", "<p>a</p>");
    state().setProp("b2", "title", "x");
    type("b1", "<p>ab</p>");
    expect(state().past.length).toBe(3);
  });

  test("undo then typing starts a new step and clears the future", () => {
    type("b1", "<p>a</p>");
    type("b1", "<p>ab</p>");
    state().undo();
    expect(state().future.length).toBe(1);
    type("b1", "<p>x</p>");
    expect(state().past.length).toBe(1);
    expect(state().future.length).toBe(0);
  });

  test("different keys do not coalesce", () => {
    type("b1", "<p>a</p>");
    type("b2", "<p>a</p>");
    expect(state().past.length).toBe(2);
  });
});
