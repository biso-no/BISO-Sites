import { expect, mock, test } from "bun:test";
import type { PatchFn } from "@/blocks/types";
import { emptyBlock } from "@/editor/operations";
import { bodyPatch, bodyToHtml, legacyBodyToHtml } from "./body";

test("maps legacy item types to tags, grouping consecutive list items", () => {
  expect(
    legacyBodyToHtml([
      { type: "h", text: "Title" },
      { type: "h3", text: "Sub" },
      { type: "p", text: "A <b>b</b>" },
      { type: "li", text: "one" },
      { type: "li", text: "two" },
      { type: "p", text: "after" },
      { type: "li", text: "three" },
    ])
  ).toBe(
    "<h2>Title</h2><h3>Sub</h3><p>A <b>b</b></p><ul><li>one</li><li>two</li></ul><p>after</p><ul><li>three</li></ul>"
  );
});

test("an unknown item type is a paragraph", () => {
  expect(legacyBodyToHtml([{ type: "zz" as never, text: "x" }])).toBe(
    "<p>x</p>"
  );
});

test("bodyToHtml passes strings through and tolerates junk", () => {
  expect(bodyToHtml("<p>x</p>")).toBe("<p>x</p>");
  expect(bodyToHtml([{ type: "p", text: "x" }, null, "s"])).toBe("<p>x</p>");
  expect(bodyToHtml(undefined)).toBe("");
});

test("a new text block starts in the new shape", () => {
  expect(emptyBlock("text")).toMatchObject({
    body: "<h2>Section heading</h2><p>Tell the story like you'd tell a friend.</p>",
  });
});

test("bodyPatch patches the whole body once, coalesced per block", () => {
  const onPatch = mock<PatchFn>(() => undefined);
  bodyPatch({ body: [], id: "a", type: "text" }, onPatch)("<p>x</p>");
  expect(onPatch.mock.calls).toEqual([
    ["body", "<p>x</p>", { coalesce: "a:body" }],
  ]);
});
