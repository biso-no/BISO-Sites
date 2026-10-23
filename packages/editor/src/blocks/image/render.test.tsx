import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImageBlock } from "@/editor/types";
import { ImageRender } from "./render";

const noPatch = () => undefined;

const block = (patch: Partial<ImageBlock> = {}): ImageBlock => ({
  alt: "Students at the opening",
  caption: "",
  frame: "chevron",
  id: "i1",
  lean: "left",
  ratio: "16/9",
  src: "https://appwrite.biso.no/media/1/view",
  type: "image",
  ...patch,
});

const html = (b: ImageBlock, edit = false) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(ImageRender, { block: b, edit, onPatch: noPatch })
    )
  );

describe("ImageRender", () => {
  test("a 16/9 chevron frame renders --ar:0.5625 inside a figure", () => {
    const out = html(block());
    expect(out).toContain("<figure");
    expect(out).toContain("chevron-frame");
    expect(out).toContain("--ar:0.5625");
    expect(out).toContain('alt="Students at the opening"');
  });

  test("decorative renders an empty alt", () => {
    const out = html(block({ decorative: true }));
    expect(out).toContain('alt=""');
    expect(out).not.toContain("Students at the opening");
  });

  test("plain frame is a rounded box, not a chevron", () => {
    const out = html(block({ frame: "plain" }));
    expect(out).toContain("rounded-biso-md");
    expect(out).toContain("overflow-hidden");
    expect(out).not.toContain("chevron-frame");
  });

  test("a missing src renders the placeholder and no img", () => {
    const out = html(block({ src: undefined }));
    expect(out).not.toContain("<img");
    expect(out).toContain("bg-surface-sunken");
  });

  test("the placeholder prompt shows in the editor only", () => {
    expect(html(block({ src: undefined }), true)).toContain("inspector");
    expect(html(block({ src: undefined }), false)).not.toContain("inspector");
  });

  test("the caption is a hint in the editor, never saved text", () => {
    const edit = html(block(), true);
    expect(edit).not.toContain(">Caption…<");
    expect(edit).toContain('data-placeholder="Caption…"');
    expect(html(block({ caption: "Opening night" }))).toContain(
      ">Opening night<"
    );
    expect(html(block())).not.toContain("<figcaption");
  });

  test("an old-shape block without ratio or frame renders at 16/9", () => {
    const old = {
      aspect: "16/9",
      caption: "",
      id: "i1",
      src: "https://example.com/a.jpg",
      type: "image",
    } as unknown as ImageBlock;
    const out = html(old, true);
    expect(out).toContain("--ar:0.5625");
    expect(out).toContain("chevron-frame");
  });
});
