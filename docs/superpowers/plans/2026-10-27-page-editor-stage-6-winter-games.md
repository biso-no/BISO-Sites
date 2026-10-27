# Page editor stage 6: the Winter Games page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Winter Games board finds a finished, unpublished draft at `/projects/winter-games`. It is built from the new blocks in Norwegian and English, with the aftermovie, a looping header clip, stills and the team. All media is processed for the web.

**Architecture:**
- **Media.** A repo script turns `temp/` sources into web-ready media with ffmpeg: a web encode of the aftermovie, a 4-second muted header loop, posters, and stills.
- **Upload.** A second script uploads the media to the `media` bucket with fixed file ids, using the stage 5 chunk forwarder, and writes a committed manifest of the resulting URLs.
- **Page document.** A pure builder turns the manifest and a locale into the page document. A noindex preview route renders it through the real `RenderedPage`, so it can be checked visually.
- **Draft.** A third script writes the two locale drafts to production, bound to the national Wintergames unit at `projects/winter-games`. It never publishes.

**Tech Stack:** ffmpeg/ffprobe (installed at `/opt/homebrew/bin`), Bun scripts, Next.js 16, the `@repo/editor` document model, and `@repo/api` (admin client, `storage-chunks`). Tests run on vitest in `apps/web`.

**Spec:** `docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md`. Read "The Winter Games page", C6, C8, C9, C10, D13, and the "Stage 1–5 done" notes. The approved mockup is `.superpowers/brainstorm/9164-1792732362/content/winter-games-page-v3.html`.

## Global Constraints

- Bun only. `bun run check-types` must pass, and `bun x ultracite fix` runs on the changed files.
- **Sources stay out of git.** `temp/` is git-ignored and is where the sources live; processed media goes to `temp/wg-media/`. Never commit media files. Only the manifest (URLs and metadata) is committed.
- **Production writes (D13).** Production gets the uploaded media and ONE unpublished draft page, bound to the national Wintergames unit. **Never publish**, never touch another page or department, and never push the schema. Both scripts default to a dry run, and `--write` performs the writes. The controller runs `--write`, not an implementer.
- **Never** run `git stash` (shared checkout), `git push`, or `next build` while a dev server uses that app.
- **Content** (spec, verbatim):
  - Theme: none (BISO navy and sky).
  - Team: "role emails (C9)" and no phone numbers.
  - "Red Bull branding is visible in this photo and in much of the aftermovie". Markus is aware, so no editing is needed.
- **C6 media targets:**
  - Aftermovie: H.264 1080p at about 4.5 Mbps with `+faststart` (about 45 MB), plus a poster frame.
  - Header loop: a separate muted 4-second clip at 720p, about 1–2 MB, with no audio.
