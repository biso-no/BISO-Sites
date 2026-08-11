import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  applyMediaUpload,
  applyPendingMediaUpload,
  DescriptionBlockEditor,
} from "./description-block-editor";
import { newBlock, newMediaBlock } from "./description-blocks";

const renderEditor = (value: string) =>
  renderToStaticMarkup(
    <DescriptionBlockEditor onChange={() => undefined} value={value} />
  );

test("renders a visible passed placeholder only for an empty text block", () => {
  const placeholder = "Write the Norwegian article here…";
  const emptyHtml = renderToStaticMarkup(
    <DescriptionBlockEditor
      onChange={() => undefined}
      placeholder={placeholder}
      value="<p></p><h2></h2><li></li>"
    />
  );
  const populatedHtml = renderToStaticMarkup(
    <DescriptionBlockEditor
      onChange={() => undefined}
      placeholder={placeholder}
      value="<p>Published article text</p>"
    />
  );
  const visiblePlaceholders =
    emptyHtml.match(
      /<span aria-hidden="true" style="[^"]*pointer-events:none[^"]*">[^<]+<\/span>/g
    ) ?? [];
  const paragraphPlaceholder = visiblePlaceholders.find((element) =>
    element.endsWith(`>${placeholder}</span>`)
  );
  const headingPlaceholder = visiblePlaceholders.find((element) =>
    element.endsWith(">Section heading…</span>")
  );
  const listPlaceholder = visiblePlaceholders.find((element) =>
    element.endsWith(">A point, a perk, a detail…</span>")
  );

  expect(visiblePlaceholders).toHaveLength(3);
  expect(paragraphPlaceholder).toContain("font-size:15.5px");
  expect(paragraphPlaceholder).toContain("left:0");
  expect(headingPlaceholder).toContain("font-size:26px");
  expect(headingPlaceholder).toContain("left:0");
  expect(listPlaceholder).toContain("font-size:15.5px");
  expect(listPlaceholder).toContain("left:20px");
  expect(populatedHtml).not.toContain(`>${placeholder}</span>`);
});

test("offers the shared inline media upload control", () => {
  const html = renderEditor("");
  expect(html).toContain(">Media</button>");
  expect(html).toContain("video/mp4");
  expect(html).toContain("audio/mpeg");
  expect(html).toContain("application/pdf");
  expect(html).toContain("audio/x-m4a");
  expect(html).toContain("video/quicktime");
  expect(html).toContain("audio/webm");
  expect(html).toContain(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  expect(html).toContain(".csv");
  expect(html).toContain(".docx");
  expect(html).toContain(".zip");
  expect(html.match(/type="file"/g)).toHaveLength(1);
});

test("renders an editable stored image with its accessible description", () => {
  const html = renderEditor(
    '<figure data-media-kind="image" data-url="https://appwrite.biso.no/v1/storage/image.jpg" data-file-id="image-1" data-file-name="welcome.jpg" data-mime-type="image/jpeg" data-alt="Campus welcome" data-caption="Opening day"><img src="https://appwrite.biso.no/v1/storage/image.jpg" alt="Campus welcome" /><figcaption>Opening day</figcaption></figure>'
  );

  expect(html).toContain('alt="Campus welcome"');
  expect(html).toContain('aria-label="Image alt text"');
  expect(html).toContain('aria-label="Media caption"');
  expect(html).toContain('aria-label="Move media block up"');
  expect(html).toContain('aria-label="Move media block down"');
  expect(html).toContain('value="Opening day"');
  expect(html).toContain(">Replace</button>");
  expect(html).toContain(">Remove</button>");
});

test("renders playable audio and video media", () => {
  const html = renderEditor(
    '<figure data-media-kind="audio" data-url="https://appwrite.biso.no/audio.mp3" data-file-id="audio-1" data-file-name="audio.mp3" data-mime-type="audio/mpeg" data-alt="" data-caption="Listen"></figure><figure data-media-kind="video" data-url="https://appwrite.biso.no/video.mp4" data-file-id="video-1" data-file-name="video.mp4" data-mime-type="video/mp4" data-alt="" data-caption="Watch"></figure>'
  );

  expect(html).toContain('<audio aria-label="Listen" controls');
  expect(html).toContain('<video aria-label="Watch" controls');
  expect(html.match(/preload="metadata"/g)).toHaveLength(2);
});

test("renders file media as an attachment card in document order", () => {
  const html = renderEditor(
    '<figure data-media-kind="file" data-url="https://appwrite.biso.no/guide.pdf" data-file-id="file-1" data-file-name="guide.pdf" data-mime-type="application/pdf" data-alt="" data-caption="Read this"></figure><figure data-media-kind="video" data-url="https://appwrite.biso.no/after.mp4" data-file-id="video-2" data-file-name="after.mp4" data-mime-type="video/mp4" data-alt="" data-caption="After"></figure>'
  );

  expect(html).toContain('href="https://appwrite.biso.no/guide.pdf"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain("guide.pdf");
  expect(html.indexOf("guide.pdf")).toBeLessThan(html.indexOf("after.mp4"));
});

test("does not insert a completed upload when its anchor has disappeared", () => {
  const paragraph = newBlock("p", "Current document");
  const blocks = [paragraph];

  expect(
    applyMediaUpload(
      blocks,
      { afterId: "previous-document-block", kind: "insert" },
      {
        fileId: "image-2",
        fileName: "late.jpg",
        mediaKind: "image",
        mimeType: "image/jpeg",
        size: 512,
        url: "https://appwrite.biso.no/late.jpg",
      }
    )
  ).toBeNull();
  expect(blocks).toEqual([paragraph]);
});

test("replacement keeps the media identity and editable metadata", () => {
  const original = newMediaBlock({
    alt: "Original description",
    caption: "Original caption",
    fileId: "image-old",
    fileName: "old.jpg",
    mediaKind: "image",
    mimeType: "image/jpeg",
    url: "https://appwrite.biso.no/old.jpg",
  });

  expect(
    applyMediaUpload(
      [original],
      { blockId: original.id, kind: "replace" },
      {
        fileId: "image-new",
        fileName: "new.webp",
        mediaKind: "image",
        mimeType: "image/webp",
        size: 1024,
        url: "https://appwrite.biso.no/new.webp",
      }
    )
  ).toEqual([
    {
      ...original,
      fileId: "image-new",
      fileName: "new.webp",
      mimeType: "image/webp",
      url: "https://appwrite.biso.no/new.webp",
    },
  ]);
});

test("ignores an upload completed for an earlier controlled document", () => {
  const blocks = [newBlock("p", "New locale")];

  expect(
    applyPendingMediaUpload(
      blocks,
      { afterId: null, kind: "insert", revision: 3 },
      {
        fileId: "late-file",
        fileName: "late.pdf",
        mediaKind: "file",
        mimeType: "application/pdf",
        size: 2048,
        url: "https://appwrite.biso.no/late.pdf",
      },
      4
    )
  ).toBeNull();
  expect(blocks).toHaveLength(1);
});
