# News Shared Media Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put News and Jobs on one media-capable block editor while resolving the two current PR review regressions.

**Architecture:** Extend the portal `DescriptionBlock` model into a discriminated text/media union with pure HTML parsing and serialization. Upload files through a dedicated authenticated App Router endpoint into the existing Appwrite media bucket, then render them in the shared editor. News, Jobs, and Announcements consume that shared editor, including when legacy Plate JSON is migrated.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Bun tests, Appwrite `node-appwrite`, Lucide, Ultracite/Biome.

## Global Constraints

- Keep the public Appwrite `media` bucket capped at 10 MB.
- Support images, video, audio, PDF, text/CSV/ZIP, and Word/Excel/PowerPoint files; reject HTML, scripts, and executables.
- Authenticate uploads server-side and validate filename, MIME type, extension, and actual size.
- Preserve legacy Plate JSON, including URL-bearing nodes without text.
- Store escaped semantic HTML without a new database field or dependency.
- Do not delete Appwrite files when a block is removed.
- Preserve administrator `undefined` department scope and fail closed with `[]` for department users with no resolved departments.
- Use red-green-refactor for every behavior change.

## File map

- `apps/admin/src/app/(portal)/_components/description-blocks.ts`: pure block types, migration, parser, serializer.
- `apps/admin/src/app/(portal)/_components/description-block-editor.tsx`: shared text/media UI.
- `apps/admin/src/lib/inline-media.ts`: pure upload allowlist and filename rules.
- `apps/admin/src/app/api/media/upload/route.test.ts`: route authentication and request-boundary regressions.
- `apps/admin/src/app/api/media/upload/route.ts`: authenticated Appwrite upload.
- `apps/admin/src/app/(portal)/_components/inline-media-upload.ts`: browser upload client.
- `apps/admin/src/lib/plate-content.ts`: text-or-media presence predicate.
- `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-access.ts`: pure department scope helper.
- `apps/admin/src/app/(portal)/news/[id]/_components/news-article-step.tsx`: News integration.
- `apps/admin/src/app/(portal)/jobs/[id]/_components/job-studio-editor.tsx`: Jobs integration and duplicate removal.
- `packages/api/appwrite.config.json`: safe media-bucket extensions.

---

### Task 1: Extend the persistence contract

**Files:**
- Create: `apps/admin/src/app/(portal)/_components/description-blocks.test.ts`
- Modify: `apps/admin/src/app/(portal)/_components/description-blocks.ts`

**Interfaces:**
- Produces: `MediaKind`, `MediaDescriptionBlock`, `DescriptionBlock`, `newMediaBlock`, `htmlToDescriptionBlocks`, `descriptionBlocksToHtml`.

- [ ] **Step 1: Write failing media round-trip tests**

```ts
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
      JSON.stringify([{ children: [{ text: "" }], type: "img", url: "https://example.com/legacy.jpg" }])
    );
    expect(parsed[0]).toMatchObject({
      mediaKind: "image",
      type: "media",
      url: "https://example.com/legacy.jpg",
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run from `apps/admin`:

```bash
bun test './src/app/(portal)/_components/description-blocks.test.ts'
```

Expected: FAIL because media blocks do not exist and Plate media becomes an empty paragraph.

- [ ] **Step 3: Implement the discriminated union and semantic HTML**

```ts
export type MediaKind = "audio" | "file" | "image" | "video";

export interface TextDescriptionBlock {
  id: string;
  text: string;
  type: "h" | "l" | "p";
}

export interface MediaDescriptionBlock {
  alt: string;
  caption: string;
  fileId: string;
  fileName: string;
  id: string;
  mediaKind: MediaKind;
  mimeType: string;
  type: "media";
  url: string;
}

export type DescriptionBlock = MediaDescriptionBlock | TextDescriptionBlock;
```

Use a combined top-level token parser so text and `figure[data-media-kind]` nodes retain ordering. Emit image/video/audio/file figures with escaped `data-*` metadata. Map recognized Plate node types by URL; treat unknown URL-bearing nodes as file attachments.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test './src/app/(portal)/_components/description-blocks.test.ts'
git add 'src/app/(portal)/_components/description-blocks.ts' 'src/app/(portal)/_components/description-blocks.test.ts'
git commit -m "Preserve inline media across publishing edits" -m "Tested: bun test description-blocks.test.ts" -m "Confidence: high" -m "Scope-risk: moderate"
```

---

### Task 2: Fix media presence and department scope

