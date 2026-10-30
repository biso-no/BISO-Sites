# Docs rework, Stage 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/docs` its new shape. That means the two areas (platform guide and developers) at short URLs, the BISO brand theme, the new landing and page layout, last-updated dates, page coverage and the PR check, redirects from old URLs, and the contributor rules. Later stages then only write content.

**Architecture:**
- **Content:** one Fumadocs loader with `baseUrl: "/"` over `content/docs/`. It has two root folders, `guide` and `developers`, so pages live at `/guide/...` and `/developers/...`. The landing stays at `/`.
- **Old pages:** they move out of the build into `apps/docs/legacy/` as source material for later stages. A frozen list of their URLs keeps the redirect test honest after `legacy/` is deleted.
- **Layout:** the docs pages use Fumadocs' notebook layout (full-width navy header). Fumadocs' tab dropdown is replaced by our own two-link area switch.
- **Coverage check:** a dependency-free Bun script, using `Bun.YAML` and `Bun.Glob`, run by a new GitHub workflow.

**Tech Stack:** Next.js 16, Fumadocs (core and ui 16.7.10, mdx 14.2.11), Tailwind 4, `bun test`, GitHub Actions with `oven-sh/setup-bun`.

**Spec:** `docs/superpowers/specs/2026-10-27-docs-rework-design.md` (approved 2026-10-27). Mockups: `docs/superpowers/specs/2026-10-27-docs-rework/mockups.html`.

**Work in:** worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework`, branch `feat/docs-rework`. Never push, deploy, or switch the main checkout's branch.

## Global Constraints

- **Brand:**
  - Fonts: Museo Sans 300/700 and Museo Slab 700/900 only. No Inter, no Google Fonts.
  - Colours: deep `#001a35`, ink `#001a35`, blue `#1668ae` (actions, links), sky `#3aa3e1` (only on navy, or as a fill under navy text), sun `#fecd45` (marker only, never text), paper `#ffffff`, line `#e8ecf0`, ink-muted `#526475`, deep-raised `#0b2747`, deep-edge `#12314f`, deep-ink-muted `#93a7bb`, deep-sunken `#00142a`.
  - Forbidden: gradients, `backdrop-blur`, decorative icon tiles, stat cards, scroll-triggered motion, hover-lift.
