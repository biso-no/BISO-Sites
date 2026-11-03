import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { COALESCE_MS, opensNewStep } from "./coalesce";
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

test("opensNewStep: nothing before, or one second or more since, opens a step", () => {
  expect(opensNewStep(null, 5)).toBe(true);
  expect(opensNewStep(0, 999)).toBe(false);
  expect(opensNewStep(0, 1000)).toBe(true);
  expect(COALESCE_MS).toBe(1000);
});

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

// A rich text field's own undo and redo write the body back as it was: no
// new page step, so the page's undo never replays what the field undid.
describe("history-neutral writes", () => {
  let original: unknown;
  const titleOf = (id: string) => {
    const found = state()
      .doc.sections.flatMap((s) => s.columns.flatMap((c) => c.blocks))
      .find((b) => b.id === id);
    return (found as Record<string, unknown> | undefined)?.title;
  };
  const neutral = (id: string, html: unknown) =>
    state().setProp(id, "body", html, {
      coalesce: `${id}:body`,
      historyNeutral: true,
    });

  beforeEach(() => {
    setSystemTime(new Date("2026-11-03T10:00:00Z"));
    state().setDoc(doc(section("s-1", "1-1", [["b1"], ["b2"]])));
    original = bodyOf("b1");
    // The step before the typing.
    state().setProp("b2", "title", "Earlier");
    type("b1", "<p>H</p>");
    type("b1", "<p>Hello</p>");
    setSystemTime(new Date("2026-11-03T10:00:02Z"));
  });

  afterEach(() => {
    setSystemTime();
  });

  test("one that lands on no step changes the page and adds no step", () => {
    neutral("b1", "<p>Hel</p>");
    expect(bodyOf("b1")).toBe("<p>Hel</p>");
    expect(state().past.length).toBe(2);
    expect(state().future.length).toBe(0);
  });

  test("one that lands on the step below takes it, as undo would", () => {
    neutral("b1", original);
    expect(bodyOf("b1")).toEqual(original);
    expect(state().past.length).toBe(1);
    expect(state().future.length).toBe(1);

    // The next undo goes to the step before the typing, with no replay.
    state().undo();
    expect(bodyOf("b1")).toEqual(original);
    expect(titleOf("b2")).not.toBe("Earlier");
    expect(state().past.length).toBe(0);
  });

  test("one that lands on the step above takes it back, as redo would", () => {
    neutral("b1", original);
    neutral("b1", "<p>Hello</p>");
    expect(state().past.length).toBe(2);
    expect(state().future.length).toBe(0);

    state().undo();
    expect(bodyOf("b1")).toEqual(original);
    expect(titleOf("b2")).toBe("Earlier");
  });

  test("page redo after it walks forward through the same steps", () => {
    neutral("b1", original);
    state().undo();
    state().redo();
    expect(titleOf("b2")).toBe("Earlier");
    expect(bodyOf("b1")).toEqual(original);
    state().redo();
    expect(bodyOf("b1")).toBe("<p>Hello</p>");
    expect(state().future.length).toBe(0);
  });

  test("typing straight after it starts a step of its own", () => {
    setSystemTime(new Date("2026-11-03T10:00:00.500Z"));
    neutral("b1", original);
    type("b1", "<p>X</p>");
    expect(state().past.length).toBe(2);
    state().undo();
    expect(bodyOf("b1")).toEqual(original);
    expect(titleOf("b2")).toBe("Earlier");
  });
});