**Files:**
- Create: `apps/admin/src/lib/plate-content.test.ts`
- Modify: `apps/admin/src/lib/plate-content.ts`
- Create: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-access.ts`
- Create: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-access.test.ts`
- Modify: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.ts`
- Modify: `apps/admin/src/app/(portal)/news/[id]/page.tsx`

**Interfaces:**
- Produces: `hasRichContent(value)` and `getNewsAllowedDepartmentIds(isDepartmentUser, memberships)`.

- [ ] **Step 1: Write failing regression tests**

```ts
test("counts URL-bearing Plate media as content", () => {
  expect(hasRichContent(JSON.stringify([
    { children: [{ text: "" }], type: "img", url: "https://example.com/image.jpg" },
  ]))).toBeTrue();
});

test("keeps an empty Plate paragraph empty", () => {
  expect(hasRichContent(JSON.stringify([
    { children: [{ text: "" }], type: "p" },
  ]))).toBeFalse();
});

test("fails closed when a department user resolves no departments", () => {
  expect(getNewsAllowedDepartmentIds(true, [])).toEqual([]);
  expect(getNewsAllowedDepartmentIds(false, [])).toBeUndefined();
});
```

Also add a media-only locale to `news-studio-state.test.ts` and expect `getNewsTranslationInputs` to retain it.

- [ ] **Step 2: Verify RED**

```bash
bun test './src/lib/plate-content.test.ts' './src/app/(portal)/news/[id]/_components/news-studio-access.test.ts' './src/app/(portal)/news/[id]/_components/news-studio-state.test.ts'
```

- [ ] **Step 3: Implement recursive content detection and explicit scope**

```ts
const hasPlateNodeContent = (node: unknown): boolean => {
  if (!(node && typeof node === "object")) return false;
  const record = node as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim()) return true;
  if (typeof record.url === "string" && record.url.trim()) return true;
  if (typeof record.src === "string" && record.src.trim()) return true;
  return Array.isArray(record.children) && record.children.some(hasPlateNodeContent);
};
```

```ts
export const getNewsAllowedDepartmentIds = (
  isDepartmentUser: boolean,
  memberships: Array<{ department_ref?: { $id?: string | null } | null }>
): string[] | undefined =>
  isDepartmentUser
    ? memberships
        .map((membership) => membership.department_ref?.$id)
        .filter((id): id is string => Boolean(id))
    : undefined;
```

Update schema/state callers to use `hasRichContent`, and update `page.tsx` to use the helper.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test './src/lib/plate-content.test.ts' './src/app/(portal)/news/[id]/_components/news-studio-access.test.ts' './src/app/(portal)/news/[id]/_components/news-studio-state.test.ts'
git add src/lib/plate-content.ts src/lib/plate-content.test.ts 'src/app/(portal)/news/[id]/_components/news-studio-access.ts' 'src/app/(portal)/news/[id]/_components/news-studio-access.test.ts' 'src/app/(portal)/news/[id]/_components/news-studio-state.ts' 'src/app/(portal)/news/[id]/page.tsx'
git commit -m "Keep media translations scoped and intact" -m "Tested: focused plate content, access, and news state tests" -m "Confidence: high" -m "Scope-risk: narrow"
```

---

### Task 3: Add the authenticated Appwrite upload boundary

**Files:**
- Create: `apps/admin/src/lib/inline-media.ts`
- Create: `apps/admin/src/lib/inline-media.test.ts`
- Create: `apps/admin/src/app/api/media/upload/route.test.ts`
- Create: `apps/admin/src/app/api/media/upload/route.ts`
- Create: `apps/admin/src/app/(portal)/_components/inline-media-upload.ts`
- Modify: `packages/api/appwrite.config.json`

**Interfaces:**
- Produces: `InlineMediaUpload`, `classifyInlineMedia`, `sanitizeInlineMediaFilename`, `uploadInlineMedia`.
- Consumes: `requireApiAuth`, `createAdminClient`, `MEDIA_BUCKET_ID`, `getStorageFileUrl`.

- [ ] **Step 1: Write failing allowlist tests**

```ts
test.each([
  ["photo.webp", "image/webp", "image"],
  ["clip.mp4", "video/mp4", "video"],
  ["voice.mp3", "audio/mpeg", "audio"],
  ["guide.pdf", "application/pdf", "file"],
] as const)("classifies %s", (filename, mimeType, expected) => {
  expect(classifyInlineMedia(filename, mimeType)).toBe(expected);
});

test("rejects active and mismatched content", () => {
  expect(classifyInlineMedia("page.html", "text/html")).toBeNull();
  expect(classifyInlineMedia("photo.jpg", "application/javascript")).toBeNull();
});

test("keeps the Appwrite bucket ceiling", () => {
  expect(INLINE_MEDIA_MAX_BYTES).toBe(10 * 1024 * 1024);
});
```

