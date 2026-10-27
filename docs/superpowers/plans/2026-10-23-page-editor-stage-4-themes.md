# Page editor stage 4: themes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A department, project or department-less page can carry a two-colour theme (dark + accent). On that page the theme recolours the nav, page header, dark and photo sections, footer, buttons, links, stat numbers, accent rules and chevron frames. It goes live on Publish, and it can never produce unreadable text.

**Architecture:**
- **Colour maths.** One pure module in `@repo/shared` validates a theme against C2b's thresholds and finds the nearest passing shade. It also derives every token value the site needs and renders them as CSS text.
- **Website.** `packages/ui/styles/biso-surface.css` gets named tokens for the values that are hard-coded today, so overriding a handful of `--biso-*` variables on `:root` recolours everything. A themed web page renders a plain `<style>` first in its own tree. It reaches the nav and footer through `:root`, and React removes it on navigation.
- **Editor.** The canvas sets the same variables inline on `.pe-frame`. `PageMeta.theme` replaces `accentColor`.
- **Publish.** Publishing a department page copies an explicit theme to the department row.

**Tech Stack:**
- Next.js 16, React 19, TypeScript strict, Bun.
- Tests use vitest (`packages/shared`, `apps/web`) and bun:test with happy-dom (`packages/editor`, `apps/admin`).
- Tailwind v4 container queries.

**Spec:** `docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md`. Read D7, D8, C1, C2, C2a, C2b, "Left to the builder", the Anti-goals, and the "Stage 1/2/3 done" notes.

## Global Constraints

- **Toolchain:**
  - Bun only. `bun run check-types` must pass; it is the only type signal.
  - Format with `bun x ultracite fix` on the changed files.
  - Never run `next build` while Markus's dev servers may be up. Never run it in `apps/web` while any `next dev` uses that folder.
- **Tests:**
  - `packages/editor` and `apps/admin` use `bun test`. `packages/shared` and `apps/web` use `bunx vitest run <file>`.
  - The full admin `bun test` must stay green (1803+ pass). Any admin `mock.module` goes in a `.cases.ts` file run by a child-process runner, like `apps/admin/src/app/api/pages/route-cases.test.ts`.
- **Data:**
  - All Appwrite access goes through `@repo/api`.
  - `departments.theme_dark` and `departments.theme_accent` already exist (varchar 7, nullable; `packages/api/types/appwrite.ts:772-773`). Do not edit `appwrite.config.json`.
- **Editor chrome:** the editor's interface keeps its current look (D10). New controls reuse `.pe-*` classes and `theme/editor.css` tokens. Every new editor CSS selector is scoped under `.pg-*` or `.pe-*`.
- **Contrast thresholds (C2b, verbatim):** "dark against white at least **7 : 1** … and accent against dark at least **4.5 : 1** (covers both "stands out" and button text)". The nearest passing shade "keeps the hue and moves lightness just past the threshold".
- **What a theme covers (D7, verbatim):** "On that department's pages the theme colours the **nav, page header, dark sections, footer**, buttons, links, stat numbers, accent rules and chevron frames. White surfaces, typography, the chevron shape and spacing stay BISO. Elsewhere on the site, navy comes back."
- **Quick picks (D8):** deep `#001A35`, blue `#1668AE`, sky `#3AA3E1`, sun `#FECD45`, plus **Reset** to BISO.
- **Production (D13):** unpublished test pages and media may be created; delete them afterwards and list them in the hand-over. Never publish, never push schema, never `git push`, never edit a real department's theme.
- **Git:** never use `git stash`. The main checkout is shared with other sessions.
- **Commits:** every message ends with:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01H48AWgSdxtsCEZGyPFzJyq`

## Review Focus

1. **A hostile stored colour.** Feed in something like `"#fff;}body{display:none"`, `"red"` or `"#abc"` through a doc's meta, the department row or copilot output. Expected: it never reaches CSS text or inline style; it is dropped and the page renders BISO. Test lives in Task 1 (`themeCss` rejects) and Task 3 (`normalizePageDoc` drops).
2. **A stored theme that fails contrast.** Example: dark `#9B5DE5`, written by an old doc or the AI. Expected: the site renders BISO, not the failing theme. Test lives in Task 3 (normalize) and Task 5 (web resolver).
3. **Publishing page B of a department whose theme was set from page A.** Expected: publishing B must not wipe the department theme when B's draft never touched the theme. The difference between `theme` absent (follow the department) and `null` (reset to BISO) carries this. Test lives in Task 4.
4. **Leaving a themed page by client navigation, and the first paint.** Expected: navy returns on the next page. The themed page's first paint already has the theme (no flash of navy). Test lives in Task 5 (the style is inside the page tree, not the layout) and Task 8 (browser check).
5. **A light accent.** Example: gold `#FECD45` on a dark purple. Expected: links and buttons on white and tinted sections use a derived darker shade at ≥ 4.5 : 1 on both `#FFFFFF` and `#EEF1F5`. In dark mode (`.dark` on `<html>`), the derived raised, sunken, edge and muted-ink values keep body text ≥ 4.5 : 1. Test lives in Task 1.

