import { expect, test } from "bun:test";
import { embedSrc, isEmbedUrl, ratioValue, sizedImageSrc } from "./media";

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

test("embeds: YouTube and Vimeo, nothing else", () => {
  expect(isEmbedUrl("https://youtu.be/abcdefghijk")).toBe(true);
  expect(isEmbedUrl("https://example.com/a.mp4")).toBe(false);
  expect(embedSrc("https://youtu.be/abcdefghijk", {})).toBe(
    "https://www.youtube.com/embed/abcdefghijk"
  );
  expect(embedSrc("https://vimeo.com/123", { autoplay: true })).toBe(
    "https://player.vimeo.com/video/123?autoplay=1&mute=1"
  );
  expect(embedSrc("https://example.com/a.mp4", {})).toBeNull();
});