Add route tests through an exported `handleInlineMediaUpload(request, dependencies)` function. Keep authentication and Appwrite as injected external boundaries while exercising the real request handler:

```ts
test("rejects an unauthenticated upload before reading or storing it", async () => {
  let createCalls = 0;
  const response = await handleInlineMediaUpload(
    new Request("http://admin.test/api/media/upload", {
      body: new Blob(["photo"], { type: "image/jpeg" }),
      headers: { "content-type": "image/jpeg", "x-filename": "photo.jpg" },
      method: "POST",
    }),
    {
      authenticate: async () => false,
      createFile: async () => {
        createCalls += 1;
        return { fileId: "unexpected" };
      },
    }
  );
  expect(response.status).toBe(401);
  expect(createCalls).toBe(0);
});

test("rejects an extension and MIME mismatch before storage", async () => {
  const response = await handleInlineMediaUpload(
    new Request("http://admin.test/api/media/upload", {
      body: new Blob(["script"], { type: "application/javascript" }),
      headers: { "content-type": "application/javascript", "x-filename": "photo.jpg" },
      method: "POST",
    }),
    {
      authenticate: async () => true,
      createFile: async () => ({ fileId: "unexpected" }),
    }
  );
  expect(response.status).toBe(415);
});
```

- [ ] **Step 2: Verify RED**

```bash
bun test './src/lib/inline-media.test.ts' './src/app/api/media/upload/route.test.ts'
```

- [ ] **Step 3: Implement validation, route, and browser client**

```ts
export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (auth.response) return auth.response;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > INLINE_MEDIA_MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }

  const fileName = sanitizeInlineMediaFilename(
    decodeURIComponent(request.headers.get("x-filename") ?? "upload")
  );
  const mimeType = request.headers.get("content-type") ?? "";
  const mediaKind = classifyInlineMedia(fileName, mimeType);
  if (!mediaKind) {
    return NextResponse.json({ error: "Unsupported or mismatched file type" }, { status: 415 });
  }

  const blob = await request.blob();
  // Reject zero bytes and verify the actual size again before Appwrite creation.
  return dependencies.createFile({
    bytes: Buffer.from(await blob.arrayBuffer()),
    fileName,
    mediaKind,
    mimeType,
    size: blob.size,
  });
}
```

`POST` supplies real dependencies: `requireApiAuth` for `authenticate`, and an Appwrite admin-client adapter for `createFile` that returns `NextResponse.json({ file: { fileId, fileName, mediaKind, mimeType, size, url } })`. The client posts the raw `File`, URI-encodes `x-filename`, checks `response.ok`, validates the returned object, and throws the server error on failure. Extend only the media bucket extension array; retain permissions and 10 MB.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test './src/lib/inline-media.test.ts' './src/app/api/media/upload/route.test.ts'
bun run check-types
git add src/lib/inline-media.ts src/lib/inline-media.test.ts src/app/api/media/upload/route.ts src/app/api/media/upload/route.test.ts 'src/app/(portal)/_components/inline-media-upload.ts' ../../packages/api/appwrite.config.json
git commit -m "Accept safe publishing media through Appwrite" -m "Constraint: Public uploads stay allowlisted and capped at 10 MB." -m "Tested: media validator tests and admin typecheck" -m "Confidence: high" -m "Scope-risk: moderate"
```

---

### Task 4: Add media UI to the shared editor

**Files:**
- Create: `apps/admin/src/app/(portal)/_components/description-block-editor.test.tsx`
- Modify: `apps/admin/src/app/(portal)/_components/description-block-editor.tsx`

**Interfaces:**
- Consumes: `MediaDescriptionBlock`, `newMediaBlock`, `uploadInlineMedia`.
- Preserves: `DescriptionBlockEditor({ value, onChange, placeholder })`.

- [ ] **Step 1: Add a failing server-rendered editor test**

```ts
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DescriptionBlockEditor } from "./description-block-editor";

