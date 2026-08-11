# Shared publishing editor with inline media

## Context

The news studio currently uses `ContentEditorV1`, while jobs uses the block-based
publishing editor. That leaves news inconsistent with the other studio tools and
creates a lossy migration path for existing Plate documents. The latest PR review
also identified two related correctness issues: media-only Plate documents are
treated as empty, and a department user with no resolved department memberships
can receive an unrestricted department list.

The repository already has an authenticated Appwrite upload action and a public
`media` bucket. The bucket currently accepts images and PDFs up to 10 MB. Inline
media should use this existing storage boundary instead of introducing another
storage service or persisting file data in news rows.

## Goals

- Use one shared block editor implementation for jobs, news, and existing studio
  consumers.
- Support draggable inline images, video, audio, and downloadable file
  attachments.
- Preserve existing HTML and Plate content, including media-only Plate documents.
- Store portable semantic HTML that the current web renderer can display.
- Keep uploads authenticated, validated, and constrained to the Appwrite media
  bucket.
- Address the current department allowlist review finding in the same PR update.

## Non-goals

- A general-purpose digital asset manager or reusable media library browser.
- Editing the bytes of an uploaded asset after upload.
- Deleting bucket files automatically when a block is removed. Files may be
  referenced by published or historical content, so lifecycle cleanup requires a
  separate reference-aware workflow.
- Adding arbitrary executable or web-hosted file types to the public media bucket.

## Editor model

`DescriptionBlock` becomes a discriminated union:

- Text blocks: heading, paragraph, and list item with editable text.
- Media blocks: image, video, audio, or file with URL, file id, MIME type,
  filename, optional caption, and image alt text.

The shared editor owns insertion, upload state, replacement, deletion, keyboard
focus, and drag reordering. Its add controls and slash menu expose all text and
media block types. Jobs and News import this shared component; no content type
keeps a private copy of the editor.

Images render as previews with editable alt text and caption. Video and audio
render with native controls and an editable caption. Other supported files render
as attachment cards with filename and download/open actions. Upload failure leaves
the document unchanged and reports a visible error.

## Storage and upload boundary

The upload boundary remains authenticated on the server and uses the Appwrite
admin client after authorization, preserving the existing behavior for permitted
admin users whose Appwrite team membership may not directly match bucket create
permissions.

A dedicated media upload route accepts the raw file body. This avoids raising the
global Server Action body limit and keeps the upload ceiling local to media. It
validates both size and MIME type before creating the Appwrite file and returns
only the metadata the editor needs: URL, file id, filename, MIME type, and size.

The existing 10 MB bucket ceiling remains the initial limit. The bucket extension
allowlist expands to browser-safe publishing assets:

- Images: JPEG, PNG, GIF, WebP, SVG.
- Video: MP4, WebM, QuickTime.
- Audio: MP3, MP4/M4A, Ogg, WAV, WebM.
- Files: PDF, plain text, CSV, ZIP, Word, Excel, and PowerPoint formats.

HTML, JavaScript, and executable formats remain rejected because media files are
publicly readable. Filename extension and MIME type must both map to an allowed
category; ambiguous or empty types are rejected.

## Persistence and compatibility

The block serializer emits escaped semantic HTML:

- Images use `figure`, `img`, and optional `figcaption`.
- Video and audio use `figure`, their native media element with controls, and an
  optional `figcaption`.
- File attachments use an anchor with `target="_blank"` and `rel="noopener"`, plus
  data attributes that retain media metadata for re-editing.

URLs and user-authored attributes are escaped before serialization. Media metadata
is stored in `data-*` attributes so `htmlToDescriptionBlocks` can reconstruct the
same block without relying on display text.

The parser accepts three inputs:

1. New semantic HTML emitted by the shared editor.
2. Existing jobs-style text HTML.
3. Legacy Plate JSON, including image, video, audio, file, and media-embed nodes
   with meaningful `url` or `src` values.

Existing Plate documents convert to the shared block model when opened. Saving
normalizes them to semantic HTML. Unknown Plate media nodes are preserved as file
attachments when they contain a usable URL, avoiding silent data loss.

The web `PlateContentRenderer` already accepts raw HTML. Its prose/media styling
will be extended only as needed for responsive images, playable media, captions,
and attachment links; legacy Plate JSON rendering stays supported.

## Content validity and permissions

The Plate-content predicate is renamed or generalized so meaningful media nodes
count as content even when their text children are empty. Tests cover `url` and
`src` media nodes, empty paragraph documents, malformed JSON, and HTML bodies.

Department scoping distinguishes roles explicitly:

- Administrators receive `undefined`, meaning unrestricted.
- Department users receive their resolved department id array, including an empty
  array when no membership resolves.

This makes the editor fail closed without changing administrator behavior.

## Testing

Implementation follows red-green-refactor:

- Parser/serializer tests first for every media kind, escaping, mixed ordering,
  and legacy Plate migration.
- Content-predicate regression tests first for media-only and empty documents.
- Permission regression test first for a department user with zero resolved ids.
- Upload validation tests first for accepted categories, MIME/extension mismatch,
  oversize files, and unauthenticated requests.
- Component tests cover insertion and upload-result integration where the current
  admin test harness supports real React interaction without excessive mocking.

After focused tests pass, run admin type checking, Ultracite, the relevant test
suites, and the production build before committing and pushing the PR update.

## Risks and mitigations

- **Public active content:** keep a strict server-side allowlist and reject HTML,
  scripts, and executables.
- **Orphaned uploads:** do not delete eagerly; a future reference-aware cleanup
  can safely collect unreferenced files.
- **Large request memory use:** retain the bucket's 10 MB ceiling and reject by
  content length before reading the body, then verify the actual body size.
- **Lossy legacy conversion:** cover known Plate URL shapes with fixtures and map
  unknown URL-bearing nodes to attachments.
- **Editor drift:** Jobs and News import one shared editor, and the duplicate Jobs
  implementation is removed after behavior is locked by tests.
