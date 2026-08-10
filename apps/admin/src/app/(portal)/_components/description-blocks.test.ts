import { describe, expect, test } from "bun:test";
import {
  descriptionBlocksToHtml,
  htmlToDescriptionBlocks,
  newBlock,
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

  test("migrates a media-only Plate node with no text key", () => {
    const parsed = htmlToDescriptionBlocks(
      '[{"type":"img","url":"https://example.com/legacy-no-text.jpg"}]'
    );

    expect(parsed[0]).toMatchObject({
      mediaKind: "image",
      type: "media",
      url: "https://example.com/legacy-no-text.jpg",
    });
  });

  test("preserves literal entity metadata without double decoding", () => {
    const block = newMediaBlock({
      alt: "Show &lt;details&gt; &amp; more",
      caption: "Display &quot;quoted&quot; text",
      fileId: "entity-image",
      fileName: "entity.jpg",
      mediaKind: "image",
      mimeType: "image/jpeg",
      url: "https://example.com/entity.jpg",
    });

    expect(
      htmlToDescriptionBlocks(descriptionBlocksToHtml([block]))[0]
    ).toMatchObject({
      alt: "Show &lt;details&gt; &amp; more",
      caption: "Display &quot;quoted&quot; text",
    });
  });

  test("round-trips audio, video, and file attachments", () => {
    const blocks = [
      newMediaBlock({
        alt: "",
        caption: "Listen",
        fileId: "audio-1",
        fileName: "welcome.mp3",
        mediaKind: "audio",
        mimeType: "audio/mpeg",
        url: "https://example.com/welcome.mp3",
      }),
      newMediaBlock({
        alt: "",
        caption: "Watch",
        fileId: "video-1",
        fileName: "welcome.mp4",
        mediaKind: "video",
        mimeType: "video/mp4",
        url: "https://example.com/welcome.mp4",
      }),
      newMediaBlock({
        alt: "",
        caption: "Download",
        fileId: "file-1",
        fileName: "welcome.pdf",
        mediaKind: "file",
        mimeType: "application/pdf",
        url: "https://example.com/welcome.pdf",
      }),
    ];

    const html = descriptionBlocksToHtml(blocks);
    expect(html).toContain("<audio controls");
    expect(html).toContain("<video controls");
    expect(html).toContain("<a href=");
    expect(
      htmlToDescriptionBlocks(html).map((block) =>
        block.type === "media" ? block.mediaKind : null
      )
    ).toEqual(["audio", "video", "file"]);
  });

  test("preserves text and media ordering and migrates generic Plate URLs as files", () => {
    const blocks = [
      newBlock("p", "Before"),
      newMediaBlock({
        alt: "",
        caption: "Attachment",
        fileId: "file-2",
        fileName: "attachment.pdf",
        mediaKind: "file",
        mimeType: "application/pdf",
        url: "https://example.com/attachment.pdf",
      }),
      newBlock("h", "After"),
    ];

    const parsed = htmlToDescriptionBlocks(descriptionBlocksToHtml(blocks));
    expect(parsed.map((block) => block.type)).toEqual(["p", "media", "h"]);
    expect(
      htmlToDescriptionBlocks(
        '[{"type":"embed","url":"https://example.com/file.pdf"}]'
      )[0]
    ).toMatchObject({
      mediaKind: "file",
      type: "media",
      url: "https://example.com/file.pdf",
    });
  });
});