- **The 13° angle:** `tan(13°) = 0.2309`, and it is the only angle. Screenshots are never cut at it.
- **Copy:** plain English, sentence case. Display headings are uppercase Museo Slab, set by CSS (`text-transform`); the source text stays sentence case.
- **No placeholders:** no "TBD", "coming soon" or `[FILL IN]` in any page. An empty landing section is not rendered at all.
- **Redirects:** use `permanent: false` (307) until the owner says otherwise.
- **Tooling:**
  - Bun only. Run `bun x ultracite fix` before each commit.
  - `bun run check-types --filter=docs` must pass at the end of every task.
  - Commits end with:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01H48AWgSdxtsCEZGyPFzJyq
    ```

## Review Focus

1. **The production build may be a shallow git clone.** Then `lastModified` is `undefined`. The page header must leave out "Updated" rather than print "Invalid Date", and the build must not fail. Test: Task 2.
2. **Coverage globs over Next route folders:** `(admin)`, `[id]` and `[[...slug]]` must match literally, because `[` is a glob character class. Test: Task 6.
3. **Old bookmarked URLs:** deep paths and section roots must redirect to a live page, never 404, never chain, never loop. Test: Task 5.
4. **The landing with no role paths or task groups yet** (true for all of Stage 1): no empty headings or boxes. Test: Task 4.
5. **Phone width (375px) and dark mode:**
   - The split hero stacks, with no horizontal scroll and no sheared edge on the stacked panel.
   - Text on the sky panel stays navy in dark mode.
   - Links on navy are sky, not blue.

   Check: Task 8.

---

### Task 1: Two-area content tree, short URLs, legacy move

**Files:**
- Move: `apps/docs/content/docs/*` → `apps/docs/legacy/` (`git mv`, keeping the folder layout)
- Create:
  - `apps/docs/legacy/README.md`
  - `apps/docs/legacy-urls.json`
  - `apps/docs/scripts/list-legacy-urls.ts`
  - `apps/docs/content/docs/meta.json`
  - `apps/docs/content/docs/guide/meta.json`
  - `apps/docs/content/docs/guide/index.mdx`
  - `apps/docs/content/docs/developers/meta.json`
  - `apps/docs/content/docs/developers/index.mdx`
- Create: `apps/docs/lib/content-files.ts`, `apps/docs/lib/content-files.test.ts`
- Move: `apps/docs/app/docs/layout.tsx` → `apps/docs/app/(docs)/layout.tsx`, and `apps/docs/app/docs/[[...slug]]/page.tsx` → `apps/docs/app/(docs)/[...slug]/page.tsx` (a required catch-all, so `/` stays the landing)
- Move: `apps/docs/app/og/docs/[...slug]/route.tsx` → `apps/docs/app/og/[...slug]/route.tsx`
- Modify:
  - `apps/docs/lib/source.ts`: `baseUrl: "/"`, and `getPageImage` returns `/og/<slugs>/image.png`
  - `apps/docs/package.json`: add `"test": "bun test"`

**Interfaces:**
- Produces:
  - `resolveHref(href: string): { kind: "landing" } | { kind: "page"; file: string } | null` in `lib/content-files.ts`.
    - It strips any `?query` and `#hash`.
    - `"/"` gives landing.
    - `/a/b` gives `content/docs/a/b.mdx` if that file exists, otherwise `content/docs/a/b/index.mdx` if that exists, otherwise `null`.
    - `file` is relative to `apps/docs`. Paths are resolved from `import.meta.dir`, so the function works from any working directory.
  - `AREA_ROOTS = ["guide", "developers"] as const` in `lib/content-files.ts`.
  - `legacy-urls.json`: a sorted array of old URLs, for example `"/docs/admin-handbook/jobs"`. `index.mdx` maps to its folder URL; the top `index.mdx` maps to `"/docs"`.

- [ ] **Step 1: Install dependencies in the worktree**

Run: `cd /Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework && bun install`
Expected: completes, and `apps/docs/.source` is generated by `postinstall`.

- [ ] **Step 2: Write the failing test** in `lib/content-files.test.ts`

```ts
test("resolves the landing", () => expect(resolveHref("/")).toEqual({ kind: "landing" }));
test("resolves an area index", () =>
  expect(resolveHref("/guide")).toEqual({ kind: "page", file: "content/docs/guide/index.mdx" }));
test("ignores hash and query", () =>
  expect(resolveHref("/developers?x=1#top")).toEqual({ kind: "page", file: "content/docs/developers/index.mdx" }));
test("returns null for a missing page", () => expect(resolveHref("/guide/nope")).toBeNull());
test("both areas are root folders", () => {
  for (const area of AREA_ROOTS) {
    const meta = JSON.parse(readFileSync(join(import.meta.dir, `../content/docs/${area}/meta.json`), "utf8"));
    expect(meta.root).toBe(true);
  }
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `cd apps/docs && bun test lib/content-files.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Move the old content and create the new tree**

- `legacy/README.md` explains that these are the pre-rework pages. They are not built and are often wrong. They are source material only, to be checked against code before anything is reused, and are deleted in the final stage.
- `scripts/list-legacy-urls.ts` walks `legacy/**/*.mdx` and writes `legacy-urls.json`. Run it once and commit the output.
- `content/docs/meta.json`: `{ "pages": ["guide", "developers"] }`
- `guide/meta.json`: `{ "title": "Platform guide", "root": true, "pages": ["index"] }`
- `developers/meta.json`: `{ "title": "Developers", "root": true, "pages": ["index"] }`
- `guide/index.mdx` front matter: `title: Platform guide`, `description: How to do your job in the BISO admin, step by step.`, `covers: []`. Body: one short paragraph saying who the guide is for (board members, HR, department editors, campus leaders, IT) and that it is organised by area.
- `developers/index.mdx` front matter: `title: Developers`, `description: Everything someone taking over the platform needs: what runs where, how to deploy, and what to do when it breaks.`, `covers: []`. Body: one short paragraph for a consultant or new hire starting cold.
- Neither index may list sections that don't exist yet.

- [ ] **Step 5: Implement `resolveHref`, switch the routes to `/`, and fix the OG path**

- [ ] **Step 6: Run the tests and the type check**

Run: `cd apps/docs && bun test && cd ../.. && bun run check-types --filter=docs`
Expected: all PASS.

- [ ] **Step 7: Build and check the routes**

Run: `bun run build --filter=docs`, then `cd apps/docs && bun run start -- -p 3102` in the background, then `curl -s -o /dev/null -w "%{http_code}\n"` for `/guide`, `/developers` and `/`.
Expected: 200 for all three. Stop the server.

- [ ] **Step 8: Commit** with message `refactor(docs): two areas at /guide and /developers; old pages moved to legacy/`

---

### Task 2: Front matter fields, last-updated date, page header

**Files:**
- Modify: `apps/docs/source.config.ts`
- Modify: `apps/docs/package.json` (add `"zod": "catalog:"`)
- Create: `apps/docs/lib/format.ts`, `apps/docs/lib/format.test.ts`
- Create: `apps/docs/components/page-header.tsx`, `apps/docs/components/page-header.test.tsx`
- Modify: `apps/docs/app/(docs)/[...slug]/page.tsx`

**Interfaces:**
- Consumes: the Task 1 route.
- Produces:
  - The front matter schema `frontmatterSchema.extend({ who: z.string().optional(), covers: z.array(z.string()).optional() })`, so pages expose `page.data.who`, `page.data.covers` and `page.data.lastModified`. The last comes from the `fumadocs-mdx/plugins/last-modified` plugin, registered as `defineConfig({ plugins: [lastModified()] })`.
  - `formatUpdated(date: Date | string | null | undefined): string | null` returns, for example, `"27 Oct 2026"` (`en-GB`, day numeric, month short, year numeric, `timeZone: "Europe/Oslo"`). An invalid or missing date gives `null`.
  - `PageHeader(props: { crumb?: string; title: string; description?: string; who?: string; updated?: string | null })`, a server component.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/format.test.ts
test("formats a date", () => expect(formatUpdated(new Date("2026-10-27T10:00:00Z"))).toBe("27 Oct 2026"));
test("missing date gives null", () => expect(formatUpdated(undefined)).toBeNull());
test("invalid date gives null", () => expect(formatUpdated("not a date")).toBeNull());
```

```tsx
// components/page-header.test.tsx (renderToStaticMarkup from react-dom/server)
test("shows who and updated", () => {
  const html = renderToStaticMarkup(<PageHeader title="Publish a vacancy" who="HR team" updated="27 Oct 2026" />);
  expect(html).toContain("Who can do this:");
  expect(html).toContain("Updated 27 Oct 2026");
});
test("omits the meta line when both are missing", () => {
  const html = renderToStaticMarkup(<PageHeader title="Developers" updated={null} />);
  expect(html).not.toContain("Who can do this");
  expect(html).not.toContain("Updated");
  expect(html).not.toContain("Invalid");
});
test("renders exactly one h1", () =>
  expect(renderToStaticMarkup(<PageHeader crumb="Recruitment" title="X" />).match(/<h1/g)?.length).toBe(1));
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/docs && bun test lib/format.test.ts components/page-header.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the schema, `formatUpdated` and `PageHeader`**

- `PageHeader` markup, in order:
  - the optional crumb (small, ink-muted)
  - the `h1` (Museo Slab 900, uppercase, `font-size: clamp(1.75rem, 3.5vw, 2.375rem)`, `line-height: 0.95`)
  - the optional description
  - the meta line with `Who can do this: <who>` and `Updated <date>`, each part only if present. There is no line at all when both are missing.
- The page route replaces `DocsTitle` and `DocsDescription` with `PageHeader`:
  - `crumb` is the title of the page's parent folder in the page tree. It is `undefined` for an area index or a page at an area's top level. Use `source.pageTree` with fumadocs-core's page-tree helpers.
  - `updated` is `formatUpdated(page.data.lastModified)`.
- Remove `editOnGithub`: the repo URL is wrong and the button isn't wanted.

- [ ] **Step 4: Run the tests and the type check**

Run: `cd apps/docs && bun test && cd ../.. && bun run check-types --filter=docs`
Expected: PASS.

- [ ] **Step 5: Commit** with message `feat(docs): who, covers and last-updated on every page`

---

### Task 3: Brand theme, notebook layout, area switch, task-page components

**Files:**
- Copy into `apps/docs/public/`, from `apps/web/public/`: `Museo_Sans_700.otf`, `Museo_Slab_700.otf`, `Museo_Slab_900.otf`
- Copy into `apps/docs/public/`: `apps/web/public/images/logo-dark.png`, saved as `biso-logo-on-navy.png`
- Delete: `apps/docs/public/shots.png`, `apps/docs/public/logo.png` (once nothing references them)
- Modify:
  - `apps/docs/app/fonts.ts`
  - `apps/docs/app/layout.tsx`
  - `apps/docs/app/global.css`
  - `apps/docs/app/(docs)/layout.tsx`
  - `apps/docs/lib/layout.shared.tsx`
- Create: `apps/docs/lib/areas.ts`, `apps/docs/lib/areas.test.ts`, `apps/docs/components/area-switch.tsx`
- Create:
  - `apps/docs/components/before-you-start.tsx`
  - `apps/docs/components/what-happens-next.tsx`
  - `apps/docs/components/screenshot.tsx`
- Modify: `apps/docs/components/steps.tsx`, `apps/docs/components/callout.tsx`, `apps/docs/mdx-components.tsx`
- Create: `apps/docs/app/brand.test.ts`

**Interfaces:**
- Produces:
  - `AREAS: readonly { id: "guide" | "developers"; title: string; href: string }[]`. The values are `{ id: "guide", title: "Platform guide", href: "/guide" }` and `{ id: "developers", title: "Developers", href: "/developers" }`.
  - `activeArea(pathname: string): "guide" | "developers" | null`
  - MDX components available in every page:
    - `Steps`, `Step` (unchanged API)
    - `Callout` (unchanged API: `type` of `info`, `warn` or `error`)
    - `BeforeYouStart({ children })`, a bordered box titled "Before you start"
    - `WhatHappensNext({ children })`, a panel with a blue left border titled "What happens next"
    - `Screenshot({ src: string; alt: string; caption?: string; width: number; height: number })`: `next/image` inside a plain 1px `line` border, square corners, no clip-path, with the caption below in ink-muted 12px

- [ ] **Step 1: Write the failing tests**

```ts
// lib/areas.test.ts
test("guide paths", () => expect(activeArea("/guide/recruitment/publish-a-vacancy")).toBe("guide"));
test("area root", () => expect(activeArea("/developers")).toBe("developers"));
test("lookalike prefix is not an area", () => expect(activeArea("/guidelines")).toBeNull());
test("landing", () => expect(activeArea("/")).toBeNull());
```

```ts
// app/brand.test.ts: scans apps/docs/{app,components,lib}/**/*.{ts,tsx,css}, skipping *.test.*
const FORBIDDEN = [/gradient/i, /backdrop-blur/, /whileInView/, /next\/font\/google/, /hover:-translate-y/, /--font-inter/];
test("no off-brand patterns", () => { /* for each file and pattern: expect(content).not.toMatch(pattern), naming the file */ });
```

- [ ] **Step 2: Run the tests and confirm they fail**

`brand.test.ts` should fail on the current `global.css` gradient tokens, `fonts.ts` (Google Inter) and `app/(home)/page.tsx`. `areas.test.ts` should fail because the module is missing.

- [ ] **Step 3: Implement the theme**

- **Fonts:**
  - `fonts.ts` exports `museoSans` (300 and 700, `variable: "--font-museo"`) and `museoSlab` (700 and 900, `variable: "--font-museo-slab"`), mirroring `apps/web/src/app/fonts.ts`.
  - `layout.tsx` puts both variables plus `biso-surface biso-surface-v2` on `<html>`.
- **Tokens (`global.css`):**
  - Import `../../../packages/ui/styles/biso-surface.css`.
  - Delete the legacy token block (`--brand*`, gradients, overlays).
  - Map Fumadocs colours.
    - Light:
      - `--color-fd-background`, `card` and `popover` → paper
      - `foreground` → ink
      - `muted` → `#eef1f5`; `muted-foreground` → ink-muted
      - `border` → line
      - `primary` → blue; `primary-foreground` → paper
      - `accent` → `#eef1f5`; `ring` → blue
    - Dark (`.dark`):
      - `background` → deep-sunken
      - `card` and `popover` → deep-raised
      - `foreground` → `#ffffff`; `muted-foreground` → deep-ink-muted
      - `border` → deep-edge
      - `primary` → sky; `primary-foreground` → deep
  - Headings `h1`–`h3` in the article use `var(--font-display)`.
- **Layout:**
  - `(docs)/layout.tsx` uses `DocsLayout` from `fumadocs-ui/layouts/notebook` with:
    - `nav={{ mode: "top", title: <logo + "Docs"> }}`
    - `tabs={false}`
    - `sidebar={{ banner: <AreaSwitch /> }}`
    - `links` with the two `AREAS` entries
  - Find the header's element in the rendered DOM and give it a navy background, white title and deep-edge bottom border.
  - The sidebar background is `#f7f9fb` (light). The active item is blue, bold, with a 2px blue left border.
- **Area switch:** `AreaSwitch` (`"use client"`) renders the two `AREAS` as a two-segment control. The active segment is a deep fill with white text and `aria-current="page"`.
- **Components:**
  - Steps: a 26px deep circle with a white bold number.
  - Callout: no icon tile. `info` gets a blue left border; `warn` a sun left border on `#fff8e1`; `error` a danger (`#b3261e`) left border.
  - Register the new components in `mdx-components.tsx`.
- **Home page:** strip the gradients from `app/(home)/page.tsx`. Task 4 rewrites it completely, but this commit must pass `brand.test.ts`, so a minimal holding version is fine.
- Remove the links to `public.biso.no`, `admin-dev.biso.no` and the GitHub repo from `layout.shared.tsx`.

- [ ] **Step 4: Run the tests, type check and build**

Run: `cd apps/docs && bun test && cd ../.. && bun run check-types --filter=docs && bun run build --filter=docs`
Expected: PASS.

- [ ] **Step 5: Look at it**

Run `bun run dev --filter=docs`. Screenshot `http://localhost:3002/guide` at 1300px with Playwright (save under `.playwright-mcp/`, which is gitignored). Compare with view 3 of `mockups.html`: navy header, area switch on top of the sidebar, Museo type.

- [ ] **Step 6: Commit** with message `feat(docs): BISO brand theme, navy header and area switch`

---

### Task 4: Landing page

**Files:**
- Rewrite: `apps/docs/app/(home)/page.tsx`, `apps/docs/app/(home)/layout.tsx`
- Create:
  - `apps/docs/components/landing/site-header.tsx`
  - `apps/docs/components/landing/split-hero.tsx`
  - `apps/docs/components/landing/ask-field.tsx`
  - `apps/docs/components/landing/role-paths.tsx`
  - `apps/docs/components/landing/task-groups.tsx`
- Create: `apps/docs/lib/landing.ts`, `apps/docs/lib/landing.test.ts`, `apps/docs/components/landing/landing.test.tsx`

**Interfaces:**
- Consumes: `resolveHref` (Task 1) and `AREAS` (Task 3).
- Produces, in `lib/landing.ts`:
  - `interface LandingLink { title: string; href: string }`
  - `interface ReadingPath { role: string; steps: LandingLink[] }`
  - `interface TaskGroup { title: string; href: string; tasks: LandingLink[] }`
  - `readingPaths: ReadingPath[] = []` and `taskGroups: TaskGroup[] = []`. They are empty in Stage 1, and stages 2–4 append to them.
- `RolePaths({ paths })` and `TaskGroups({ groups })` return `null` for an empty array.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/landing.test.ts
test("every landing link resolves to a page", () => {
  const hrefs = [...readingPaths.flatMap((p) => p.steps), ...taskGroups.flatMap((g) => [g, ...g.tasks])].map((l) => l.href);
  for (const href of hrefs) expect(resolveHref(href), href).not.toBeNull();
});
```

```tsx
// components/landing/landing.test.tsx
test("empty role paths render nothing", () => expect(renderToStaticMarkup(<RolePaths paths={[]} />)).toBe(""));
test("empty task groups render nothing", () => expect(renderToStaticMarkup(<TaskGroups groups={[]} />)).toBe(""));
test("role paths are ordered lists", () => {
  const html = renderToStaticMarkup(<RolePaths paths={[{ role: "HR team", steps: [{ title: "Sign in", href: "/guide" }] }]} />);
  expect(html).toContain("<ol");
  expect(html).toContain("Start with your role");
});
test("hero copy", () => {
  const html = renderToStaticMarkup(<SplitHero />);
  for (const s of ["How BISO runs", "Keeping it running", "Start the handover"]) expect(html).toContain(s);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

- [ ] **Step 3: Implement the landing to match view 1 of `mockups.html`**

- **Site header:** navy bar with the logo, "Docs", the two `AREAS` links, and the search trigger (Fumadocs `SearchTrigger` or `useSearchContext().setOpenSearch(true)`). There is no Sign in yet; Stage 3 adds it.
- **Split hero:**
  - `height: 360px` on ≥768px.
  - **Left panel** (navy): `h1` "How BISO runs" (Museo Slab 900, uppercase, `clamp(2.5rem, 6vw, 3.625rem)`, `line-height: 0.88`). Then the paragraph "Step-by-step guides for board members, HR, department editors and campus leaders." in deep-ink-muted. Then `AskField`.
  - **Right panel** (40% width, sky fill, navy text): heading "Keeping it running", the paragraph "For the developer or consultant who takes over: what runs where, how to deploy, what to do when it breaks.", and an outlined navy button "Start the handover" linking to `/developers`.
  - **The 13° edge:** the right panel is clipped with `polygon(calc(360px * 0.2309) 0, 100% 0, 100% 100%, 0 100%)`.
  - **Below 768px:** the panels stack, the right panel has no clip-path, and nothing scrolls horizontally.
- **Ask field:** a white field with "Search the docs" and a blue "Search" end cap. It opens Fumadocs search on click or Enter. Stage 5 turns it into ask-and-search. The hint line under it is left out until then.
- **Role paths:** the heading "Start with your role" (Museo Slab 700, uppercase, no sun marker), then a 4-column grid of `<ol>` lists (2 columns below 1024px, 1 below 640px), each column separated by a line border.
- **Task groups:** each group heading is a link to `group.href`, with a 3px sun underline. Below it, a list of task links.
- The page metadata title is "BISO Docs".

- [ ] **Step 4: Run the tests, type check and build** (same commands as Task 3)

- [ ] **Step 5: Look at it**

Screenshot `http://localhost:3002/` with Playwright at 1300px and at 375px, and compare with view 1 of `mockups.html`. At 375px: no horizontal scroll (`document.documentElement.scrollWidth <= 375`), and the hero is stacked.

- [ ] **Step 6: Commit** with message `feat(docs): landing with split hero and role paths`

---

### Task 5: Redirects from old URLs

**Files:**
- Create: `apps/docs/redirects.json`, `apps/docs/lib/redirects.ts`, `apps/docs/lib/redirects.test.ts`
- Modify: `apps/docs/next.config.mjs` (add `async redirects()`, reading `redirects.json` with `readFileSync` and adding `permanent: false` to each rule)

**Interfaces:**
- Consumes: `resolveHref` and `legacy-urls.json` (Task 1).
- Produces:
  - `redirects.json`: `{ source: string; destination: string }[]`. Specific rules come first, then the section fallbacks. Later stages add a specific rule for every old page that has a clear successor, above the fallbacks.
  - `matchRedirect(url: string, rules: RedirectRule[]): string | null` in `lib/redirects.ts`. It returns the destination of the first matching rule and supports exact sources and a trailing `/:path*`. It ignores a trailing slash on `url`.

Initial `redirects.json`, in this order:

```json
[
  { "source": "/docs", "destination": "/" },
  { "source": "/docs/getting-started/:path*", "destination": "/" },
  { "source": "/docs/admin-handbook/:path*", "destination": "/guide" },
  { "source": "/docs/public-website/:path*", "destination": "/developers" },
  { "source": "/docs/architecture/:path*", "destination": "/developers" },
  { "source": "/docs/developing/:path*", "destination": "/developers" },
  { "source": "/docs/packages/:path*", "destination": "/developers" },
  { "source": "/docs/integrations/:path*", "destination": "/developers" },
  { "source": "/docs/operations/:path*", "destination": "/developers" },
  { "source": "/docs/handover/:path*", "destination": "/developers" }
]
```

- [ ] **Step 1: Write the failing tests**

```ts
test("every old URL is redirected", () => {
  for (const url of legacyUrls) expect(matchRedirect(url, rules), url).not.toBeNull();
});
test("every destination is a live page", () => {
  for (const r of rules) expect(resolveHref(r.destination), r.destination).not.toBeNull();
});
test("no chains or loops", () => {
  for (const r of rules) expect(matchRedirect(r.destination, rules), r.destination).toBeNull();
});
test("deep path and trailing slash", () =>
  expect(matchRedirect("/docs/admin-handbook/jobs/creating-vacancies/", rules)).toBe("/guide"));
test("section root without a sub-path", () =>
  expect(matchRedirect("/docs/handover", rules)).toBe("/developers"));
test("first match wins", () =>
  expect(matchRedirect("/docs/a/b", [{ source: "/docs/a/b", destination: "/x" }, { source: "/docs/a/:path*", destination: "/y" }])).toBe("/x"));
```

Note: `/docs/handover` must match `/docs/handover/:path*`, because Next's `:path*` matches zero segments. `matchRedirect` must agree.

- [ ] **Step 2: Run the tests and confirm they fail**

- [ ] **Step 3: Implement `matchRedirect`, `redirects.json` and the Next config**

- [ ] **Step 4: Run the tests and build, then check one live redirect**

Run `bun run start` and `curl -sI http://localhost:3102/docs/admin-handbook/jobs`.
Expected: `307` with `location: /guide`.

- [ ] **Step 5: Commit** with message `feat(docs): redirect old /docs URLs to the new areas`

---

### Task 6: Coverage check and PR workflow

**Files:**
- Create:
  - `apps/docs/scripts/coverage/check.ts`
  - `apps/docs/scripts/coverage/read-pages.ts`
  - `apps/docs/scripts/coverage/cli.ts`
  - `apps/docs/scripts/coverage/check.test.ts`
- Create: `.github/workflows/docs-coverage.yml`

**Interfaces:**
- Produces:
  - `interface PageCoverage { page: string; covers: string[] | null }`. `page` is repo-relative, for example `apps/docs/content/docs/guide/index.mdx`. `null` means the front matter has no `covers` key.
  - `readPages(repoRoot: string): PageCoverage[]` parses the front matter between the first two `---` lines with `Bun.YAML.parse`.
  - `toGlob(pattern: string): Bun.Glob` escapes `[` and `]` as `\[` and `\]` before building the glob, so route folders match literally. Covers globs have no character classes.
  - `findStalePages(pages, changed: string[]): { page: string; files: string[] }[]` returns pages whose globs match at least one changed file while the page itself is not in `changed`.
  - `findDeadGlobs(pages, repoFiles: string[]): { page: string; glob: string }[]`
  - `findMissingCoverage(pages, changed: string[]): string[]` returns pages in `changed` whose `covers` is `null`. `covers: []` is valid and means a narrative page.
- CLI: `bun apps/docs/scripts/coverage/cli.ts --changed <path-to-newline-list>`.
  - The repo root comes from `git rev-parse --show-toplevel`; repo files from `git ls-files`.
  - Each finding prints a GitHub annotation, and a markdown summary goes to `$GITHUB_STEP_SUMMARY` when that is set.
  - It **always exits 0**.
  - Annotations (exact copy):
    - Stale: `::warning file=<page>,title=Docs may be out of date::This PR changes code this page describes (<first 5 files, comma-separated><", and N more" if more>), but not the page. Check it's still accurate.`
    - Dead glob: `::warning file=<page>,title=Coverage glob matches nothing::'<glob>' matches no files. Fix or remove it.`
    - Missing: `::warning file=<page>,title=Page has no covers list::Add the code paths this page describes, or 'covers: []' if it describes none.`

- [ ] **Step 1: Write the failing tests** (fixtures are inline arrays, no file system)

```ts
const pages = [
  { page: "apps/docs/content/docs/guide/recruitment/index.mdx", covers: ["apps/admin/src/app/(admin)/jobs/[id]/**", "packages/shared/recruitment/**"] },
  { page: "apps/docs/content/docs/developers/history.mdx", covers: [] },
  { page: "apps/docs/content/docs/guide/new.mdx", covers: null },
];
test("route folders match literally", () =>
  expect(findStalePages(pages, ["apps/admin/src/app/(admin)/jobs/[id]/page.tsx"])).toEqual([
    { page: pages[0].page, files: ["apps/admin/src/app/(admin)/jobs/[id]/page.tsx"] },
  ]));
test("no warning when the page changed too", () =>
  expect(findStalePages(pages, ["packages/shared/recruitment/apply.ts", pages[0].page])).toEqual([]));
test("unrelated change", () => expect(findStalePages(pages, ["apps/web/src/app/page.tsx"])).toEqual([]));
test("dead glob", () =>
  expect(findDeadGlobs(pages, ["packages/shared/recruitment/apply.ts"])).toEqual([
    { page: pages[0].page, glob: "apps/admin/src/app/(admin)/jobs/[id]/**" },
  ]));
test("missing covers only for changed pages", () => {
  expect(findMissingCoverage(pages, [])).toEqual([]);
  expect(findMissingCoverage(pages, [pages[2].page])).toEqual([pages[2].page]);
});
test("narrative page is fine", () => expect(findMissingCoverage(pages, [pages[1].page])).toEqual([]));
```

Add a `readPages` test against a temporary directory with two `.mdx` files, one with `covers` and one without.

- [ ] **Step 2: Run the tests and confirm they fail**

- [ ] **Step 3: Implement `check.ts`, `read-pages.ts` and `cli.ts`**

- [ ] **Step 4: Run the tests, then the CLI locally**

Run:
```bash
CHANGED=$(mktemp)
git diff --name-only main...HEAD > "$CHANGED"
bun apps/docs/scripts/coverage/cli.ts --changed "$CHANGED"
```
Expected: exit 0. The two area index pages have `covers: []`, so there are no missing-coverage warnings.

- [ ] **Step 5: Write `.github/workflows/docs-coverage.yml`**

- name `Docs coverage`, on `pull_request` (opened, synchronize, reopened, ready_for_review)
- `permissions: contents: read`
- one job on `ubuntu-latest` with these steps:
  - `actions/checkout@v4` with `fetch-depth: 0`
  - `oven-sh/setup-bun@v2` with `bun-version: 1.3.1`
  - `git diff --name-only "origin/${{ github.base_ref }}...HEAD" > "$RUNNER_TEMP/changed.txt"`
  - `bun apps/docs/scripts/coverage/cli.ts --changed "$RUNNER_TEMP/changed.txt"`
- no `bun install` (the script has no dependencies)

Validate the YAML with `bun -e 'Bun.YAML.parse(await Bun.file(".github/workflows/docs-coverage.yml").text())'`.

- [ ] **Step 6: Commit** with message `feat(docs): warn on PRs that change covered code without the page`

---

### Task 7: Contributor rules (CLAUDE.md, both repos)

**Files:**
- Create: `apps/docs/CLAUDE.md`
- Modify:
  - `CLAUDE.md` (root): the apps table row for `docs`, plus a new "Documentation" section
  - `apps/admin/CLAUDE.md`
  - `apps/web/CLAUDE.md`
- Modify, in the Flutter repo: `CLAUDE.md`. Work in a new worktree: `cd /Users/markus/Documents/dev/BISO-Flutter && git worktree add .claude/worktrees/docs-rule -b chore/docs-rule main`. Never touch the Flutter main checkout, which is on another session's branch.

`apps/api` has no CLAUDE.md, and the root file applies to it.

**Content requirements:**
- **`apps/docs/CLAUDE.md`** (the guide for whoever writes docs next):
  - The two areas and their URLs, and that `legacy/` is not built.
  - Front matter fields: `title`, `description`, `who` (guide task pages), and `covers`. For `covers`: globs relative to the repo root; `[` and `]` are literal; `covers: []` marks a narrative page.
  - The six-part task page shape from the spec, and the components that build it.
  - The language rule: name the on-screen Norwegian label with the English in brackets.
  - The screenshot rule: plain frame, made-up data only.
  - The no-placeholder rule; never write private values; check every claim against code before committing.
  - What the PR check does.
  - The commands: `bun run dev`, `bun test`, `bun run check-types` and `bun run build` with `--filter=docs`.
- **Root `CLAUDE.md`:**
  - The docs row reads: audience "Staff and developers"; description "Fumadocs site: the platform guide for staff and the developer handover. See `apps/docs/CLAUDE.md`."
  - New section "Documentation": "When you change how a feature behaves, update the docs page whose `covers` matches the code you changed, or add a page if none does. A PR check warns when covered code changes without its page. Rules in `apps/docs/CLAUDE.md`."
- **`apps/admin/CLAUDE.md`:** one paragraph saying admin features are documented in the platform guide (`apps/docs/content/docs/guide/`), with the same rule.
- **`apps/web/CLAUDE.md`:** one paragraph saying student-facing behaviour appears in the guide's "What the student sees" sections, and technical details in `developers/`.
- **Flutter `CLAUDE.md`:** a "Documentation" section saying the app's developer docs live in BISO-Sites under `apps/docs/content/docs/developers/`. When changing the release process, signing, backend endpoints or push setup, update those pages in BISO-Sites as part of the work. Commit only in the Flutter worktree; do not push.

- [ ] **Step 1: Write the files**
- [ ] **Step 2: Check that the stated commands and paths exist**

Run `grep -n "covers" CLAUDE.md apps/*/CLAUDE.md`, and run each command named in `apps/docs/CLAUDE.md` once.

- [ ] **Step 3: Commit in BISO-Sites** with message `docs: contributor rules for keeping the docs accurate`
- [ ] **Step 4: Commit in the Flutter worktree** with message `docs: update BISO-Sites developer docs alongside app changes`

---

### Task 8: Stage verification

**Files:** none (fix-ups only, committed separately)

- [ ] **Step 1: Full checks**

Run, from the worktree root:
```bash
bun x ultracite check apps/docs
bun run check-types --filter=docs
cd apps/docs && bun test
cd ../.. && bun run build --filter=docs
```
Expected: all pass.

- [ ] **Step 2: Visual check with Playwright** against `bun run start` in `apps/docs`

Screenshot `/`, `/guide` and `/developers` at 1300px and 375px, in light and in dark (toggle `.dark` on `<html>`). Check:
- **375px:** no horizontal scroll on any page, and the hero is stacked.
- **Dark mode:** the hero's right panel keeps navy text on sky; sidebar links are readable; links on navy are sky.
- **Fonts:** Museo Slab loads, so the `h1` computed `font-family` starts with the Museo Slab variable font.

- [ ] **Step 3: Redirect spot check**

`curl -sI` against `/docs`, `/docs/handover`, `/docs/admin-handbook/jobs/ai-screening/` and `/docs/integrations/vipps-mobilepay`.
Expected: each returns 307 to a page that then returns 200.

- [ ] **Step 4: Record**

Write `.superpowers/sdd/2026-10-27-docs-rework-stage-1/progress.md` in the worktree (gitignored). It lists the rulings made during the stage, anything deferred, and the check results.