---

### Task 1: Theme colour maths

**Files:**
- Create: `packages/shared/utils/page-theme.ts`, `packages/shared/utils/page-theme.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PageTheme { accent: string; dark: string } // "#rrggbb", lowercase
export const BISO_THEME: PageTheme; // { dark: "#001a35", accent: "#3aa3e1" }
export const THEME_QUICK_PICKS: readonly { hex: string; label: string }[]; // the four D8 colours, in order
export const MIN_DARK_ON_WHITE = 7;
export const MIN_ACCENT_ON_DARK = 4.5;
export function normalizeHex(input: string): string | null; // "#ABC", "abc", " #AbCdEf " → "#aabbcc"/"#abcdef"; anything else → null
export function contrastRatio(a: string, b: string): number; // WCAG 2.x relative luminance
export interface ColourCheck { ok: boolean; ratio: number; suggestion: string | null }
export interface ThemeCheck { accent: ColourCheck; dark: ColourCheck; ok: boolean }
export function checkTheme(theme: PageTheme): ThemeCheck;
export function nearestPassingShade(hex: string, against: string, minRatio: number): string | null;
export function parsePageTheme(value: unknown): PageTheme | null; // valid hex AND checkTheme ok, else null
export function themeTokens(theme: PageTheme): Record<`--${string}`, string>;
export function themeCss(theme: PageTheme): string; // ":root{--biso-deep:#…;…}"; throws on an invalid theme
```

- [ ] **Step 1: Write the failing tests** in `page-theme.test.ts`:
  - `normalizeHex`:
    - `"#ABC"` → `"#aabbcc"`
    - `"3AA3E1"` → `"#3aa3e1"`
    - `" #001A35 "` → `"#001a35"`
    - `"red"`, `"#12345"`, `"#fff;}"` and `""` → `null`
  - `contrastRatio`:
    - `#ffffff` vs `#000000` → `21` (toBeCloseTo, 2 places)
    - `#001a35` vs `#ffffff` → about `17.4` (±0.1)
    - `#1668ae` vs `#ffffff` → about `5.79` (±0.05)
  - `checkTheme(BISO_THEME).ok` is `true`.
  - `checkTheme({ dark: "#9b5de5", accent: "#3aa3e1" })`:
    - `dark.ok` is false.
    - `dark.suggestion` is a hex with the same hue (±2°) whose `contrastRatio` with `#ffffff` is ≥ 7 and < 7.3, so it moved "just past".
  - Accent `#1668ae` on dark `#001a35`:
    - `accent.ok` is false, because the ratio is below 4.5.
    - `accent.suggestion` is ≥ 4.5 against `#001a35` and has the same hue.
  - `nearestPassingShade` returns `null` when no lightness of that hue can pass. Example: `nearestPassingShade("#808080", "#808080", 21)`.
  - `parsePageTheme`:
    - `parsePageTheme({ dark: "#3b1c6b", accent: "#c8a2f0" })` returns a `PageTheme`.
    - `parsePageTheme({ dark: "#9b5de5", accent: "#c8a2f0" })` → `null`.
    - `parsePageTheme({ dark: "#fff;}body{", accent: "#c8a2f0" })` → `null`.
    - `parsePageTheme("x")` → `null`.
  - `themeTokens({ dark: "#3b1c6b", accent: "#fecd45" })`:
    - Contains `--biso-deep: "#3b1c6b"` and `--biso-sky: "#fecd45"`.
    - Its `--biso-blue` has ≥ 4.5 : 1 against both `#ffffff` and `#eef1f5`, and the same hue as the accent (±2°).
    - Its `--biso-deep-ink-muted` has ≥ 4.5 : 1 against both `--biso-deep` and `--biso-deep-raised`.
    - Its `--biso-deep-raised`, `--biso-deep-sunken` and `--biso-deep-edge` each differ from the dark colour.
    - It sets **no** `--ink` or `--biso-ink`. Text on white stays BISO.
  - `themeCss`:
    - Starts with `:root{` and contains every `themeTokens` entry.
    - Throws on `{ dark: "#fff;}body{", accent: "#000000" }`.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd packages/shared && bunx vitest run utils/page-theme.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement.**
  - Work in HSL.
  - `nearestPassingShade` binary-searches lightness in the direction that raises contrast against `against`, keeping hue and saturation, and returns the first passing value rounded to hex. Re-check after rounding.
  - `checkTheme`:
    - The dark suggestion is computed against `#ffffff` at 7.
    - The accent suggestion is computed against the theme's dark at 4.5. If the dark fails, use the dark's own suggestion.
  - `themeTokens`, derived from the theme:
    - `--biso-deep` is the dark colour.
    - `--biso-sky` is the accent.
    - `--biso-blue` is the accent darkened until it is ≥ 4.5 on both `#ffffff` and `#eef1f5`. This is D7's "derived shade for text on white".
    - `--biso-deep-raised` is the dark at L+5 percentage points.
    - `--biso-deep-sunken` is the dark at L−3 percentage points, floored at 0.
    - `--biso-deep-edge` is the dark at L+10 percentage points.
    - `--biso-deep-ink-muted` mixes white and the dark, starting at 55 % white, raised until it passes 4.5 against raised.
  - `themeCss` builds its text only from `normalizeHex` output.
