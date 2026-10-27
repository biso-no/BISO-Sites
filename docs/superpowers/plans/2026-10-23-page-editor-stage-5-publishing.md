# Page editor stage 5: project pages, publishing and uploads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A national project's page lives at `/projects/<slug>`, and its board can edit it.
- Only `globaladmin` can build a multi-campus project hub page.
- Publish and unpublish refresh the site within seconds.
- Files up to 250 MB upload in chunks.
- The copilot speaks the new document model.
- The editor's save and publish edges no longer drop work.

**Architecture:**
- **Routing.** The coded `/projects/[slug]` hub gains a first branch. It renders the published editor page stored at slug `projects/<slug>` through the same server pipeline as the catch-all and unit pages. That pipeline is factored into one helper: normalize → sanitize → feeds → prune → theme → `RenderedPage`.
- **Admin guards.** The `projects/` slug namespace is reserved the way `units/` is. `createUnitPage` writes `projects/<slug>` for national project units, and a new globaladmin-only action creates multi-campus hub pages.
- **Revalidation.** Publish and unpublish call the existing `notifyWebsite` hook with new cache tags.
- **Uploads.** The browser splits large files into 5 MiB chunks. The admin route forwards each chunk to Appwrite's chunked upload with the service key, and an HMAC token binds every chunk after the first to the upload that was authorised.

**Tech Stack:** Next.js 16 (cacheComponents), React 19.2, TypeScript strict, Bun. Tests use vitest (`apps/web`, `packages/shared`, `packages/api`) and bun:test with happy-dom (`packages/editor`, `apps/admin`).

**Spec:** `docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md`. Read D1, D3, C3, C4, C5, C5a, C7 and C11, the "Stage 1/2/3/4 done" notes, and their "Owed / known" lists.

## Global Constraints

- **Tooling.**
  - Bun only. `bun run check-types` must pass, and `bun x ultracite fix` runs on changed files.
  - Never run `next build` while a dev server uses that app's folder.
  - `apps/admin` `"use server"` files export only async functions. After touching one, the controller runs `bun run build --filter=admin` at the end of the stage.
- **Tests.**
  - `packages/editor` and `apps/admin` use `bun test`; `apps/web`, `packages/shared` and `packages/api` use `bunx vitest run`.
  - The full admin `bun test` must stay green (1813+).
  - Admin `mock.module` use goes in `.cases.ts` files run by a child-process runner (pattern: `apps/admin/src/app/api/pages/route-cases.test.ts`).
- **Data and schema.** All Appwrite access goes through `@repo/api`. Edit `appwrite.config.json` only to set the `media` bucket to 250 MB (Markus raised it in the console on 2026-10-27 and pushes the file); nothing else.
- **Editor UI.** The editor interface keeps its current look (D10). New controls reuse `.pe-*`.
- **Production (D13).**
  - Unpublished test pages and media may be created and must be deleted and listed.
  - Never publish, never push schema, never `git push`, never edit a real department.
  - Never use `git stash`, because the checkout is shared.
- **Spec values (verbatim).**
  - C3: "the unit URL (`/units/national/wintergames`) redirects to `/projects/winter-games` once a page exists."
  - C4: "Hub and national-project pages use the slug `projects/<project-slug>`, reserved like `units/` is today … A multi-campus hub page has no department, so only `globaladmin` can edit it."
  - C5a: "the browser sends large files to the admin route in chunks of a few MB, and the route forwards each chunk to Appwrite's chunked upload (same file ID, `Content-Range`) with the service key."
