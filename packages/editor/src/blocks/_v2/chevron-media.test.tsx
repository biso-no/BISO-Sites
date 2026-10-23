import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronMedia } from "./chevron-media";

const TAGS_RE = /<[^>]*>/g;

test("an image sits in a chevron frame with its ratio", () => {
  const html = renderToStaticMarkup(
    <ChevronMedia alt="A" ratio="16/9" src="https://example.com/a.jpg" />
  );
  expect(html).toContain('class="chevron-frame"');
  expect(html).toContain("--ar:0.5625");
  expect(html).toContain('loading="lazy"');
});

test("an empty src renders the placeholder and no image", () => {
  const html = renderToStaticMarkup(<ChevronMedia ratio="16/9" src="" />);
  expect(html).toContain("bg-surface-sunken");
  expect(html).not.toContain("<img");
  expect(html.replace(TAGS_RE, "")).toBe("");
});

test("an editor placeholder shows only when passed", () => {
  const html = renderToStaticMarkup(
    <ChevronMedia placeholder="Add media" ratio="16/9" src="" />
  );
  expect(html).toContain("Add media");
});

test("a looping video is muted, inline and has a reduced-motion poster", () => {
  const html = renderToStaticMarkup(
    <ChevronMedia
      alt="Loop"
      kind="video"
      loop
      poster="https://example.com/p.jpg"
      ratio="21/9"
      src="https://example.com/v.mp4"
    />
  );
  expect(html).toContain("muted");
  expect(html).toContain("loop");
  expect(html.toLowerCase()).toContain("playsinline");
  expect(html).toContain("pg-reduced-motion-poster");
});