- [ ] **Step 4: Run them and watch them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(shared): page theme colour maths with contrast checks`.

---

### Task 2: Named tokens so a theme can reach every navy

**Files:**
- Modify: `packages/ui/styles/biso-surface.css:178-286`
- Test: `apps/web/src/app/styles.test.ts`, which already asserts the palette lives in this file. Add the new cases there.

**Interfaces:**
- Produces these variables. Task 5 and Task 6 override them, and nothing else:
  - `--biso-deep`, `--biso-sky` and `--biso-blue` (these exist today)
  - new: `--biso-deep-raised: #0b2747`, `--biso-deep-sunken: #00142a`, `--biso-deep-edge: #12314f`, `--biso-deep-ink-muted: #93a7bb` and `--biso-ink: #001a35`, all defined in the `:where(.biso-surface-v2)` block.

- [ ] **Step 1: Write the failing tests:**
  - The `[data-surface="deep"]` block and both `.dark` blocks read `var(--biso-deep-raised)`, `var(--biso-deep-sunken)`, `var(--biso-deep-edge)` and `var(--biso-deep-ink-muted)`. They must contain no `#0b2747`, `#00142a`, `#12314f` or `#93a7bb` literals.
  - The light block's `--ink` is `var(--biso-ink)`.
  - Each new named token is defined exactly once, with the literal it replaces, so the rendered site stays byte-identical in value.
  - A guard scans the stage-touched surfaces for a hard-coded navy (`#001a35`, case-insensitive, or `rgb(0, 26, 53)`): `packages/editor/src/blocks/**`, `packages/editor/src/theme/sections.css`, `apps/web/src/components/nav/**` and `apps/web/src/components/layout/**`. It allows none.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd apps/web && bunx vitest run src/app/styles.test.ts`
  Expected: the new cases FAIL.
- [ ] **Step 3: Replace the literals** with the named tokens. Change no values.
- [ ] **Step 4: Run the tests and watch them pass.**
  Run: `cd apps/web && bunx vitest run src/app/styles.test.ts`
  Then run the editor's `bun test src/theme`. Expected: PASS.
- [ ] **Step 5: Commit** with `refactor(ui): name the navy-derived tokens so a page theme can override them`.

---

### Task 3: `PageMeta.theme` replaces `accentColor`

**Files:**
- **Editor document and store:**
  - Modify: `packages/editor/src/editor/types.ts` (`PageMeta`)
  - Modify: `store.ts` (default meta, `setTheme` action)
  - Modify: `operations.ts:588` (`setAccent` → `setTheme`)
  - Modify: `serialize.ts` (`normalizePageDoc`; the AI meta line at `:351`)
  - Modify: `test-fixtures.ts`
- **Editor theme files:**
  - Delete: `packages/editor/src/theme/presets.ts`, `presets.test.ts` and `apply.ts`
  - Modify: `theme/index.ts`, `render/index.ts` (drop the `HUE_COLORS` export)
- **Editor shell:**
  - Modify: `components/editor-shell/theme-scope.tsx`. Delete it if Task 6 no longer needs it; Task 6 owns the frame.
  - Modify: `components/editor-shell/index.tsx:352`
  - Modify: `inspector/index.tsx:266-283`. Remove the "Accent colour" row; Task 6 adds the Theme panel.
- **API, admin and web:**
  - Modify: `packages/api/page-builder.ts:42`
  - Modify: `apps/admin/src/app/api/translate-page/route.ts:13`
  - Modify: `apps/admin/src/app/(editor)/pages/[id]/_components/{initial-documents.ts,page-editor-client.tsx}`. `syncSharedMeta` now syncs `theme`.
  - Modify: `apps/admin/src/app/(portal)/_actions/departments.ts:752`
  - Modify: `apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx:65`, which drops `--page-accent`.
- Every test that mentions `accentColor` (see `grep -rln accentColor packages apps`).
- Keep `--page-accent` in `theme/tokens.css` and its two chrome users (`drop-line.tsx`, `editor.css:334,586`). It is now always the token default, so the chrome looks exactly as it does with the default accent today.

**Interfaces:**
- Consumes: Task 1 `PageTheme` and `parsePageTheme`.
- Produces:
  - `PageMeta.theme?: PageTheme | null` has three states:
    - `undefined` means not set on this page (follow the department).
    - `null` means reset to BISO.
    - An object means a custom theme.
  - Store action `setTheme(theme: PageTheme | null): void`. It pushes one undo step per call; the panel calls it on commit, not on every pointer move. See Task 6.
  - `normalizePageDoc` keeps `theme` only if it is `null` or `parsePageTheme(theme)` is non-null. Any other value becomes `undefined`.
  - `accentColor` no longer exists anywhere.

- [ ] **Step 1: Write the failing tests:**
  - **serialize:**
    - `normalizePageDoc` keeps a valid theme.
    - It turns `{ dark: "#9b5de5", accent: "#3aa3e1" }` into `undefined`.
    - It turns `{ dark: "#fff;}body{", … }` into `undefined`.
    - It keeps `null`.
    - It drops a legacy `accentColor` key without throwing.
  - **store:** `setTheme(x)` then `undo()` restores the previous `theme`.
  - **AI serialize:** the meta line reads `theme: BISO` when the theme is absent or null, and `theme: dark #3b1c6b, accent #c8a2f0` otherwise.
  - **admin `syncSharedMeta`** (`initial-documents.test.ts` or a new case): a theme set in one locale appears in the other.
  - **translate route schema:** a meta without `accentColor` and with `theme` parses.
  - **A grep test** (in `packages/editor/src/theme/`) asserts that no file under `packages/editor/src`, `apps/admin/src`, `apps/web/src` or `packages/api` contains `accentColor` or `HUE_COLORS`.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd packages/editor && bun test ./src`. Also run the admin and web tests for the files touched.
- [ ] **Step 3: Implement.** Remove the old picker's code paths entirely.
- [ ] **Step 4: Run everything and watch it pass:**
  - editor `bun test ./src`
  - the FULL admin `bun test`
  - `cd apps/web && bunx vitest run 'src/app/(public)'`
  - `cd packages/api && bunx vitest run page-builder.test.ts`
  - `bun run check-types`
- [ ] **Step 5: Commit** with `refactor(editor): page theme replaces the five-swatch accent`.

---

### Task 4: Save rejects a failing theme; Publish copies the theme to the department

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/pages.ts`:
  - `savePageEditorDoc` at `:258`
  - `publishPageAction` at `:374`
