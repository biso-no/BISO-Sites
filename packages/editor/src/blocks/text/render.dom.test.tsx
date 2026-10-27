import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type EditorCallbacks,
  EditorCallbacksContext,
} from "@/editor/callbacks";
import type { TextBlock } from "@/editor/types";
import { TextRender } from "./render";

const previous = { Node: globalThis.Node, document: globalThis.document };

beforeAll(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
});

afterAll(() => {
  globalThis.document = previous.document;
  globalThis.Node = previous.Node;
});

// A stored value the admin never cleaned: a row saved before the save path
// sanitized, a direct table write, or copilot/translate output not yet saved.
const STORED = "<img src=x onerror=alert(1)>hei <b>fet</b>";

const block = (text: string): TextBlock => ({
  body: [{ text, type: "p" }],
  id: "t1",
  type: "text",
});

const EDITOR: EditorCallbacks = {
  activeLocale: "no",
  campuses: [],
  departments: [],
  locales: [],
  onLocaleChange: () => undefined,
  savePage: async () => undefined,
  uploadFile: async () => ({ fileId: "", url: "" }),
};

const render = (edit: boolean, inEditor: boolean, stored = STORED) => {
  const text = createElement(TextRender, {
    block: block(stored),
    edit,
    onPatch: () => undefined,
  });
  return renderToStaticMarkup(
    inEditor
      ? createElement(EditorCallbacksContext.Provider, { value: EDITOR }, text)
      : text
  );
};

describe("TextRender inside the editor", () => {
  test("sanitizes stored markup in edit mode", () => {
    const html = render(true, true);
    expect(html).not.toContain("<img");
    expect(html).toContain("hei <b>fet</b>");
  });

  test("sanitizes stored markup in preview mode too", () => {
    const html = render(false, true);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).toContain("hei <b>fet</b>");
  });
});

describe("TextRender on the public site", () => {
  test("renders the value the server route already sanitized, as given", () => {
    // The routes run sanitizePageDocHtml before RenderedPage; the client
    // renderer adds nothing on top of it.
    const sanitized = 'hei <b>fet</b> &amp; <a href="/om-oss">lenke</a>';
    expect(render(false, false, sanitized)).toContain(sanitized);
  });
});