- **Commits.** End every commit message with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01H48AWgSdxtsCEZGyPFzJyq`

## Review Focus

1. **A page stored at `projects/<slug>` must render only where it belongs.** The catch-all must never serve it. `/projects/<slug>` must serve it only when the slug is a known project (`isProjectSlug`) and the page is published. A department user must not be able to create a `projects/…` page by renaming one. Tests: Tasks 1 and 2.
2. **A chunk with a forged or reused upload token, a chunk past the authorised total, or a MIME that changes mid-upload** is rejected with 4xx before anything reaches Appwrite. Tests: Task 6.
3. **The editor closes, or Publish is pressed, within the 800 ms autosave debounce.** Expected: the pending edit is saved first, and publish publishes it. Tests: Task 5.
4. **Unpublishing one locale while the other stays published.** Expected: the other locale stays live, and the page row stays `published`. Tests: Task 4.
5. **The copilot sets a theme that fails contrast.** Expected: the tool refuses with the nearest passing shade, and nothing is written. Tests: Task 7.

---

### Task 1: `/projects/<slug>` renders a published editor page; national unit URL redirects

**Files:**
- Create: `apps/web/src/lib/published-editor-page.tsx`. This is the shared server pipeline.
- Modify:
  - `apps/web/src/app/(public)/[...slug]/page.tsx` and `apps/web/src/app/(public)/units/[...segments]/page.tsx`, which both switch to the helper.
  - `apps/web/src/app/(public)/projects/[slug]/page.tsx`, for the page branch and metadata.
  - `apps/web/src/app/(public)/units/[...segments]/resolve.ts`, or wherever the national-unit resolution lives, for the C3 redirect.
  - `apps/web/src/app/api/form/submit/route.ts`, so the `projects/` ownership rule matches the route.
- Tests: next to each route, plus `published-editor-page.test.tsx`.

**Interfaces:**
- Produces:
  - `projectPageSlug(project: ProjectSlug): string` → `"projects/<project>"`, and `isProjectPageSlug(slug: string | null | undefined): boolean`. Both live in `packages/shared/utils/project-units.ts` and are reused by admin in Task 2.
  - `renderPublishedEditorPage(input: { result: PublishedPageResult; locale: PublicLocale; slug: string; departmentTheme: … | null }): Promise<ReactNode>`. It is the one pipeline the catch-all, the unit page and `/projects/<slug>` all call.
- Rules:
  - `/projects/<slug>` with `isProjectSlug(slug)` looks up `cachedPublishedPage("projects/<slug>", locale)`. When that finds a page, the editor page renders, taking its theme from the page's department when bound. Otherwise the coded hub renders as today.
  - `generateMetadata` uses the page's title and description when the page exists.
  - **C3 redirect:** `/units/national/<unitSlug>` permanent-redirects to `/projects/<project>` when `projectSlugForUnit(unitSlug)` is set AND a published page exists at `projects/<project>`. Otherwise it stays as today.
  - The catch-all returns 404 for any slug that starts with `projects/`. Its static sibling route already wins for two segments, so this is belt and braces for deeper paths.
  - In the form-submit route, a `projects/<x>` slug is accepted only when `isProjectSlug(x)`, exactly what the route renders.

- [ ] **Step 1: Write the failing tests.**
  - The projects route renders the editor page when `cachedPublishedPage("projects/winter-games")` returns one. It renders the coded hub when that returns null.
  - Metadata uses the page title.
  - `/units/national/wintergames` redirects only when the page exists.
  - The catch-all 404s for `["projects","x","y"]`.
  - The submit route rejects `projects/not-a-project`.
  - The three routes call `renderPublishedEditorPage`. Prove it with one mock assertion each.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd apps/web && bunx vitest run 'src/app/(public)' src/lib src/app/api/form`
- [ ] **Step 3: Implement.**
  - Move, don't duplicate: the catch-all's normalize, sanitize, feeds, prune and theme sequence becomes the helper.
- [ ] **Step 4: Run them and watch them pass.** Then run the full web vitest and `bun run check-types`.
- [ ] **Step 5: Commit** with message `feat(web): project pages at /projects/<slug>; national unit URL redirects there`.

---

### Task 2: Admin owns the `projects/` namespace

**Files:**
- Modify:
  - `apps/admin/src/lib/unit-page-guard.ts`, adding `assertProjectPageNamespace`.
  - `apps/admin/src/app/(portal)/_actions/pages.ts`. `savePageEditorDoc` calls the guard next to `assertUnitPageNamespace`. Edits of a hub page (no department, slug `projects/…`) require `globaladmin`.
  - `apps/admin/src/app/(portal)/_actions/departments.ts` (`createUnitPage`, about line 659). A national-campus unit whose slug maps to a project gets `projects/<project>` instead of `units/national/<slug>`.
  - Add `createProjectHubPage(project: ProjectSlug)`. It is globaladmin only, creates the page with no department at `projects/<project>`, and is idempotent like `createUnitPage`.
  - The editor page loader, `apps/admin/src/app/(editor)/pages/[id]/page.tsx`. A `projects/` page locks slug and department, the way unit pages do.
  - The admin UI entry point for `createProjectHubPage`. Put it where globaladmin manages pages, as one button next to the existing "Create page".
- Tests: `unit-page-guard.test.ts` and a `.cases.ts` for the actions.

**Interfaces:**
- Consumes: Task 1 `projectPageSlug` and `isProjectPageSlug`.
- Produces:
  - `assertProjectPageNamespace(persistedSlug: string | null | undefined, nextSlug: string): string | null`. It has the same rule shape as `assertUnitPageNamespace`.
  - `createProjectHubPage(project: string): Promise<{ pageId: string } | { error: string }>`.