- **C10:** the English version is hand-written, not machine-translated. The exact English copy is in Task 3.
- **Commits** end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01H48AWgSdxtsCEZGyPFzJyq`

## Review Focus

1. **A re-run of either script.** Expected: it is idempotent. Fixed file ids mean existing media is skipped. An existing draft at `projects/winter-games` bound to the Wintergames unit gets its drafts updated. A page there bound to anything else aborts. It never publishes. Tested in Tasks 2 and 4.
2. **Reduced motion and slow phones.** The header loop has a still poster, and the aftermovie preloads only metadata and has a poster. No autoplay with sound. Tested in Tasks 3 and 5.
3. **The English page.** It is complete: no Norwegian strings remain, apart from the names, emails, place names and "@bisowintergames". Tested in Task 3.
4. **Personal data.** No phone numbers appear anywhere: in the document, the manifest, the scripts or the commits. The contact list PDF stays in `temp/`. Tested in Task 3.
5. **The Wintergames unit is missing or inactive in production.** Expected: the seed script stops with a clear message and writes nothing. Tested in Task 4.

---

### Task 1: Web-ready media from the sources

**Files:**
- Create: `scripts/winter-games/process-media.sh`, a bash script that is idempotent and overwrites its outputs.
- Create: `scripts/winter-games/media-spec.json`. It lists every output: name, type, source, timecodes, size, and the target dimensions and bitrate.

**Interfaces (produces in `temp/wg-media/`):**
- **`aftermovie.mp4`:** H.264 High, 1920×1080, CRF or two-pass targeting about 4.5 Mbps, `-movflags +faststart`, AAC 128 kbps. The full 78 s.
- **`aftermovie-poster.jpg`:** frame at 0:30 (the crowd), 1920 wide, quality about 82.
- **`header-loop.mp4`:** 0:09.8–0:13.8, 1280×720, H.264, no audio (`-an`), `+faststart`, at most 2 MB.
- **`header-poster.jpg`:** the first frame of the loop, 1280 wide.
- **Card stills, 1600 wide:**
  - `card-vinterleker.jpg` at 0:10.5
  - `card-ski.jpg` at 1:00
  - `card-afterski.jpg` at 0:27
- **Gallery stills, 1600 wide:**
  - `gallery-aerial.jpg` at 1:15.5
  - `gallery-selfie.jpg` at 0:52.5
  - `gallery-friends.jpg` at 0:33.5
  - `gallery-teepees.jpg` at 1:03
  - `gallery-arrival.jpg` at 0:04
- **`arena.jpg`:** the arena photo, scaled to 2000 wide, quality about 82, with EXIF stripped.

- [ ] **Step 1:** Write `media-spec.json` with the values above.
- [ ] **Step 2:** Write `process-media.sh`. It reads the timecodes from `media-spec.json` (with `jq`, if installed; otherwise hard-code them and keep the JSON as the documented source). It writes every output, then prints an ffprobe summary for each: codec, dimensions, duration, bitrate and size.
- [ ] **Step 3: Run it and check the summary against the spec.**
  - `aftermovie.mp4` is between 35 and 60 MB and 78 s long.
  - `header-loop.mp4` is at most 2 MB, 4.0 s ±0.1, and has no audio stream.
  - Every still has the target width.
- [ ] **Step 4: The controller views every still** with the Read tool. The posters and the card and gallery stills must show what the spec describes. If a frame is blurred or shows the wrong moment, nudge its timecode by no more than ±1 s, and note the change in `media-spec.json`.
- [ ] **Step 5: Commit** the script and spec only, with the message `chore(winter-games): media processing for the project page`.

---

### Task 2: Upload the media and write the manifest

**Files:**
- Create: `scripts/winter-games/upload-media.ts`, a Bun script run with `--conditions=react-server`, because `@repo/api/storage-chunks` imports `server-only`.
- Create: `apps/web/src/app/(public)/design-system/winter-games/media.json`, the committed manifest.
- Test: `scripts/winter-games/upload-media.test.ts`, run with bun:test and mocked storage.

**Interfaces:**
- **Fixed file ids:** `wg26-aftermovie`, `wg26-aftermovie-poster`, `wg26-header-loop`, `wg26-header-poster`, `wg26-card-vinterleker`, `wg26-card-ski`, `wg26-card-afterski`, `wg26-gallery-aerial`, `wg26-gallery-selfie`, `wg26-gallery-friends`, `wg26-gallery-teepees`, `wg26-gallery-arrival`, `wg26-arena`.
- **How it uploads:**
  - For each file it first calls `storage.getFile`. If the file exists with the same size, it skips it.
  - Otherwise it uploads through `forwardChunk`, in 5 MiB chunks, for any size.
- **Manifest shape:** `{ [key: string]: { fileId: string; url: string; mime: string; bytes: number; width?: number; height?: number; durationSeconds?: number } }`. The url is the same `getStorageFileUrl` shape the admin produces.
- **Run modes:** dry run by default, which prints the plan. `--write` uploads, then writes the manifest.

- [ ] **Step 1: Write the failing tests:**
  - A dry run uploads nothing and prints 13 planned files.
  - With `--write`, an existing file of the same size is skipped and a missing one is uploaded in the right ranges.
  - The manifest has all 13 keys.
- [ ] **Step 2:** Run them and watch them fail: `bun test scripts/winter-games`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run them and watch them pass.
- [ ] **Step 5: Commit** the script and test, with the message `chore(winter-games): idempotent media upload with a committed manifest`.
- [ ] **Step 6: The controller** runs `--write` against production. This is allowed by D13: test media for the real page. It then commits the generated `media.json` with the message `chore(winter-games): media manifest`.

---

### Task 3: The page document in two languages, and a preview route

**Files:**
- Create: `apps/web/src/app/(public)/design-system/winter-games/doc.ts`, a pure builder that imports `media.json`.
- Create: `apps/web/src/app/(public)/design-system/winter-games/page.tsx`. It is noindex, rendered through `RenderedPage` with an empty events feed, and is not in the sitemap.
- Create: `apps/web/src/app/(public)/design-system/winter-games/en/page.tsx`, the English preview.
- Test: `apps/web/src/app/(public)/design-system/winter-games/doc.test.ts`.

**Interfaces:**
- `winterGamesDoc(locale: "no" | "en"): PageDoc`. Its meta:
  - slug `projects/winter-games`
  - department `""`. The seed script sets the real unit id.
  - campus `"5"`
  - no `theme` key
  - title "Winter Games"
  - a description built from the intro sentence

  It has a page header and sections, in the spec's order (sections 1–10). Block shapes are the registry's (`packages/editor/src/editor/types.ts`).
- **Media from `media.json`:**
  - The header is the split variant. Its media is `header-loop.mp4` with `header-poster.jpg` as the poster: a muted, looping, autoplaying video when motion is allowed, the poster when motion is reduced.
  - Section 4 uses the aftermovie video block in featured style, with `aftermovie-poster.jpg` as the poster.
  - The cards and gallery use their stills.
  - The arena photo is the image in the two-column section's right column, above the Facts block, if the mockup shows it there. Otherwise leave it out and note it.
- **Anchors and buttons:**
  - Section 4 has anchor `aftermovie`, and the header button "Se aftermovien" / "Watch the aftermovie" links to `#aftermovie`.
  - The Instagram buttons link to `https://www.instagram.com/bisowintergames/`, as external links.