- Create: `apps/admin/src/lib/page-theme-publish.ts`. It is a plain module, not `"use server"`, and holds the pure decision.
- Test: `apps/admin/src/lib/page-theme-publish.test.ts`, plus a `.cases.ts` for the action if the action itself is tested.

**Interfaces:**
- Consumes: Task 1 `checkTheme` and `parsePageTheme`; Task 3 `PageMeta.theme`.
- Produces:
  - `departmentThemeUpdate(meta: Pick<PageMeta, "theme">): { theme_dark: string | null; theme_accent: string | null } | "skip" | "invalid"`. It returns:
    - `"skip"` when `theme === undefined`;
    - nulls for `null`;
    - the hex pair for a passing theme;
    - `"invalid"` for a failing one.

- [ ] **Step 1: Write the failing tests** for `departmentThemeUpdate`:
  - `undefined` → `"skip"`
  - `null` → `{ theme_dark: null, theme_accent: null }`
  - a passing pair → that pair
  - `{ dark: "#9b5de5", accent: "#3aa3e1" }` → `"invalid"`

  Then the action cases:
  - `savePageEditorDoc` with a failing theme returns `{ error }` mentioning contrast, and writes nothing.
  - `publishPageAction` on a page with `department_id` whose published doc has a passing theme calls `db.updateRow("app", "departments", departmentId, { theme_dark, theme_accent })` once. It writes an audit event `department_theme_updated`.
  - The same action with `theme` absent does not touch the department.
  - A page with no `department_id` never touches departments.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd apps/admin && bun test page-theme-publish`
- [ ] **Step 3: Implement.**
  - Read the published doc of the published locale (`getPageSourceDocument` or the row you already load), then normalize it.
  - Apply the update with the admin client after `assertPublishAccess` has passed. C2 says anyone who may edit the department's pages may set its theme.
- [ ] **Step 4: Run them and watch them pass.** Then run the FULL admin `bun test` and `bun run check-types`.
- [ ] **Step 5: Commit** with `feat(admin): publish copies a page's theme to its department`.

  Note in the report: `pages.ts` is a `"use server"` file. The controller runs `bun run build --filter=admin` at the end of the stage, when no dev server is up.

