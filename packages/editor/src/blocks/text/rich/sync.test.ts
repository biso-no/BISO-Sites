import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { htmlToValue } from "./html";
import { htmlToEmit, shouldTakeProp } from "./sync";

const previous = { Node: globalThis.Node, document: globalThis.document };

beforeAll(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
});

afterAll(() => {
  Object.assign(globalThis, previous);
});

test("no emit when the HTML did not change", () => {
  expect(htmlToEmit(htmlToValue("<p>a</p>"), "<p>a</p>")).toBeNull();
});

test("emit when it did", () => {
  expect(htmlToEmit(htmlToValue("<p>ab</p>"), "<p>a</p>")).toBe("<p>ab</p>");
});

test("a focused field never takes the prop", () => {
  expect(shouldTakeProp("<p>b</p>", "<p>a</p>", true)).toBe(false);
});

test("an unfocused field takes a different prop", () => {
  expect(shouldTakeProp("<p>b</p>", "<p>a</p>", false)).toBe(true);
});

test("its own echo is ignored", () => {
  expect(shouldTakeProp("<p>a</p>", "<p>a</p>", false)).toBe(false);
});