- [ ] **Step 1: Write the failing tests.**
  - **Namespace guard:**
    - Saving a new page at `projects/winter-games` from the editor is refused.
    - So is renaming `about` → `projects/x`.
    - A page already at `projects/winter-games` saves itself.
  - **`createUnitPage`:**
    - For the national Wintergames unit it creates `projects/winter-games`, bound to that unit.
    - For a campus Fadderullan unit it still creates `units/oslo/fadderullan`.
  - **`createProjectHubPage`:**
    - It refuses non-globaladmins.
    - It refuses an unknown project.
    - It is idempotent.
  - **Hub page edits:** a department user editing a hub page is refused, and a globaladmin is allowed.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd apps/admin && bun test unit-page-guard`, plus the new cases.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and watch them pass.** Then run the full admin `bun test` and `bun run check-types`.
- [ ] **Step 5: Commit** with message `feat(admin): projects/ pages for national projects and globaladmin hubs`.

---

### Task 3: Publish refreshes the site (C5)

**Files:**
- Modify:
  - `apps/admin/src/lib/web-revalidate.ts` (`WebsiteTag` adds `"pages"` and `"departments"`)
  - `apps/web/src/app/api/revalidate/route.ts` (`ALLOWED_TAGS`)
  - `apps/web/src/lib/data/public-content.ts`:
    - add `cacheTag("pages")` on `cachedPublishedPage`;
    - add `cacheTag("departments")` on `cachedDepartmentTheme` and on the three readers that select `DEPARTMENT_SELECT`.
  - `apps/admin/src/app/(portal)/_actions/pages.ts`:
    - `publishPageAction` and `unpublishPageAction` call `notifyWebsite(["pages"])`;
    - when the department theme was written, they call `["pages","departments"]`.
- Tests: the revalidate route test, the `notifyWebsite` callers (`.cases.ts`), and a tag assertion in the public-content tests.

- [ ] **Step 1: Write the failing tests.**
  - The route accepts `pages` and `departments` and still rejects anything else.
  - Publish calls `notifyWebsite` once with `["pages"]`, or with `["pages","departments"]` after a theme copy.
  - Unpublish calls it with `["pages"]`.
  - A `notifyWebsite` failure never fails the action. It is already best-effort; assert it.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and watch them pass.** Run the full admin and web suites.
- [ ] **Step 5: Commit** with message `feat: publishing refreshes the website within seconds`.

---

### Task 4: C11 — one-locale unpublish; department dropdown shows only editable departments

**Files:**
- Modify:
  - `packages/api/page-builder.ts`, `unpublishPage` at about line 640
  - `apps/admin/src/app/(portal)/_actions/departments.ts`, `listAllDepartments` at about line 249, or the editor page's mapping
- Tests: `packages/api/page-builder.test.ts`, and an admin case for the dropdown.

**Interfaces:**
- `unpublishPage` sets the translation's `is_published: false`. It sets the page row to `draft`, with draft permissions, only when no other locale of that page is still published. Otherwise the row stays `published` with its published permissions.
- The editor's department list for a user without campus or global admin rights contains only the departments they can edit. Use the same predicate `savePageEditorDoc` enforces; don't invent a second one.

- [ ] **Step 1: Write the failing tests.**
  - Unpublishing `en` while `no` is published leaves the row `published`.
  - Unpublishing the last published locale makes it `draft`.
  - A department user sees only their own departments. A campus admin sees their campus. A global admin sees all.
- [ ] **Steps 2–4: Watch them fail, implement, and run the full api, admin and type suites.**
- [ ] **Step 5: Commit** with message `fix: unpublishing one language keeps the other live; editors see only their departments`.

---

### Task 5: Saves and Publish never drop work

**Files:**
- Modify:
  - `packages/editor/src/components/editor-shell/index.tsx`, the autosave effect and publish callbacks
  - `apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx`, the save, create and publish handlers
  - The link-name field in the inspector's button fields (`inspector/button-fields.tsx`)
- Tests: shell DOM tests in `packages/editor`, and `page-editor-client` cases in admin.

**Interfaces:**
- **Pending save:** the shell exposes `flushPendingSave(): Promise<void>`. It runs the debounced save immediately and resolves when the save is stored.
- **Publish:** Publish awaits `flushPendingSave()` before calling `onPublish`.
- **Unmount and page hide:** on unmount, and on `pagehide`, the shell flushes a pending save. Use `navigator.sendBeacon` only if the host provides a beacon URL; otherwise use a best-effort fetch with `keepalive`. If the host's save path is a server action that can't run keepalive, the host passes an `onFlush` callback and documents the limit.
- **First create:** saves are serialised in the host. A second save while the first create is in flight waits, then uses the new page id. It never creates a second row. This is the stage 1 carried item, "two saves racing on a page's first create".
- **Publishing an untouched locale:** if that locale has no translation row, the host saves the current document for that locale first, then publishes. If saving isn't allowed, it shows "Save this language before publishing" instead of "No translation found".
- **Link-name field:** Enter commits the value and keeps focus in the field.
- **Shared-meta sync race** (carried from the stage 4 final review). `syncSharedDraftMeta` in `packages/api/page-builder.ts` (~602–615) reads and rewrites the other locale's whole `draft_doc`. Re-read the row before writing. If its `$updatedAt` changed since the read, merge the shared meta into the fresh doc and retry once. Never write back older content.
- **Stale-tab theme** (carried from the stage 4 final review). On save of a department-bound page, drop an incoming `meta.theme` that equals the department's current theme. This stops a stale second tab from re-attaching a theme that Publish already moved to the department.

- [ ] **Step 1: Write the failing tests.**
  - An edit, then Publish within 800 ms → the save happens before the publish, and the published doc contains the edit.
  - An edit, then unmount within 800 ms → the save is called.
  - Two rapid saves on `/pages/new` → exactly one create call, and the second save is an update with the new id.
  - Publishing the empty `en` locale → no "No translation found"; it's either saved and published, or a clear message is shown.
  - Enter in the link-name field → value committed and `document.activeElement` unchanged.
  - Sync race: the other locale's row changes between the read and the write → its newer content is kept, and the shared meta is merged in.
  - Stale tab: saving a department page with `theme` equal to the department's theme stores no theme.
- [ ] **Steps 2–4: Watch them fail, implement, and run the full editor and admin suites plus `check-types`.**
- [ ] **Step 5: Commit** with message `fix(editor): publish and leaving the page save pending edits first`.

---

### Task 6: Chunked uploads up to 250 MB (C5a)

**Files:**
- Create:
  - `packages/api/storage-chunks.ts`, a server-only chunk forwarder. It is exported through the `@repo/api` server entry and uses the admin client's endpoint, project and key.
  - `apps/admin/src/lib/upload-token.ts`, which HMACs with a server secret. Use an existing server-only secret such as `APPWRITE_API_KEY`-derived material, or `CRON_SECRET`. Document the choice; add a new secret only if neither fits, and add it to `turbo.json` if so.
- Modify:
  - `apps/admin/src/app/api/upload/route.ts`, adding a chunk mode
  - `apps/admin/src/lib/upload-client.ts`, which chunks files over 5 MiB
  - `apps/admin/src/lib/upload-buckets.ts`, where the video limit is 250 MB (262,144,000 bytes, as commit a2671a0c already set) for the `media` bucket, and `packages/api/appwrite.config.json` sets the `media` bucket `maximumFileSize` to 262144000. Images stay at 10 MB and documents at 25 MB.
- Tests: `upload-token.test.ts`, upload route `.cases.ts`, `upload-client.test.ts`, and `storage-chunks.test.ts` (vitest, fetch mocked).

**Interfaces:**
- `CHUNK_BYTES = 5 * 1024 * 1024`. This is Appwrite's chunk size. Check `skills appwrite:typescript` or the Appwrite docs for the exact rule, and match it.
- `forwardChunk(input: { bucketId: string; fileId: string; filename: string; mime: string; start: number; end: number; total: number; chunk: Blob }): Promise<{ done: boolean; fileId: string; url?: string }>`. It POSTs to `<endpoint>/storage/buckets/<bucket>/files` with:
  - `content-range: bytes start-end/total`
  - `x-appwrite-id: fileId` on every chunk after the first
  - the project and key headers
- **Route chunk protocol:**
  - **First chunk:** form fields `total`, `mime` and `filename`. The server checks the bucket allow-list, that the MIME is allowed, and that `total` is within the per-type limit. It generates `fileId` and returns `{ fileId, token }`, where `token` is the HMAC of `fileId|bucket|mime|total`.
  - **Next chunks:** they carry `fileId`, `token`, `start` and `end`. The server verifies the token. It rejects:
    - a chunk with `end >= total`;
    - a chunk longer than `CHUNK_BYTES`, except the last;
    - a chunk whose MIME differs from the first.
  - **Last chunk:** returns `{ url }`, the same `/view` URL shape the single-request path returns.
- Files of 5 MiB or less keep the existing single-request path, unchanged.

- [ ] **Step 1: Write the failing tests.**
  - The token round-trips. A forged token fails, and so does a token for another `fileId`.
  - The route rejects:
    - an over-limit `total`;
    - an `image/png` total over 10 MB;
    - a `video/mp4` total over 250 MB;
    - a forged token;
    - an `end >= total`;
    - an oversize middle chunk.

    None of these calls `forwardChunk`.
  - A 3-chunk upload calls `forwardChunk` three times with the correct ranges, and returns the `/view` url.
  - The client splits a 12 MiB file into 5 + 5 + 2 MiB and reports progress.
- [ ] **Steps 2–4: Watch them fail, implement, and run the full admin suite, the api vitest and `check-types`.**
- [ ] **Step 5: Commit** with message `feat(admin): chunked uploads up to 250 MB for media`.

---

### Task 7: The copilot speaks sections, columns and themes (C7)

**Files:**
- Modify:
  - `packages/editor/src/ai/tools/index.ts`
  - `packages/editor/src/ai/prompt.ts`
  - `packages/editor/src/components/editor-shell/copilot/chat-panel.tsx`
  - `packages/editor/src/editor/serialize.ts` (`serializePageForAI`) if needed
- Tests: `ai/tools` tests and `chat-panel` tests.

**Interfaces:**
- **New tools:**
  - `insert_section({ columns: SectionColumns; background?: SectionBackground; afterSectionId?: string })` → the new section id.
  - `insert_block({ type, sectionId?, columnIndex?, afterBlockId? })`, extended so it can target a column.
  - `set_theme({ dark: string; accent: string } | { reset: true })`. It validates with `checkTheme`. On failure it returns an error naming the failing colour, the ratio and the suggestion, and writes nothing.
- **Insertable blocks:** every registered block type, derived from the registry as the palette is.
- **`bind_collection`:** its description says `source` is a department id, not a collection id. This is stage 3 final finding #11.
- **Serialization:** the AI document view shows sections, columns and the theme line from stage 4.

- [ ] **Step 1: Write the failing tests.**
  - `insert_section` adds a section with the given columns.
  - `insert_block` into column 2 of a 1-1 section lands there.
  - `set_theme` with `#9b5de5` dark fails with a suggestion and leaves the theme unchanged.
  - `set_theme` with a passing pair sets it.
  - `reset` sets it to null.
  - The tool enum of insertable types equals the registry keys.
  - The `bind_collection` description mentions "department".