---

### Task 5: The website wears the theme

**Files:**
- Create:
  - `apps/web/src/lib/page-theme.ts`, a server-only resolver
  - `apps/web/src/components/page-theme-style.tsx`, a server component
- Modify:
  - `apps/web/src/lib/data/public-content.ts`: `DEPARTMENT_SELECT` at `:346` gains `theme_dark` and `theme_accent`; add `cachedDepartmentTheme(id)`
  - `apps/web/src/app/(public)/[...slug]/page.tsx`
  - `apps/web/src/app/(public)/units/[...segments]/page.tsx`. This covers both the custom-page branch and the coded default view.
  - `apps/web/src/app/(public)/design-system/page-blocks/page.tsx`. Add a `?theme=sample` preview that uses `{ dark: "#3b1c6b", accent: "#c8a2f0" }` (deep purple and lilac, as in "Success looks like").
- Tests: `page-theme.test.ts`, `page-theme-style.test.tsx`, and route tests next to the two pages.

**Interfaces:**
- Consumes: Task 1 `parsePageTheme` and `themeCss`; Task 2's token names; Task 3 normalized docs.
- Produces:
  - `resolvePageTheme(input: { departmentTheme: { theme_dark: string | null; theme_accent: string | null } | null; docTheme: PageTheme | null | undefined }): PageTheme | null`. The department wins whenever the page is bound to a department (C1). Otherwise it uses the doc's theme. It returns `null` for BISO.
  - `<PageThemeStyle theme={PageTheme | null} />` renders nothing for `null`, and otherwise `<style>{themeCss(theme)}</style>`. It has no `href` and no `precedence`, so React removes it when the page unmounts.