test("offers the shared inline media upload control", () => {
  const html = renderToStaticMarkup(
    <DescriptionBlockEditor onChange={() => undefined} value="" />
  );
  expect(html).toContain(">Media</button>");
  expect(html).toContain("video/mp4");
  expect(html).toContain("audio/mpeg");
  expect(html).toContain("application/pdf");
});
```

- [ ] **Step 2: Verify RED, then implement `MediaBlockRow`**

```bash
bun test './src/app/(portal)/_components/description-block-editor.test.tsx'
```

Expected: FAIL because the shared editor has no Media control or all-media file input.

Add a Media button to the bottom bar and slash menu. Use a hidden file input with insertion/replacement target state. Commit a new block only after `uploadInlineMedia(file)` succeeds. Render images with `next/image`, video/audio with native controls and `preload="metadata"`, and other files as attachment cards. Add editable alt text for images, captions, Replace/Remove buttons, loading feedback, toast errors, and the existing drag behavior.

- [ ] **Step 3: Verify GREEN and commit**

```bash
bun test './src/app/(portal)/_components/description-block-editor.test.tsx' './src/app/(portal)/_components/description-blocks.test.ts'
bun run check-types
bun x ultracite check 'src/app/(portal)/_components/description-block-editor.tsx' 'src/app/(portal)/_components/description-blocks.ts'
git add 'src/app/(portal)/_components/description-block-editor.tsx' 'src/app/(portal)/_components/description-block-editor.test.tsx'
git commit -m "Let publishing blocks carry inline media" -m "Tested: block tests, admin typecheck, focused Ultracite" -m "Confidence: high" -m "Scope-risk: moderate"
```

---

### Task 5: Integrate News and Jobs

**Files:**
- Modify: `apps/admin/src/app/(portal)/news/[id]/_components/news-article-step.tsx`
- Modify: `apps/admin/src/app/(portal)/news/[id]/_components/news-article-step.test.tsx`
- Modify: `apps/admin/src/app/(portal)/jobs/[id]/_components/job-studio-editor.tsx`

**Interfaces:**
- Consumes: the shared `DescriptionBlockEditor`.

- [ ] **Step 1: Change the News test first**

```ts
const norwegianEditor = findElementByType(
  NewsArticleStep({ locale: "no", setValue, values }),
  DescriptionBlockEditor
);
const englishEditor = findElementByType(
  NewsArticleStep({ locale: "en", setValue, values }),
  DescriptionBlockEditor
);
expect(norwegianEditor?.props.value).toBe("Norsk brødtekst");
expect(englishEditor?.props.value).toBe("");
```

- [ ] **Step 2: Verify RED**

```bash
bun test './src/app/(portal)/news/[id]/_components/news-article-step.test.tsx'
```

- [ ] **Step 3: Switch News and remove the private Jobs editor**

Replace the News `ContentEditor` import/render with the shared editor while preserving locale values and callbacks. In Jobs, import the same shared editor and delete only the local editor, row, and editor-only helpers/imports.

- [ ] **Step 4: Verify GREEN and commit**

```bash
bun test './src/app/(portal)/news/[id]/_components/news-article-step.test.tsx' './src/app/(portal)/news/[id]/_components/news-studio-state.test.ts' './src/app/(portal)/news/[id]/_components/news-studio-preview.test.tsx'
bun run check-types
git add 'src/app/(portal)/news/[id]/_components/news-article-step.tsx' 'src/app/(portal)/news/[id]/_components/news-article-step.test.tsx' 'src/app/(portal)/jobs/[id]/_components/job-studio-editor.tsx'
git commit -m "Keep publishing tools on one editor" -m "Rejected: Keep a private Jobs editor | it would let content tools drift again." -m "Tested: news tests and admin typecheck" -m "Confidence: high" -m "Scope-risk: moderate"
```

---

### Task 6: Verify and update PR #49

**Files:** Review every Task 1-5 change.

- [ ] **Step 1: Format and inspect**

```bash
bun x ultracite fix
git diff --check
git status --short
```

- [ ] **Step 2: Run full verification**

```bash
bun --cwd apps/admin test
bun --cwd apps/admin run check-types
bun --cwd apps/admin run lint
bun --cwd apps/admin run build
bun test packages/api/appwrite-config.test.ts
```

All commands must exit 0. Debug failures before continuing.

- [ ] **Step 3: Push and re-fetch review threads**

```bash
git push origin codex/news-publishing-studio
```

Run the bundled GitHub `fetch_comments.py` for PR 49. Confirm the media-only and department-scope comments point to superseded code. Do not reply to or resolve threads without explicit user authorization.

- [ ] **Step 4: Report evidence and operational follow-up**

Report changed files, duplicate removal, supported media categories, tests/build results, and pushed commit. State that the updated Appwrite bucket configuration must be deployed before production accepts newly allowed extensions.