- [ ] **Steps 2–4: Watch them fail, implement, and run the editor suite and `check-types`.**
- [ ] **Step 5: Commit** with message `feat(editor): copilot inserts sections and columns and sets themes within the contrast rules`.

---

### Task 8: Forms on members-only pages

**Files:**
- Modify:
  - `apps/web/src/app/api/form/submit/route.ts`
  - `apps/web/src/lib/form-submit.ts`, if the lookup moves there
- Tests: the route test.

**Interfaces:**
- When the public lookup finds no page, the route looks the page up with the admin client. If that page is published with `visibility` members (`PagesVisibility.AUTHENTICATED`), the submission is accepted only from a signed-in member. Use the site's existing membership check (`getAuthStatus` / the membership helper in `src/lib`), not a new one.
- Anyone else gets 403 `{ success: false, error: "members_only" }`.
- Drafts are still never read.

- [ ] **Step 1: Write the failing tests.**
  - Members-only page and a member → 200.
  - Members-only page and an anonymous visitor → 403.
  - Draft page → 404.
- [ ] **Steps 2–4: Watch them fail, implement, and run the full web vitest and `check-types`.**
- [ ] **Step 5: Commit** with message `fix(web): forms on members-only pages accept members`.

---

### Task 9: Verification and stage note

- [ ] **Step 1: Run every suite** and record the counts. That covers check-types; editor, admin, web, shared and api; and ultracite on the changed paths.
- [ ] **Step 2: Controller checks.**
  - Run `bun run build --filter=admin` when no admin dev server is up.
  - Run the web `next build` when no dev server uses `apps/web`, then make one request against the standalone server (`node apps/web/.next/standalone/apps/web/server.js` on a spare port). This has been owed since stage 3: sanitize-html is CJS and requires the ESM-only htmlparser2.
  - **D13 production check:** admin sign-in is Microsoft OAuth, so run it from a one-off bun script in the scratchpad, using the `@repo/api` admin client and the same `forwardChunk` the route uses.
    - Upload one test video of about 30 MB in 5 MiB chunks to the `media` bucket, and check that its `/view` URL serves `video/mp4` with the full length.
    - Delete the file, and list it in the hand-over.
    - Do not create pages in this step; stage 6 creates the real Winter Games draft.
- [ ] **Step 3: Append "Stage 5 done" to the spec and commit** with message `docs: record stage 5 completion`.
