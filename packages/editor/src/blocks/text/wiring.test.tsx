import { afterAll, expect, mock, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PatchFn } from "@/blocks/types";
import {
  type EditorCallbacks,
  EditorCallbacksContext,
} from "@/editor/callbacks";
import { doc } from "@/editor/test-fixtures";
import type { TextBlock } from "@/editor/types";
import type { RichTextFieldProps } from "./rich/field";

/*
 * What each surface hands its field, the write path above all. The field is
 * replaced by one that records its props. Bun's module mocks are
 * process-wide and update every importer in place, so the real exports are
 * copied first (values, not live bindings) and put back after this file.
 */
const real = { ...(await import("./lazy-field")) };

let captured: RichTextFieldProps[] = [];
mock.module("./lazy-field", () => ({
  RichTextField: (props: RichTextFieldProps) => {
    captured.push(props);
    return null;
  },
  useMounted: () => true,
}));

afterAll(async () => {
  mock.module("./lazy-field", () => real);
  const restored = await import("./lazy-field");
  expect(restored.RichTextField).toBe(real.RichTextField);
  expect(restored.useMounted).toBe(real.useMounted);
});

const { TextExpandView } = await import("./expand");
const { TextInspector } = await import("./inspector");
const { TextRender } = await import("./render");

const block: TextBlock = {
  body: [{ text: "x", type: "p" }],
  id: "a",
  type: "text",
};

/** The props of the one field `node` draws. */
const fieldOf = (node: ReactElement): RichTextFieldProps => {
  captured = [];
  renderToStaticMarkup(node);
  expect(captured).toHaveLength(1);
  return captured[0] as RichTextFieldProps;
};

test("the canvas field edits the whole body, coalesced per block", () => {
  const onPatch = mock<PatchFn>(() => undefined);
  const field = fieldOf(
    createElement(TextRender, { block, edit: true, onPatch })
  );
  expect(field).toMatchObject({
    html: "<p>x</p>",
    label: "Rich text",
    variant: "canvas",
  });

  field.onChange("<p>y</p>");
  expect(onPatch.mock.calls).toEqual([
    ["body", "<p>y</p>", { coalesce: "a:body" }],
  ]);
});

test("the field's own undo or redo reaches the page as history-neutral", () => {
  const onPatch = mock<PatchFn>(() => undefined);
  const field = fieldOf(
    createElement(TextRender, { block, edit: true, onPatch })
  );
  field.onChange("<p>y</p>", { historyNeutral: true });
  expect(onPatch.mock.calls).toEqual([
    ["body", "<p>y</p>", { coalesce: "a:body", historyNeutral: true }],
  ]);
});

test("the inspector field edits the whole body, coalesced per block", () => {
  const onPatch = mock<PatchFn>(() => undefined);
  const field = fieldOf(
    createElement(TextInspector, { block, doc: doc(), onPatch })
  );
  expect(field).toMatchObject({
    html: "<p>x</p>",
    label: "Text",
    variant: "panel",
  });

  field.onChange("<p>z</p>");
  expect(onPatch.mock.calls).toEqual([
    ["body", "<p>z</p>", { coalesce: "a:body" }],
  ]);
});

test("the wide view's field edits the whole body, coalesced per block", () => {
  const onPatch = mock<PatchFn>(() => undefined);
  const onPageHistory = mock(() => undefined);
  const field = fieldOf(
    createElement(TextExpandView, {
      block,
      onClose: () => undefined,
      onPageHistory,
      onPatch,
    })
  );
  expect(field).toMatchObject({
    autoFocus: true,
    html: "<p>x</p>",
    label: "Text",
    variant: "panel",
  });
  expect(field.onPageHistory).toBe(onPageHistory);

  field.onChange("<p>w</p>");
  expect(onPatch.mock.calls).toEqual([
    ["body", "<p>w</p>", { coalesce: "a:body" }],
  ]);
});

test("both surfaces hand the field the shell's page history", () => {
  const pageHistory = mock<NonNullable<EditorCallbacks["pageHistory"]>>(
    () => undefined
  );
  const callbacks: EditorCallbacks = {
    activeLocale: "no",
    campuses: [],
    departments: [],
    locales: [],
    onLocaleChange: () => undefined,
    pageHistory,
    savePage: async () => undefined,
    uploadFile: async () => ({ fileId: "", url: "" }),
  };
  const inShell = (node: ReactElement) =>
    createElement(EditorCallbacksContext.Provider, { value: callbacks }, node);
  const onPatch = mock<PatchFn>(() => undefined);

  const canvas = fieldOf(
    inShell(createElement(TextRender, { block, edit: true, onPatch }))
  );
  const panel = fieldOf(
    inShell(createElement(TextInspector, { block, doc: doc(), onPatch }))
  );
  expect(canvas.onPageHistory).toBe(pageHistory);
  expect(panel.onPageHistory).toBe(pageHistory);
});
