import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { canonicalBodyHtml } from "@/blocks/text/canonical-body";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import { findBlock } from "@/editor/tree";
import type { TextBlock } from "@/editor/types";
import { applyToolCall, whenBodiesCanonical } from "./chat-panel";

/** What the rich module's HTML parsing reads from the global scope. */
const GLOBALS = [
  "CustomEvent",
  "DOMParser",
  "Document",
  "Element",
  "HTMLElement",
  "Node",
  "ShadowRoot",
  "cancelAnimationFrame",
  "document",
  "getComputedStyle",
  "requestAnimationFrame",
  "window",
] as const;

const scope = globalThis as unknown as Record<string, unknown>;
const previous = Object.fromEntries(GLOBALS.map((key) => [key, scope[key]]));

beforeAll(async () => {
  const win = new Window();
  const source = win as unknown as Record<string, unknown>;
  for (const key of GLOBALS) {
    scope[key] = key === "window" ? win : source[key];
  }
  // As the open copilot panel does: the first load of the rich chunk is
  // slow, and the canonical write must land inside the coalesce window.
  await canonicalBodyHtml("");
});

afterAll(() => {
  Object.assign(scope, previous);
});

beforeEach(() => {
  useEditorStore.getState().setDoc(doc(section("s-1", "1", [["b-1"]])));
});

const bodyOf = (id: string): TextBlock["body"] =>
  (findBlock(useEditorStore.getState().doc, id)?.block as TextBlock).body;

test("set_prop body is stored in the field's canonical form, in one undo step", async () => {
  const before = useEditorStore.getState().past.length;
  applyToolCall("set_prop", {
    id: "b-1",
    path: "body",
    value: "<div>Hei</div><div>du</div>",
  });
  expect(bodyOf("b-1")).toBe("<div>Hei</div><div>du</div>");
  await whenBodiesCanonical();
  expect(bodyOf("b-1")).toBe("<p>Hei</p><p>du</p>");
  expect(useEditorStore.getState().past.length).toBe(before + 1);
});

test("an edit made before the canonical form arrives wins", async () => {
  applyToolCall("set_prop", { id: "b-1", path: "body", value: "<div>a</div>" });
  useEditorStore.getState().setProp("b-1", "body", "<p>mine</p>");
  await whenBodiesCanonical();
  expect(bodyOf("b-1")).toBe("<p>mine</p>");
});
