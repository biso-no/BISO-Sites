import { expect, test } from "bun:test";
import {
  appwriteDownloadSrc,
  embedSrc,
  isEmbedUrl,
  ratioValue,
  sizedImageSrc,
} from "./media";

test("an Appwrite view URL becomes a sized WebP preview", () => {
  expect(
    sizedImageSrc(
      "https://appwrite.biso.no/v1/storage/buckets/media/files/abc/view?project=biso",
      1200
    )
  ).toBe(
    "https://appwrite.biso.no/v1/storage/buckets/media/files/abc/preview?project=biso&width=1200&output=webp&quality=80"
  );
});

test("a non-Appwrite URL is unchanged", () => {
  expect(sizedImageSrc("https://example.com/a.jpg", 800)).toBe(
    "https://example.com/a.jpg"
  );
});

test("ratioValue is height over width", () => {
  expect(ratioValue("16/9")).toBe(0.5625);
  expect(ratioValue("1/1")).toBe(1);
});

test("ratioValue ignores prototype keys", () => {
  expect(ratioValue("constructor" as never)).toBe(0.5625);
  expect(ratioValue("toString" as never)).toBe(0.5625);
});

test("ratioValue falls back to 16/9 for an unknown or missing ratio", () => {
  expect(ratioValue("nonsense" as never)).toBe(0.5625);
  expect(ratioValue(undefined)).toBe(0.5625);
});

test("embeds: YouTube and Vimeo, nothing else", () => {
  expect(isEmbedUrl("https://youtu.be/abcdefghijk")).toBe(true);
  expect(isEmbedUrl("https://example.com/a.mp4")).toBe(false);
  expect(embedSrc("https://youtu.be/abcdefghijk", {})).toBe(
    "https://www.youtube-nocookie.com/embed/abcdefghijk"
  );
  expect(embedSrc("https://vimeo.com/123", {})).toBe(
    "https://player.vimeo.com/video/123?dnt=1"
  );
  // Vimeo's player reads `muted`; YouTube's reads `mute`.
  expect(embedSrc("https://vimeo.com/123", { autoplay: true })).toBe(
    "https://player.vimeo.com/video/123?dnt=1&autoplay=1&muted=1"
  );
  expect(embedSrc("https://youtu.be/abcdefghijk", { autoplay: true })).toBe(
    "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&mute=1"
  );
  expect(embedSrc("https://example.com/a.mp4", {})).toBeNull();
});

const VIEW =
  "https://appwrite.biso.no/v1/storage/buckets/media/files/abc/view?project=biso";

test("an SVG or GIF upload is served as it is, not through the raster preview", () => {
  // Appwrite's preview returns an icon for an SVG and drops a GIF's frames.
  expect(sizedImageSrc(VIEW, 1200, "image/svg+xml")).toBe(VIEW);
  expect(sizedImageSrc(VIEW, 1200, "image/gif")).toBe(VIEW);
  expect(sizedImageSrc(VIEW, 1200, "IMAGE/GIF")).toBe(VIEW);
  expect(sizedImageSrc(VIEW, 1200, "image/png")).toContain("/preview?");
});

test("a URL whose path ends in .svg or .gif is served as it is", () => {
  for (const src of [
    "https://appwrite.biso.no/v1/storage/buckets/media/files/logo.svg",
    "https://cdn.example/anim.GIF?v=2",
  ]) {
    expect(sizedImageSrc(src, 800)).toBe(src);
  }
});

test("only Appwrite's storage view path is rewritten", () => {
  for (const src of [
    "https://example.com/files/abc/view",
    "https://example.com/media/1/view",
    "https://example.com/page?next=/v1/storage/buckets/b/files/f/view",
  ]) {
    expect(sizedImageSrc(src, 800)).toBe(src);
  }
  expect(
    sizedImageSrc(
      "https://appwrite.biso.no/v1/storage/buckets/b/files/f/view",
      800
    )
  ).toBe(
    "https://appwrite.biso.no/v1/storage/buckets/b/files/f/preview?width=800&output=webp&quality=80"
  );
});

const EVIL_SOURCES = [
  "javascript:alert(1)//v1/storage/buckets/a/files/b/view",
  "data:text/html,x//v1/storage/buckets/media/files/b/view",
  "https://evil.example/v1/storage/buckets/media/files/x/view",
  "JaVaScRiPt:alert(1)//v1/storage/buckets/media/files/b/view",
  "\tjavascript:alert(1)//v1/storage/buckets/media/files/b/view",
  " javascript:alert(1)//v1/storage/buckets/media/files/b/view",
  "https://appwrite.biso.no.evil.example/v1/storage/buckets/media/files/x/view",
  "https://user@evil.example/v1/storage/buckets/media/files/x/view",
];

test("sizedImageSrc only rewrites real endpoint URLs", () => {
  for (const src of EVIL_SOURCES) {
    expect(sizedImageSrc(src, 800)).toBe(src);
  }
});

test("appwriteDownloadSrc rewrites only real media-bucket endpoint URLs", () => {
  for (const src of EVIL_SOURCES) {
    expect(appwriteDownloadSrc(src)).toBeNull();
  }
  expect(
    appwriteDownloadSrc(
      "https://appwrite.biso.no/v1/storage/buckets/media/files/f1/view?project=biso"
    )
  ).toBe(
    "https://appwrite.biso.no/v1/storage/buckets/media/files/f1/download?project=biso"
  );
  // Another bucket is left alone.
  expect(
    appwriteDownloadSrc(
      "https://appwrite.biso.no/v1/storage/buckets/content/files/f1/view?project=biso"
    )
  ).toBeNull();
});