- **Events:** the live events block, scoped to the Wintergames unit. It is hidden while empty (C8).
- **Team:** a manual team block with the eight people. Use initials, since there are no photos. Use role emails only.
- **Norwegian copy:** exactly the approved mockup's text. The spec's "The Winter Games page" section lists it.
- **English copy** (C10, verbatim):
  - **Header:**
    - Crumbs "Projects / Winter Games"
    - Eyebrow "National project"
    - Title "Winter Games"
    - Intro "BISO's biggest national student event. Three days at Storefjell with students from BI Oslo, Bergen, Trondheim and Stavanger."
    - Buttons "Watch the aftermovie" and "@bisowintergames"
  - **Stats:** "4 / campuses together on one mountain", "3 / days at Storefjell", "All / included: transport, accommodation and meals".
  - **About:**
    - Eyebrow "About Winter Games", title "A meeting place across campuses".
    - First paragraph: "Winter Games is a shared meeting place for students across campuses, programmes and years. You meet people you might never have got to know otherwise, whether you travel with friends or want to make new ones."
    - Second paragraph: "The event traditionally takes place in the mountains, and in recent years it has been held at Storefjell Resort Hotel on Golsfjellet in Hallingdal."
  - **Facts:**
    - Where / Storefjell Resort Hotel, Golsfjellet
    - Who / Students from BI Oslo, Bergen, Trondheim and Stavanger
    - Length / Three days
    - Included / Transport, accommodation and meals
  - **Aftermovie:** eyebrow "Aftermovie", title "Winter Games 2026".
  - **Cards:** heading "Three days, all in one place".
    - "Winter games and team competitions": "Competitions built for engagement, team spirit and a great atmosphere. You don't need to be an experienced skier or especially competitive."
    - "Skiing and winter activities": "The days are filled with skiing and activities in the mountains, together with students from all over the country."
    - "Afterski, concerts and DJs": "The evenings bring afterski, concerts, DJs, theme nights and other social activities."
  - **Quote:** "What makes Winter Games special is the combination of the activities, the atmosphere and the people."
  - **Events:** heading "Upcoming events".
  - **Team:** eyebrow "Contact", title "The team behind Winter Games". Roles, in the spec's order:
    - Project manager
    - Head of safety
    - Event manager, day programme and winter games
    - Event manager, evening programme and artists
    - Logistics manager, operations
    - Logistics manager, tickets
    - PR and communications manager
    - Finance and business manager
  - **Call-to-action band:** eyebrow "Follow the adventure", title "See more on Instagram", button "@bisowintergames".
- **Image alt text:** every still and the arena photo gets alt text in both languages. Write it after viewing the image; it describes what is in the frame. The posters get empty alt, because they are decorative stand-ins for the video.