- [ ] **Step 1: Write the failing tests:**
  - **Resolver:**
    - A department theme beats a doc theme.
    - Without a department, the doc theme is used.
    - A failing department pair gives `null`.
    - A hostile string in either source gives `null`.
  - **`PageThemeStyle`:**
    - It renders `null` for `null`.
    - For the sample, it renders one `<style>` starting with `:root{` and containing `--biso-deep:#3b1c6b`.
  - **Catch-all page route test:**
    - A published page with `department_id` renders `PageThemeStyle` with the department's theme, as the FIRST child of the page's returned tree, before `RenderedPage`.
    - A page without a department uses `published_doc` meta.
    - A page with neither renders no `<style>`.
  - **Unit page route test:** the coded default view and the custom-page branch both render the department's theme.
  - **Layout guard:** `apps/web/src/app/layout.tsx` and the `(public)` layout never render `PageThemeStyle`. Theming is per page, so a theme cannot outlive its page.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd apps/web && bunx vitest run src/lib/page-theme.test.ts 'src/app/(public)'`
- [ ] **Step 3: Implement.**
  - Render `PageThemeStyle` before any `Suspense` boundary in each page, so it ships in the first HTML flush with the nav.
  - `cachedDepartmentTheme` uses `"use cache"` with `cacheLife("minutes")`, like its neighbours.
- [ ] **Step 4: Run them and watch them pass.** Then run the full web vitest and `bun run check-types`.
- [ ] **Step 5: Commit** with `feat(web): themed pages recolour nav, header, dark sections and footer`.

---

### Task 6: The editor canvas wears the theme; autosave and Publish refuse a failing one

**Files:**
- Modify:
  - `packages/editor/src/editor/types.ts` (`EditorDepartment` gains `theme: PageTheme | null`)
  - `components/editor-shell/canvas/index.tsx:127` (frame inline style)
  - `components/editor-shell/autosave-signature.ts` (`shouldAutosave`)
  - `components/editor-shell/index.tsx` (the Publish guard)
  - `apps/admin/src/app/(editor)/pages/[id]/page.tsx:64`
- Create: `packages/editor/src/editor/effective-theme.ts`
- Tests: `effective-theme.test.ts`, `canvas` frame test, `autosave-signature.test.ts`

**Interfaces:**
- Consumes: Task 1 `themeTokens`, `checkTheme` and `parsePageTheme`; Task 3 `PageMeta.theme`.
- Produces:
  - In the admin editor page (`apps/admin/src/app/(editor)/pages/[id]/page.tsx:64`), each `EditorDepartment` gets `theme: parsePageTheme({ dark: d.theme_dark, accent: d.theme_accent })`. `listAllDepartments` already returns full rows.
  - `effectiveTheme(meta: PageMeta, departments: EditorDepartment[]): PageTheme | null`. It returns:
    - `meta.theme` when that is not `undefined`;
    - otherwise the department's `theme`, matched on `meta.department`;
    - otherwise `null`.
  - `themeBlocksSave(meta: PageMeta): boolean` is true when `meta.theme` is an object and `checkTheme` fails.
  - `shouldAutosave(hydrated, current, changed, blocked = false)` returns false when `blocked`.

- [ ] **Step 1: Write the failing tests:**
  - **`effectiveTheme`:** the three cases above, plus `null` meta beating a department theme.
  - **Canvas:**
    - With a themed meta, `.pe-frame` has inline `--biso-deep` and the other `themeTokens` entries.
    - With `null`, it has none of them.
    - Changing `meta.theme` in the store updates the frame on the next render, which is the live repaint.
  - **`shouldAutosave(…, true)`** is false even after changes.
  - **The shell's Publish handler is not called while `themeBlocksSave` is true.** The publish control shows the existing disabled state, plus a `title` explaining that the colours fail the contrast check.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd packages/editor && bun test ./src`
- [ ] **Step 3: Implement.**
  - Set the variables on the `.pe-frame` element itself. Its own `:where(.biso-surface-v2)` declarations would shadow anything set on an ancestor.
  - Remove `ThemeScope` if it's now unused.
- [ ] **Step 4: Run them and watch them pass.** Then run the FULL admin `bun test` and `bun run check-types`.
- [ ] **Step 5: Commit** with `feat(editor): canvas previews the page theme; failing themes don't save`.

---

### Task 7: The Theme panel (D8)

**Files:**
- Create:
  - `packages/editor/src/components/editor-shell/inspector/theme-panel.tsx`
  - `packages/editor/src/components/editor-shell/inspector/colour-field.tsx`
