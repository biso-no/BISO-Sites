import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImageBlock } from "@/editor/types";
import { ImageRender } from "./render";

const noPatch = () => undefined;

const block = (caption: string): ImageBlock => ({
  aspect: "16/9",
  caption,
  id: "i1",
  src: "https://appwrite.biso.no/media/1/view",
  type: "image",
});

describe("ImageRender caption", () => {
  test("shows the placeholder as a hint, never as caption text", () => {
    // "Caption…" used to be rendered as the editable element's text, so
    // clicking the caption and clicking away saved the placeholder to the page.
    const html = renderToStaticMarkup(
      createElement(ImageRender, {
        block: block(""),
        edit: true,
        onPatch: noPatch,
      })
    );

    expect(html).not.toContain(">Caption…<");
    expect(html).toContain('data-placeholder="Caption…"');
  });

  test("keeps a real caption", () => {
    const html = renderToStaticMarkup(
      createElement(ImageRender, {
        block: block("Opening night"),
        edit: true,
        onPatch: noPatch,
      })
    );

    expect(html).toContain(">Opening night<");
  });
});
