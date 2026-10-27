import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { kindFromMime, MediaPreview } from "./media-picker";

const EXTENSIONLESS = "https://appwrite.biso.no/storage/files/abc/view";

describe("MediaPreview", () => {
  test("a picked video/mp4 with an extensionless URL previews as a video", () => {
    const kind = kindFromMime("video/mp4");
    const out = renderToStaticMarkup(
      <MediaPreview kind={kind} src={EXTENSIONLESS} />
    );
    expect(out).toContain("<video");
    expect(out).not.toContain("<img");
  });

  test("an extensionless URL with no hint is an image", () => {
    const out = renderToStaticMarkup(<MediaPreview src={EXTENSIONLESS} />);
    expect(out).toContain("<img");
  });

  test("a .mp4 URL still previews as a video without a hint", () => {
    const out = renderToStaticMarkup(
      <MediaPreview src="https://x.test/clip.mp4" />
    );
    expect(out).toContain("<video");
  });

  test("an image hint wins over a video-looking extension", () => {
    const out = renderToStaticMarkup(
      <MediaPreview kind="image" src="https://x.test/clip.mp4" />
    );
    expect(out).toContain("<img");
  });
});