- [ ] **Step 1: Write the failing tests:**
  - Section order and block types match the spec list.
  - Every Norwegian string in the spec appears verbatim in the `no` doc.
  - Every English string above appears verbatim in the `en` doc.
  - The `en` doc contains none of these Norwegian words: "Prosjekter", "campuser", "dager", "Kontakt", "Følg", "arrangementer".
  - No string anywhere in either doc matches a phone-number pattern (8 digits, or `+47`).
  - The team's emails are exactly the eight from the spec.
  - `normalizePageDoc(doc)` deep-equals `doc`. The doc is already normal.
  - Every block type is in the registry.
  - The anchor `aftermovie` exists, and the header button points to it.
  - There is no `theme` key.
  - The header media has a poster.
- [ ] **Step 2:** Run them and watch them fail: `cd apps/web && bunx vitest run 'src/app/(public)/design-system/winter-games'`.
- [ ] **Step 3: Implement** the builder and the two preview routes. Copy the gallery's pattern: noindex metadata, `RenderedPage`, and an empty feed snapshot for the events key, so the block collapses.
- [ ] **Step 4: Run them and watch them pass.** Then run the full web vitest, the editor `bun test ./src`, and `bun run check-types`.
- [ ] **Step 5: Commit** with the message `feat(web): the Winter Games page document and a preview`.

---

### Task 4: Seed the unpublished draft

**Files:**
- Create: `scripts/winter-games/seed-draft.ts`, a Bun script run with `--conditions=react-server`.
- Test: `scripts/winter-games/seed-draft.test.ts`, run with bun:test against a mocked db.

**Interfaces:**
- **Finding the unit.** It finds the national unit: `departments` with `campus_id` "5", `slug` "wintergames", `active: true`. If the unit is missing or inactive, it stops with a clear message and writes nothing.
- **The page row.** It finds or creates the page at `projects/winter-games`:
  - If the row exists and is bound to that unit, it updates the drafts only.
  - If the row exists and is bound to anything else, or to nothing, it aborts.
  - If no row exists, it creates one through the same `savePageDraft` create path `createUnitPage` uses, bound to the unit, with the slug `projects/winter-games`.
- **The drafts.**
  - It writes the `no` and `en` drafts from `winterGamesDoc(locale)`, with `meta.department` set to the unit id.
  - It runs the documents through the same sanitizer the save action uses.
  - It never calls `publishPage`, and never sets `is_published` or the row's status.
- **Run modes.** A dry run is the default and prints what it would do. `--write` performs the writes.

- [ ] **Step 1: Write the failing tests:**
  - A missing unit → exits with no writes.
  - An inactive unit → exits with no writes.
  - A page bound elsewhere → aborts.
  - A fresh run → one create, bound to the unit, and two draft writes.
  - A re-run → updates only.
  - `publishPage` is never called.
  - A dry run makes no writes.
- [ ] **Steps 2–4:** Watch the tests fail, implement, then run them and the editor/web suites.
- [ ] **Step 5: Commit** with the message `chore(winter-games): seed the unpublished project page draft`.
- [ ] **Step 6: The controller runs `--write` against production.**
  - Read the page back with the admin client and confirm all of these:
    - slug `projects/winter-games`
    - `department_id` = the unit
    - status draft
    - both translations unpublished
    - drafts present
  - Record the page id for the hand-over.

---

### Task 5: Visual check and the stage note

- [ ] **Step 1: Run every suite.** That means check-types, editor, admin, web, shared, api, and ultracite on the changed paths.
- [ ] **Step 2: Browser check (controller).** Start a temporary web dev server on a spare port. Open `/design-system/winter-games` and `/design-system/winter-games/en` at widths 1440, 820 and 390, and in dark mode. Save screenshots to `.playwright-mcp/stage6-*.png`. Check:
  - The header loop plays, muted.
  - With reduced motion, the header shows the poster.
  - The aftermovie button jumps to the aftermovie.
  - The video shows its poster and plays.
  - The cards and gallery stack correctly on phones.
  - The events block is hidden.
  - The team shows initials.
  - Nothing scrolls sideways.
  - Compare against the approved mockup.
- [ ] **Step 3: Append "Stage 6 done" to the spec.** It records the production artefacts for the hand-over: the 13 media file ids and the draft page id. It also notes the Red Bull branding, and that publishing is Markus's or the board's to do. Commit with the message `docs: record stage 6 completion`.
