import { describe, expect, test } from "bun:test";
import {
  descriptionBlocksToHtml,
  htmlToDescriptionBlocks,
  newMediaBlock,
} from "./description-blocks";

describe("description media blocks", () => {
  test("round-trips escaped media metadata", () => {
    const block = newMediaBlock({
      alt: 'Board & students "outside"',
      caption: "Welcome <everyone>",
      fileId: "image-1",
      fileName: "welcome.jpg",
      mediaKind: "image",
      mimeType: "image/jpeg",
      url: "https://example.com/image?x=1&y=2",
    });
    const html = descriptionBlocksToHtml([block]);
    expect(htmlToDescriptionBlocks(html)[0]).toMatchObject({
      alt: block.alt,
      caption: block.caption,
      fileId: block.fileId,
      mediaKind: "image",
      url: block.url,
    });
    expect(html).toContain("&lt;everyone&gt;");
    expect(html).toContain("x=1&amp;y=2");
  });

  test("migrates media-only Plate JSON", () => {
    const parsed = htmlToDescriptionBlocks(
      JSON.stringify([
        {
          children: [{ text: "" }],
          type: "img",
          url: "https://example.com/legacy.jpg",
        },
      ])
    );
    expect(parsed[0]).toMatchObject({
      mediaKind: "image",
      type: "media",
      url: "https://example.com/legacy.jpg",
    });
  });
});