- Modify:
  - `inspector/index.tsx` (page settings: render `<ThemePanel />` where "Accent colour" was)
  - `packages/editor/src/theme/editor.css` (new `.pe-colour*` rules in the chrome's existing style)
- Tests: `theme-panel.dom.test.tsx` and `colour-field.dom.test.tsx` (happy-dom; pattern in `blocks/tabs/render.dom.test.tsx`)

**Interfaces:**
- Consumes:
  - Task 1 `checkTheme`, `normalizeHex`, `THEME_QUICK_PICKS` and `BISO_THEME`
  - Task 3 `setTheme`
  - Task 6 `effectiveTheme`
- Produces:
  - `<ColourField label value onChange onCommit />`:
    - A saturation/value area: a 2-D pointer surface, `role="slider"` with `aria-valuetext` giving the hex, and arrow keys moving by 1 %.
    - A hue slider, as a native `<input type="range" min=0 max=359>`.
    - A hex text field. It commits on Enter or blur, through `normalizeHex`. An invalid entry shows "Not a colour" and keeps the last good value.
    - The four quick-pick swatches.
    - Dragging calls `onChange`, for a live repaint without an undo step per move. Releasing, picking a swatch, or committing the hex calls `onCommit`, which makes the one `setTheme` call (one undo step).
  - `<ThemePanel />`:
    - Two `ColourField`s, "Dark" and "Accent", seeded from `effectiveTheme`.
    - A Reset button that calls `setTheme(null)`.
    - A scope line:
      - "Applies to all <department name> pages" when `meta.department` is set;
      - otherwise "Applies to this page".
    - Under each field, a live result:
      - **When it passes:** "✓ 9.1 : 1".
      - **When dark fails:** "Too light for white text (5.2 : 1, needs 7 : 1)".
      - **When accent fails:** "Doesn't stand out on the dark colour (3.1 : 1, needs 4.5 : 1)".
      - **A suggestion:** a button "Use #xxxxxx" that commits the suggestion.
    - Copy is in English, like the rest of the inspector.

- [ ] **Step 1: Write the failing tests:**
  - **Typing and failing:**
    - Typing `#9B5DE5` into Dark's hex field and pressing Enter calls `setTheme` once, with `dark: "#9b5de5"`.
    - The panel shows the "Too light" message with the ratio.
    - Clicking "Use #…" sets a dark colour whose `contrastRatio` with white is ≥ 7.
  - **Bad input:** typing `zzz` shows "Not a colour" and does not call `setTheme`.
  - **Quick pick and reset:**
    - Clicking the sky quick pick on Accent commits `accent: "#3aa3e1"`.
    - Reset commits `null`.
  - **Scope line:** with `meta.department` set to a department named "Fadderullan Oslo", the panel reads "Applies to all Fadderullan Oslo pages".
  - **Keyboard and undo:**
    - ArrowRight on the saturation/value slider changes its `aria-valuetext`.
    - Dragging with pointer events produces exactly one undo entry after `pointerup`.
- [ ] **Step 2: Run them and watch them fail.**
  Run: `cd packages/editor && bun test theme-panel colour-field`
- [ ] **Step 3: Implement.**
  - No new dependency.
  - The saturation/value area is a `div` with two stacked gradients (white → hue horizontally, transparent → black vertically). It uses pointer capture.
  - All colour state is hex. Convert through Task 1's helpers; export what you need from `page-theme.ts` rather than duplicating maths.
- [ ] **Step 4: Run them and watch them pass.** Then run the editor `bun test ./src`, `bun run check-types`, and the brand-surface guard (`theme/brand-surface.test.ts`, "nothing reaches the host page").
- [ ] **Step 5: Commit** with `feat(editor): theme panel with live contrast checks and nearest passing shade`.

---

### Task 8: Visual check and stage note

**Files:**
- Fixes go in the owning task's files.
- Modify: `docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md`, appending "Stage 4 done".

- [ ] **Step 1: Run every suite.**
  - `bun run check-types`
  - editor `bun test ./src`
  - the FULL admin `bun test`
  - web `bunx vitest run`
  - `packages/shared` `bunx vitest run`
  - `packages/api` `bunx vitest run`. The `campus_benefits` failure is known.
  - ultracite on the changed paths

  Record the counts.
- [ ] **Step 2: Browser check (controller).**
  - Open `/design-system/page-blocks` and `/design-system/page-blocks?theme=sample` at 1440, 820 and 390. Screenshots go to `.playwright-mcp/stage4-*.png`.
  - **Themed page:**
    - The nav, page header, Dark and Photo sections and the footer are purple.
    - Buttons and links on white use the derived lilac shade.
    - Body text on white stays navy.
  - **Leaving the page:** from the themed gallery, click a nav link to `/`. The home page's nav and footer are navy again, with no reload.
  - **Dark mode:** toggle it on the themed gallery and check that text stays readable.
  - **Editor:** sign-in is Microsoft OAuth only, so if the admin can't be reached, record that the editor was checked by tests only.
- [ ] **Step 3: Append "Stage 4 done" to the spec.** Cover what works, plus the owed and known items. Include:
  - Unpublishing does not clear a department theme.
  - Copilot theme support is stage 5 (C7).
  - The C5 revalidation of department themes is stage 5.

  Commit with `docs: record stage 4 completion`.
