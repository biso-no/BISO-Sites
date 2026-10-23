import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { VideoBlock } from "@/editor/types";
import { embedSrc } from "../_v2/media";
import { VideoRender } from "./render";

const noPatch = () => undefined;
const YOUTUBE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const block = (patch: Partial<VideoBlock> = {}): VideoBlock => ({
  caption: "",
  id: "v1",
  ratio: "16/9",
  style: "featured",
  type: "video",
  url: "https://appwrite.biso.no/media/1/view",
  ...patch,
});

const html = (b: VideoBlock, edit = false) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(VideoRender, { block: b, edit, onPatch: noPatch })
    )
  );

describe("VideoRender", () => {
  test("featured with a poster is a facade: poster, labelled button, no player", () => {
    const out = html(block({ poster: "https://x.test/poster.jpg" }));
    expect(out).toContain("<img");
    expect(out).toContain("poster.jpg");
    expect(out).toContain("<button");
    expect(out).toContain('aria-label="Spill av video"');
    expect(out).toContain("size-20");
    expect(out).not.toContain("<video");
    expect(out).not.toContain("<iframe");
  });

  test("featured without a poster is a deep frame with the button", () => {
    const out = html(block({ url: YOUTUBE }));
    expect(out).toContain("bg-deep");
    expect(out).toContain("<button");
    expect(out).not.toContain("<iframe");
  });

  test("a label shows as a pill on the facade", () => {
    expect(html(block({ label: "Se filmen" }))).toContain("Se filmen");
  });

  test("loop renders a muted looping inline video without controls", () => {
    const out = html(block({ style: "loop" }));
    expect(out).toContain("<video");
    expect(out).toContain("muted");
    expect(out).toContain("loop");
    expect(out).toContain("playsInline");
    expect(out).not.toContain("controls");
  });

  test("inline with a YouTube URL renders the embed iframe", () => {
    const out = html(block({ style: "inline", url: YOUTUBE }));
    expect(out).toContain("<iframe");
    expect(out).toContain(embedSrc(YOUTUBE) as string);
    expect(out).toContain("youtube.com/embed");
    expect(out).toContain("title=");
  });

  test("inline with an uploaded file renders controls and metadata preload", () => {
    const out = html(
      block({ style: "inline", poster: "https://x.test/p.jpg" })
    );
    expect(out).toContain("<video");
    expect(out).toContain("controls");
    expect(out).toContain('preload="metadata"');
  });

  test("a caption renders", () => {
    expect(html(block({ caption: "Opening night" }))).toContain(
      "Opening night"
    );
  });

  test("no url renders nothing on the site", () => {
    expect(html(block({ url: undefined }))).toBe(
      '<section data-surface="deep"></section>'
    );
  });

  test("no url in the editor renders a placeholder", () => {
    expect(html(block({ url: undefined }), true)).toContain("Select a video");
  });

  test("missing style, ratio and caption fall back to defaults", () => {
    const out = html({
      id: "v2",
      type: "video",
      url: YOUTUBE,
    } as unknown as VideoBlock);
    expect(out).toContain("--ar:0.5625");
    expect(out).toContain("<button");
  });

  test("an unsafe poster is not rendered as a javascript url", () => {
    const out = html(block({ poster: "javascript:alert(1)" }));
    expect(out).not.toContain("javascript:");
  });
});
