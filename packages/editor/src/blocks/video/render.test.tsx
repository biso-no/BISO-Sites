import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { VideoBlock } from "@/editor/types";
import { classesOf, parseHtml } from "@/lib/test-dom";
import { embedSrc } from "../_v2/media";
import { VideoInspector } from "./inspector";
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

const VIMEO = "https://vimeo.com/76979871";

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
    expect(out).toContain("youtube-nocookie.com/embed");
    expect(out).toContain("title=");
  });

  test("an embed grants fullscreen once, through allow", () => {
    // Both allow="…fullscreen…" and allowfullscreen make Chrome warn that
    // allow takes precedence.
    const out = html(block({ style: "inline", url: YOUTUBE }));
    expect(out).toContain('allow="autoplay; fullscreen; picture-in-picture"');
    expect(out.toLowerCase()).not.toContain("allowfullscreen");
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

  test("an inline embed loads lazily", () => {
    const iframe = parseHtml(
      html(block({ style: "inline", url: YOUTUBE }))
    ).querySelector("iframe");
    expect(iframe?.getAttribute("loading")).toBe("lazy");
  });

  test("an inline file player letterboxes instead of cropping", () => {
    const video = parseHtml(html(block({ style: "inline" }))).querySelector(
      "video"
    );
    expect(classesOf(video)).toContain("object-contain");
    expect(classesOf(video)).not.toContain("object-cover");
  });

  test("loop with a YouTube or Vimeo link plays as featured, never a dead video", () => {
    for (const url of [YOUTUBE, VIMEO]) {
      const root = parseHtml(html(block({ style: "loop", url })));
      expect(root.querySelector("video")).toBeNull();
      expect(root.querySelector("button")?.getAttribute("aria-label")).toBe(
        "Spill av video"
      );
    }
  });

  test("an unknown style plays as featured", () => {
    const root = parseHtml(
      html(block({ style: "big" as never, url: YOUTUBE }))
    );
    expect(root.querySelector("button")).not.toBeNull();
  });
});

describe("VideoInspector", () => {
  const inspector = (b: VideoBlock) =>
    parseHtml(
      renderToStaticMarkup(
        createElement(VideoInspector, { block: b, onPatch: noPatch })
      )
    );
  const loopButton = (root: Element) =>
    [...root.querySelectorAll(".pe-seg button")].find(
      (button) => button.textContent === "Loop"
    );

  test("Loop is disabled for a YouTube or Vimeo link, with a note", () => {
    const root = inspector(block({ url: VIMEO }));
    expect(loopButton(root)?.hasAttribute("disabled")).toBe(true);
    expect(root.textContent).toContain("Loop needs an uploaded video file");
  });

  test("a stored loop on an embed shows the style it plays as", () => {
    const root = inspector(block({ style: "loop", url: YOUTUBE }));
    const on = root.querySelector(".pe-seg button.on");
    expect(on?.textContent).toBe("Featured");
  });

  test("Loop is available for an uploaded file", () => {
    const root = inspector(block());
    expect(loopButton(root)?.hasAttribute("disabled")).toBe(false);
    expect(root.textContent).not.toContain("Loop needs an uploaded video file");
  });
});
