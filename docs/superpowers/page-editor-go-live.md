# Page editor redesign: go-live checklist

Branch `feat/page-editor-redesign` (not pushed). The spec and the six "Stage
done" notes are in
`docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md`, and each
stage's plan is in `docs/superpowers/plans/2026-10-2*-page-editor-stage-*.md`.

## Before you deploy

1. **Check the editor by eye.** Admin sign-in is Microsoft OAuth only, so
   nothing in the editor itself (canvas, inspector, Theme panel, palette,
   copilot) has been checked in a real browser. Every check so far was by
   tests. Open a test page and:
   - build a two-column section, drag blocks between columns, switch the
     layout and back, and toggle the tablet and phone previews;
   - undo three times, then reload;
   - in the Theme panel, drag the colour area, type `#9B5DE5`, click
     "Use #…", then Reset;
   - upload a 30 MB video in a video block, which tests chunking;
   - confirm the editor chrome looks as it did before (D10).
2. **Push the schema change.** `packages/api/appwrite.config.json` now sets
   the `media` bucket to 250 MB (262144000), matching the console.
3. **Set the environment variables.**
   - **Admin:** `NEXT_PUBLIC_WEB_BASE_URL` and `CRON_SECRET`, so Publish can
     refresh the website. Without them it logs a warning and the site waits
     for its caches to expire.
   - **Web:** `CRON_SECRET`, the same value.
   - **Web, optional:** `RATE_LIMIT_CLIENT_IP_HEADER` or
     `RATE_LIMIT_TRUSTED_PROXY_HOPS`. Rate limiting on `/api/form/submit` is
     off until one of them is set, the same as for varsling.
4. **Merge and deploy web and admin together.** The new code reads only
   `draft_doc`/`published_doc`. Old editor pages are disposable (D2).

## Right after deploy

- Publish a test page and check that it shows on the site within seconds.
  Then unpublish one language and check the other stays live.
- Upload a 5–10 MB image in any admin editor (news, events, jobs, shop or
  units). These now go up in 5 MB chunks through Appwrite Sites, which was
  not tested through the Sites proxy.
- Submit a form on a published page. It must reach an `@biso.no` address.
- Have one Winter Games board member (in the Wintergames team only, not
  National) open and edit `projects/winter-games`.

## Winter Games

- **The page.** Your page `6adcd79b001c93ad6a13` is now bound to the
  Wintergames unit (`1007`, campus 5):
  - its published version is unchanged;
  - both drafts are the approved design, in Norwegian and English.

  Compare the drafts in the editor, set a meta description (the drafts
  carry the live, empty one), then publish each language.
- **Previews:** `/design-system/winter-games` and `/design-system/winter-games/en`.
- **After deploy:** `/units/national/wintergames` redirects to
  `/projects/winter-games` once that page is published.
- **Red Bull branding** is visible in the arch and in much of the aftermovie.

## What I changed in production

- **Kept:**
  - 13 files in the `media` bucket, `wg26-*` (aftermovie, header loop,
    posters, stills, arena). Listed in
    `apps/web/src/app/(public)/design-system/winter-games/media.json`.
  - Page `6adcd79b001c93ad6a13`, bound to unit `1007` with its drafts
    replaced. Its published content, publish flags and live meta are
    unchanged.
- **Deleted again:** test upload `media/6ae0536a002ea6acbc17`, a 32.8 MB
  clip used to prove the chunked path.
- No pages were published or deleted, no schema was pushed, and nothing was
  pushed to git.

## Known limitations and follow-ups

- **Editor:**
  - A text selection ending in a section's padding selects the section.
  - The add-section picker doesn't return focus.
  - Drag-and-drop announcements read raw ids.
  - Header inputs push one undo step per keystroke.
  - The heading "Large" size equals the page `<h1>`.
  - The Inline video still offers a 21:9 aspect ratio.
- **Saves:**
  - Draft saves on a published page rewrite its live title and description.
  - Browser Back from the editor isn't guarded while the theme blocks saving.
  - Undo can bring back a theme the department already holds; the next save
    drops it.
- **Themes:**
  - Unpublishing doesn't clear a department's theme.
  - A themed unit page flashes the navy loading skeleton on a cold
    navigation.
  - On a header-less page, a first section hidden after load can sit under
    the fixed nav.
- **Copilot:** its tools are advisory. It can't see ids the browser creates,
  and it isn't told about a rejected placement.
- **Uploads:**
  - The inline-media route allows 250 MB for every file kind (your
    a2671a0c); consider per-kind caps.
  - Upload progress isn't shown.
- **Access:** an ordinary page (not `projects/` or `units/`) bound to a
  national department opens for its members but doesn't save.
- **Not from this branch:**
  - The api `campus_benefits` test fails.
  - Archived pages stay readable through the Appwrite API without login.
  - Drafts are publicly readable through the API (spec non-goal).
  - Coded unit pages' `cachedUnitProducts` filters products by locale.
  - Dev logs "uncached data" when navigating to `/`.
  - An unknown unit URL returns 200 on the dev server.
