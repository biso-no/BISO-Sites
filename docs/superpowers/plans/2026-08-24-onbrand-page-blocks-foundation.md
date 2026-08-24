# On-brand page blocks — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the shared brand token layer, the brand typography, and the block layout primitives, then prove the whole stack end-to-end by migrating one pilot block.

**Architecture:** A single `biso-surface.css` defines the BISO public palette behind a zero-specificity selector, mounted on `<html>` in `apps/web` and on the editor canvas frame only in `apps/admin`. Five primitives in `packages/editor/src/blocks/_primitives/` own layout; `BlockSection` re-binds semantic CSS tokens for its subtree so every `@repo/ui` component self-corrects on any background. Blocks read semantic tokens only, never raw brand colours.

**Tech Stack:** Bun 1.3.1, Turborepo, Next.js 16 (App Router, RSC), React 19, Tailwind CSS v4 (CSS-first, no config file), `@repo/ui` (Radix + shadcn), `bun:test`, Biome via Ultracite.

**Spec:** `docs/superpowers/specs/2026-08-21-onbrand-page-blocks-design.md`

## Global Constraints

- **Package manager is Bun (`bun@1.3.1`). Never `npm` or `pnpm`.** Add deps with `bun add <pkg> --filter=<app>`. Pin shared versions in the root `package.json` `catalog` block and reference them as `"<pkg>": "catalog:"`.
- **`bun run check-types` is NOT sufficient evidence for this work.** Purged Tailwind utilities raise no type or lint error — they silently vanish, and only in production builds. `bun run build` is the gate.
- **Never interpolate a Tailwind class.** `grid-cols-${n}` and `` className={`p-${x}`} `` are unscannable and will be purged. Always map to complete static class strings. Task 5 adds a test that enforces this.
- **Tailwind arbitrary values cannot contain spaces.** Use underscores: `[--border:color-mix(in_oklch,var(--brand-foreground)_30%,transparent)]`.
- **Blocks read semantic tokens only** (`text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`). Never `text-[#3DA9E0]`, never a raw brand token inside a block. The contrast contract depends on this.
- **Out of scope — do not touch.** `packages/editor/src/theme/editor.css` (the `.pe-*` admin editor chrome) and every `#6b1e1e` under `apps/admin/src/app/(portal)/**` (shop studio, job studio, event studio, recruitment, communications). That claret is admin's intentional design language. The purge applies **only** to the block-rendering path enumerated in Task 9.
- **Do not edit** `packages/api/appwrite.config.json`, `packages/api/types/appwrite.ts`, or `apps/*/next-env.d.ts` — all generated.
- Run `bun x ultracite fix` before every commit; `lefthook` + `lint-staged` enforce it.
- Commits are authored as the repo owner. **Do not add a `Co-Authored-By` trailer.**

## Approved implementation-review amendments

The plan was reviewed against the branch at `6f66eef3` before execution. The
following corrections take precedence over conflicting steps below:

- Work in the existing `feat/onbrand-page-blocks` checkout. Task 1 does not
  create another branch or recommit the existing design documents.
- The shared dark selector must support both host shapes: web places `dark` and
  `biso-surface` on the same `<html>` element, while admin places `dark` on a
  wrapper outside the canvas surface. Use a zero-specificity selector that
  matches both `.dark.biso-surface` and `.dark .biso-surface`.
- Tests use the runner-native directory primitive (`import.meta.dirname` for
  Vitest and `import.meta.dir` for Bun) rather than Node's unavailable ESM
  `__dirname` global.
- Admin block backgrounds are resolved in `CanvasPane`, passed into
  `SortableBlock`, and then passed to `def.Render`; `CanvasPane` does not render
  block definitions directly. Array lookups retain a safe `"default"` fallback.
- The public renderer keeps the page accent throughout the migration. Task 9
  renames its inline custom property from `--accent` to `--page-accent`; it does
  not remove the value. Retained legacy block CSS and editor selection chrome
  read `--page-accent` as well, leaving shadcn's `--accent` semantics intact.
- Font utilities map through distinct `--font-biso-sans` and
  `--font-biso-display` backing variables. This avoids a specificity collision
  between Tailwind's generated `:root` theme properties and the zero-specificity
  surface mounted directly on web's `<html>` element. Host-level Inter/Museo
  variables and system stacks remain fallbacks when a host imports the shared
  theme without mounting the BISO surface.
- `BlockHeading` uses semantic surface tokens only. It must not read
  `text-brand-dark` or another raw brand colour inside a block primitive.
- Brand and inverted sections rebind the complete semantic surface set used by
  shared UI controls: background, foreground, card, popover, primary,
  secondary, muted, accent, border, input, and ring tokens.
- `Reveal` explicitly checks the user's reduced-motion preference; viewport
  animation is not assumed to disable itself.
- Explicit `layout.background` choices take precedence over the CTA's legacy
  visual variant. A variant supplies a fallback surface only while background
  remains automatic.
- The Task 9 palette migration includes the `TeamMember` hue type, empty team
  data, team inspector, and team renderer so retired hue names cannot be
  reintroduced by newly-authored content. AI accent input is validated against
  the fixed brand palette rather than accepting arbitrary hex.
- The foundation retains legacy `tokens.css` and `blocks.css` until the block
  migration plan. Claret grep guards therefore target TypeScript block-path
  defaults and accent write sites, excluding the explicitly retained legacy CSS.
- New inspector and CTA behavior receive automated regression tests before
  their production changes. Source-text tests are limited to the CSS ownership
  boundary that cannot be exercised without compiling both Next.js hosts; the
  production builds remain the authoritative integration gate.
- Next.js 16 emits compiled CSS under `.next/static/chunks/`; production utility
  checks use that path rather than the older `.next/static/css/` location.
- Next treats route folders beginning with `_` as private implementation
  folders. Temporary browser/build probes therefore use a non-private scratch
  route name and are removed immediately after verification.
- The pre-existing `departmentGrid.layout` string collides with the universal
  `layout` object. Its grid/list choice is migrated to `variant`, and both host
  boundaries normalize persisted legacy documents before editing or rendering.
  The same normalization maps retired `TeamMember` hues to current swatches.

---

### Task 1: Branch, and prove the token-scoping assumption

The entire design rests on one assumption: that a canvas-scoped `--brand` retints Tailwind utilities inside `apps/admin`, whose `:root` palette is deliberately different. This works because `packages/ui/styles/globals.css` uses `@theme inline`, so `bg-brand` compiles to `background-color: var(--brand)` and re-resolves at point of use — the same mechanism the existing `.dark` blocks rely on. **Verify it in a production build before building anything on top of it.** If it fails, stop and re-plan; every later task is void.

**Files:**
- Create: `apps/admin/src/app/(portal)/_scratch-token-probe/page.tsx` (deleted in Step 6)

**Interfaces:**
- Consumes: nothing
- Produces: a verified go/no-go on scoped token overriding. No code survives this task.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/onbrand-page-blocks
git add docs/superpowers/specs/2026-08-21-onbrand-page-blocks-design.md
git commit -m "docs: add on-brand page blocks design spec"
```

- [ ] **Step 2: Write the probe page**

```tsx
// apps/admin/src/app/(portal)/_scratch-token-probe/page.tsx
export default function TokenProbe() {
  return (
    <div>
      <div className="bg-brand p-8 text-brand-foreground" data-probe="unscoped">
        UNSCOPED — should use admin palette (or be transparent if --brand is undefined)
      </div>
      <div
        className="[--brand-foreground:oklch(1_0_0)] [--brand:oklch(0.68_0.14_220)]"
        data-probe="scope"
      >
        <div className="bg-brand p-8 text-brand-foreground" data-probe="scoped">
          SCOPED — must render BISO blue #3DA9E0 with white text
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build admin for production**

Run: `bun run build --filter=admin`
Expected: build succeeds.

- [ ] **Step 4: Confirm the utility survived the build**

Run: `grep -rl "background-color:var(--brand)" apps/admin/.next/static/css/ || grep -rl "var(--brand)" apps/admin/.next/static/css/`
Expected: at least one file matches. If nothing matches, `bg-brand` was purged — the `@theme inline` mapping is not reaching admin, and Task 4 must solve that before proceeding.

- [ ] **Step 5: Confirm scoping visually**

Run: `bun run dev --filter=admin`, open `http://localhost:3001/_scratch-token-probe`.
Expected: the inner box renders BISO blue `#3DA9E0` with white text, while the outer box does not. Confirm with the browser inspector that the computed `background-color` of `[data-probe="scoped"]` differs from `[data-probe="unscoped"]`.

**If the scoped box does not turn blue, STOP.** Report the finding; the spec's §5.1 assumption is wrong and the design needs revisiting.

- [ ] **Step 6: Delete the probe and commit the branch point**

```bash
rm -rf "apps/admin/src/app/(portal)/_scratch-token-probe"
git status --short
```
Expected: only the spec commit from Step 1 is present; no scratch files remain.

---

### Task 2: Create `biso-surface.css` and mount it in `apps/web`

Move the public palette out of `apps/web/src/app/styles.css` into one shared file so `apps/admin` can reuse it. Values are copied **verbatim** — this task must be a visual no-op for `apps/web`.

**Files:**
- Create: `packages/ui/styles/biso-surface.css`
- Modify: `apps/web/src/app/styles.css` (remove the `:root` and `.dark` blocks, add the import)
- Modify: `apps/web/src/app/layout.tsx:44` (add the class)
- Test: `apps/web/src/app/styles.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: the `.biso-surface` class contract. Any element carrying it, and all its descendants, resolve the BISO public palette: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, `--section`, `--section-foreground`, `--inverted`, `--inverted-foreground`, `--inverted-muted`, `--brand`, `--brand-dark`, `--brand-foreground`, `--brand-muted`, `--brand-muted-strong`, `--brand-border`, `--brand-border-strong`, `--brand-gradient-from`, `--brand-gradient-to`, `--brand-gradient-via`, `--brand-overlay-from`, `--brand-overlay-via`, `--brand-overlay-to`, `--brand-accent`, `--brand-accent-muted`, `--nav-background`, `--nav-foreground`, plus `--chart-*` and `--sidebar-*`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/styles.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(__dirname, "styles.css"), "utf8");
const surface = readFileSync(
  join(__dirname, "../../../../packages/ui/styles/biso-surface.css"),
  "utf8"
);

describe("brand token ownership", () => {
  it("declares the brand palette exactly once, in biso-surface.css", () => {
    expect(surface).toContain("--brand:");
    expect(surface).toContain(".biso-surface");
  });

  it("no longer declares brand tokens in the app stylesheet", () => {
    // Guards against the palette being re-duplicated into apps/web later.
    expect(styles).not.toMatch(/^\s*--brand:/m);
    expect(styles).not.toMatch(/^\s*--inverted:/m);
    expect(styles).not.toMatch(/^\s*--section:/m);
  });

  it("imports the shared surface", () => {
    expect(styles).toContain("biso-surface.css");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && bun run test src/app/styles.test.ts`
Expected: FAIL — `biso-surface.css` does not exist (ENOENT).

- [ ] **Step 3: Create the shared surface file**

Copy the **entire** `:root` block and the **entire** `.dark` block from `apps/web/src/app/styles.css`, changing only the selectors. **Do not retype the values** — a single mistyped `oklch()` is a silent colour regression. Extract them mechanically:

```bash
# Prints the two blocks; paste the bodies into the new file under the new selectors.
awk '/^:root \{/,/^\}/' apps/web/src/app/styles.css
awk '/^\.dark \{/,/^\}/' apps/web/src/app/styles.css
```

```css
/* packages/ui/styles/biso-surface.css */

/*
 * The BISO public brand surface — the single definition of the palette that
 * students see.
 *
 * Mounted in two places:
 *   - apps/web: on <html>, so the whole public site uses it.
 *   - apps/admin: on the page-editor canvas frame ONLY. Admin's own chrome
 *     palette is deliberately different and must not be affected.
 *
 * `:where()` holds specificity at 0 so app-level rules still win.
 * Requires `@theme inline` from ./globals.css, which makes Tailwind utilities
 * resolve these variables at point of use rather than at build time.
 */

:where(.biso-surface) {
  --radius: 0.625rem;
  /* …every declaration from the former apps/web :root block, verbatim… */
}

.dark :where(.biso-surface) {
  /* …every declaration from the former apps/web .dark block, verbatim… */
}
```

- [ ] **Step 4: Remove the duplicated blocks from `apps/web` and import the file**

In `apps/web/src/app/styles.css`, delete the `:root { … }` and `.dark { … }` blocks entirely, and add the import beside the existing shared-styles import:

```css
@import "../../../../packages/ui/styles/globals.css";
@import "../../../../packages/ui/styles/biso-surface.css";
```

Leave `@layer utilities { … }`, the `@keyframes fadeIn`, and the `@media print` block where they are.

- [ ] **Step 5: Mount the class on `<html>`**

In `apps/web/src/app/layout.tsx:44`:

```tsx
<html
  className={`${museoSans.variable} ${inter.variable} biso-surface`}
  lang={locale}
  suppressHydrationWarning
>
```

- [ ] **Step 6: Stop `tokens.css` repainting the host page**

`packages/editor/src/theme/tokens.css` styles bare `body`/`html`, and
`apps/web` imports it through `@repo/editor/theme/styles.css`. Opening any CMS
page therefore repaints the whole site's body warm paper at 14px. The file
cannot be deleted yet — unmigrated blocks still read its `--paper`/`--ink`
custom properties until Plan 2 — but the host-page rules can go now.

Delete these four rules from `packages/editor/src/theme/tokens.css`:

- `html, body { height: 100%; }`
- the entire `body { … }` block (font-family, font-size, line-height, colour, background, text-rendering)
- the entire `body::before { … }` noise-overlay block
- the `::selection { … }` block (it tints selection claret across the whole site)

**Keep** the `*, *::before, *::after { box-sizing: border-box; }` rule (Tailwind
preflight already sets this, so it is a no-op) and the
`button, input, textarea, select { font: inherit; color: inherit; }` rule —
admin's `.pe-*` chrome may depend on the latter. Both go in Plan 2 with the
rest of the file. Keep every `:root` custom property declaration.

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd apps/web && bun run test src/app/styles.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 8: Verify the no-op in a production build**

Run: `bun run build --filter=web`
Expected: build succeeds.

Run: `bun run dev --filter=web`, open `http://localhost:3000/about`.
Expected: **visually identical to before this task.** Compare the computed `background-color` of `<body>` and the colour of a `text-brand` element against the pre-change values. If anything shifted, a declaration was dropped in the copy.

Then open any published CMS page (or create a draft and preview it).
Expected: the site body is no longer warm paper — Step 6's leak is gone.

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix
git add packages/ui/styles/biso-surface.css packages/editor/src/theme/tokens.css apps/web/src/app/styles.css apps/web/src/app/layout.tsx apps/web/src/app/styles.test.ts
git commit -m "refactor: extract BISO public palette into shared biso-surface.css"
```

---

### Task 3: Wire the brand fonts sitewide

Museo Sans and Inter are loaded on every `apps/web` page view and applied to nothing — there is no `font-family` declaration in either stylesheet, no `tailwind.config.*`, and no `--font-sans` override. This task makes the fonts the site already pays for actually render.

**Files:**
- Modify: `packages/ui/styles/biso-surface.css`
- Create: `apps/admin/src/app/fonts.ts`
- Modify: `apps/admin/src/app/layout.tsx:28`
- Test: `apps/web/src/app/styles.test.ts` (extend)

**Interfaces:**
- Consumes: `.biso-surface` from Task 2
- Produces: `font-sans` resolves to Inter, `font-display` resolves to Museo Sans, inside any `.biso-surface`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/app/styles.test.ts`:

```ts
describe("brand typography", () => {
  it("maps the Tailwind font tokens to the loaded faces", () => {
    expect(surface).toContain("--font-sans:");
    expect(surface).toContain("--font-display:");
    expect(surface).toContain("var(--font-inter");
    expect(surface).toContain("var(--font-museo");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && bun run test src/app/styles.test.ts`
Expected: FAIL — `--font-sans:` not found in `biso-surface.css`.

- [ ] **Step 3: Add the font mapping**

In `packages/ui/styles/biso-surface.css`, inside the `:where(.biso-surface)` block:

```css
  /* Brand typography. The faces are loaded by each app's next/font call and
     exposed as --font-inter / --font-museo on <html>; the fallbacks keep the
     surface legible in any host that has not loaded them. */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, -apple-system,
    "Segoe UI", Roboto, sans-serif;
  --font-display: var(--font-museo), var(--font-inter), ui-sans-serif,
    system-ui, sans-serif;
```

Then map `--font-display` as a Tailwind token. In `packages/ui/styles/globals.css`, inside the existing `@theme inline { … }` block, beside the other mappings:

```css
  /* Font tokens */
  --font-display: var(--font-display);
```

`--font-sans` is a Tailwind built-in and needs no mapping — redefining the variable is enough.

- [ ] **Step 4: Load the fonts in admin**

`apps/admin/public/museo_sans_300.otf` already exists.

```ts
// apps/admin/src/app/fonts.ts
import { Inter } from "next/font/google";
import localFont from "next/font/local";

/**
 * Loaded so the page-editor canvas previews in the real public typefaces.
 * These only take effect inside `.biso-surface`; admin's own chrome keeps
 * GeistSans.
 */
export const museoSans = localFont({
  src: "../../public/museo_sans_300.otf",
  variable: "--font-museo",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
```

In `apps/admin/src/app/layout.tsx:28`:

```tsx
<html
  className={`${GeistSans.variable} ${museoSans.variable} ${inter.variable}`}
  lang={locale}
  suppressHydrationWarning
>
```

Add the import at the top of that file: `import { inter, museoSans } from "./fonts";`

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && bun run test src/app/styles.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify the typeface actually changed**

Run: `bun run build --filter=web && bun run dev --filter=web`, open `http://localhost:3000/about`.
Expected: body text now renders in Inter, not the system stack. Confirm in the inspector that `getComputedStyle(document.body).fontFamily` contains an Inter font name.

**Check heading fit.** Museo Sans 300 is lighter and wider than the system stack it replaces. Walk `/`, `/about`, `/events` and `/shop` looking for headings that now wrap or overflow. Note any that need size adjustment — fix them in this task.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add packages/ui/styles/biso-surface.css packages/ui/styles/globals.css apps/admin/src/app/fonts.ts apps/admin/src/app/layout.tsx apps/web/src/app/styles.test.ts
git commit -m "feat: apply Museo Sans and Inter across the public site"
```

---

### Task 4: Mount the surface on the admin canvas and wire Tailwind scanning

**Files:**
- Modify: `apps/admin/src/app/styles.css` (add `@source`)
- Modify: `apps/web/src/app/styles.css` (add `@source`)
- Modify: `packages/editor/src/components/editor-shell/canvas/index.tsx`
- Modify: `apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx`

**Interfaces:**
- Consumes: `.biso-surface` (Task 2), brand fonts (Task 3)
- Produces: Tailwind utilities written anywhere under `packages/editor/src/` survive production builds in both apps. The block render root carries `biso-surface` in both hosts.

- [ ] **Step 1: Add the `@source` directives**

Both apps already use this pattern for `@repo/ui`; follow it exactly.

In `apps/web/src/app/styles.css`, beside the existing `@source` lines:

```css
@source "../../../../packages/editor/src/**/*.{ts,tsx}";
```

In `apps/admin/src/app/styles.css`, beside its existing `@source` lines:

```css
@source "../../../../packages/editor/src/**/*.{ts,tsx}";
```

- [ ] **Step 2: Mount the surface on the web render root**

In `apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx`, replace the `pg-page` wrapper. Drop the `--accent` inline style — Task 9 replaces the accent system, and leaving it here would collide with shadcn's `--accent` token in the meantime.

```tsx
  return (
    <div className="biso-surface">
      {doc.blocks.map((block) => (
        <BlockRenderer block={block as Block} key={(block as Block).id} />
      ))}
    </div>
  );
```

Delete the now-unused `accentStyle` constant.

- [ ] **Step 3: Mount the surface on the admin canvas frame**

In `packages/editor/src/components/editor-shell/canvas/index.tsx`, add `biso-surface` to the frame class:

```tsx
  const frameClass = `pe-frame ${viewport} biso-surface`;
```

- [ ] **Step 4: Add a temporary probe to a block**

So there is something to look for in the built CSS. In `packages/editor/src/blocks/cta/render.tsx`, add `bg-brand` to the outermost element's className, temporarily.

- [ ] **Step 5: Build both apps and confirm the utility survives**

Run: `bun run build --filter=web && bun run build --filter=admin`
Expected: both succeed.

Run: `grep -rl "\.bg-brand" apps/web/.next/static/css/ apps/admin/.next/static/css/`
Expected: at least one CSS file in **each** app matches.

**If either app has no match, the `@source` path is wrong.** Check the relative depth — from `apps/<app>/src/app/styles.css`, `../../../../` reaches the repo root. Do not proceed until both match; every later task depends on this.

- [ ] **Step 6: Remove the probe**

Revert the `bg-brand` addition from `packages/editor/src/blocks/cta/render.tsx`.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add apps/web/src/app/styles.css apps/admin/src/app/styles.css packages/editor/src/components/editor-shell/canvas/index.tsx "apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx"
git commit -m "feat: scan editor package for Tailwind and mount brand surface on both render roots"
```

---

### Task 5: Layout types, auto-rhythm, and the dynamic-class guard

**Files:**
- Create: `packages/editor/src/blocks/_primitives/layout-types.ts`
- Create: `packages/editor/src/blocks/_primitives/resolve-layout.ts`
- Create: `packages/editor/src/blocks/_primitives/resolve-layout.test.ts`
- Create: `packages/editor/src/blocks/_primitives/no-dynamic-classes.test.ts`
- Modify: `packages/editor/package.json` (add the `test` script)
- Modify: `packages/editor/src/editor/types.ts:421` (intersect `layout` onto `Block`)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type BlockBackground = "auto" | "default" | "muted" | "brand" | "inverted" | "accent"`
  - `type BlockSpacing = "none" | "compact" | "normal" | "spacious"`
  - `type BlockWidth = "prose" | "content" | "wide" | "full"`
  - `type ResolvedBackground = Exclude<BlockBackground, "auto">`
  - `interface BlockLayout { background?: BlockBackground; spacing?: BlockSpacing; width?: BlockWidth }`
  - `resolveBackgrounds(blocks: { layout?: BlockLayout }[]): ResolvedBackground[]`
  - `Block` gains an optional `layout?: BlockLayout` member.

- [ ] **Step 1: Add a test script to the editor package**

`packages/editor` has no test script today, so `turbo run test` skips it. In `packages/editor/package.json`, in `scripts`:

```json
    "test": "bun test ./src",
```

This matches `apps/admin`, which already uses `bun test ./src`.

- [ ] **Step 2: Write the failing tests**

```ts
// packages/editor/src/blocks/_primitives/resolve-layout.test.ts
import { describe, expect, test } from "bun:test";
import type { BlockLayout } from "./layout-types";
import { resolveBackgrounds } from "./resolve-layout";

const b = (layout?: BlockLayout) => ({ layout });

describe("resolveBackgrounds", () => {
  test("alternates default and muted for untouched blocks", () => {
    expect(resolveBackgrounds([b(), b(), b(), b()])).toEqual([
      "default",
      "muted",
      "default",
      "muted",
    ]);
  });

  test("starts on default so the first block is never tinted", () => {
    expect(resolveBackgrounds([b()])).toEqual(["default"]);
  });

  test("honours an explicit background", () => {
    expect(
      resolveBackgrounds([b({ background: "inverted" }), b(), b()])
    ).toEqual(["inverted", "default", "muted"]);
  });

  test("never repeats a background on adjacent blocks", () => {
    const out = resolveBackgrounds([b({ background: "muted" }), b(), b()]);
    expect(out).toEqual(["muted", "default", "muted"]);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).not.toBe(out[i - 1]);
    }
  });

  test("treats an explicit auto exactly like an absent layout", () => {
    expect(resolveBackgrounds([b({ background: "auto" }), b()])).toEqual([
      "default",
      "muted",
    ]);
  });

  test("returns an empty array for an empty page", () => {
    expect(resolveBackgrounds([])).toEqual([]);
  });
});
```

```ts
// packages/editor/src/blocks/_primitives/no-dynamic-classes.test.ts
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Tailwind cannot see an interpolated class name, so `grid-cols-${n}` compiles
 * to nothing and fails ONLY in production builds, silently. Map to complete
 * static class strings instead. This test is the guard.
 */
const BLOCKS_DIR = join(import.meta.dir, "..");
const INTERPOLATED_CLASS = /className=\{`[^`]*\$\{/;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsxFiles(full));
    } else if (full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("no interpolated Tailwind classes", () => {
  test("every block file uses static class strings", () => {
    const offenders = tsxFiles(BLOCKS_DIR).filter((f) =>
      INTERPOLATED_CLASS.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/editor && bun test ./src/blocks/_primitives`
Expected: FAIL — cannot resolve `./layout-types` and `./resolve-layout`.

- [ ] **Step 4: Write the types**

```ts
// packages/editor/src/blocks/_primitives/layout-types.ts

/** Surface a block paints. `auto` is resolved by resolveBackgrounds(). */
export type BlockBackground =
  | "auto"
  | "default"
  | "muted"
  | "brand"
  | "inverted"
  | "accent";

export type BlockSpacing = "none" | "compact" | "normal" | "spacious";

export type BlockWidth = "prose" | "content" | "wide" | "full";

/** A background after `auto` has been resolved to a concrete surface. */
export type ResolvedBackground = Exclude<BlockBackground, "auto">;

/** Page-design controls shared by every block, edited in the Design panel. */
export interface BlockLayout {
  background?: BlockBackground;
  spacing?: BlockSpacing;
  width?: BlockWidth;
}
```

- [ ] **Step 5: Write the resolver**

```ts
// packages/editor/src/blocks/_primitives/resolve-layout.ts
import type { BlockLayout, ResolvedBackground } from "./layout-types";

/**
 * Auto-rhythm. An admin who sets nothing still gets a page with visual rhythm:
 * untouched blocks alternate between the plain and tinted surfaces, and an
 * explicit background both paints itself and reseeds the alternation so no two
 * adjacent sections share a surface.
 *
 * Called by both the web renderer and the admin canvas, so preview and
 * production agree by construction.
 */
export function resolveBackgrounds(
  blocks: { layout?: BlockLayout }[]
): ResolvedBackground[] {
  const out: ResolvedBackground[] = [];
  let previous: ResolvedBackground | null = null;

  for (const block of blocks) {
    const explicit = block.layout?.background;
    if (explicit && explicit !== "auto") {
      out.push(explicit);
      previous = explicit;
      continue;
    }
    const next: ResolvedBackground = previous === "default" ? "muted" : "default";
    out.push(next);
    previous = next;
  }

  return out;
}
```

- [ ] **Step 6: Intersect `layout` onto `Block`**

In `packages/editor/src/editor/types.ts`, add the import at the top:

```ts
import type { BlockLayout } from "@/blocks/_primitives/layout-types";
```

and change the union at line 421 so every block carries the optional field:

```ts
export type Block = (
  | HeroBlock
  | MarqueeBlock
  /* …the remaining 31 members, unchanged… */
) & { layout?: BlockLayout };
```

Discriminated-union narrowing on `type` still works through the intersection.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd packages/editor && bun test ./src/blocks/_primitives`
Expected: PASS, 7 tests.

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix
git add packages/editor/src/blocks/_primitives packages/editor/src/editor/types.ts packages/editor/package.json
git commit -m "feat: add block layout types, auto-rhythm resolver, and dynamic-class guard"
```

---

### Task 6: `BlockSection` and the contrast contract

The load-bearing primitive. It re-binds semantic tokens for its subtree, so a `Button` or `Card` from `@repo/ui` dropped into a navy section becomes correct with no per-block knowledge.

**Files:**
- Create: `packages/editor/src/blocks/_primitives/block-section.tsx`
- Create: `packages/editor/src/blocks/_primitives/block-section.test.tsx`
- Modify: `packages/editor/package.json` (add `@repo/ui` dependency)

**Interfaces:**
- Consumes: `ResolvedBackground`, `BlockSpacing`, `BlockWidth` (Task 5); `cn` from `@repo/ui/lib/utils`
- Produces: `BlockSection(props: { background: ResolvedBackground; spacing?: BlockSpacing; width?: BlockWidth; className?: string; children: ReactNode }): JSX.Element`. Defaults: `spacing = "normal"`, `width = "wide"`. Also exports `SURFACE`, `SPACING` and `WIDTH` for tests.

- [ ] **Step 1: Add the `@repo/ui` dependency**

```bash
bun add @repo/ui --filter=@repo/editor
```

- [ ] **Step 2: Write the failing test**

```tsx
// packages/editor/src/blocks/_primitives/block-section.test.tsx
import { describe, expect, test } from "bun:test";
import { SPACING, SURFACE, WIDTH } from "./block-section";

describe("surface classes", () => {
  test("every surface rebinds --foreground so text follows the background", () => {
    // default and muted inherit the page tokens unchanged; the three
    // high-contrast surfaces must rebind, or text stays dark on dark.
    for (const key of ["brand", "inverted"] as const) {
      expect(SURFACE[key]).toContain("[--foreground:");
      expect(SURFACE[key]).toContain("[--muted-foreground:");
      expect(SURFACE[key]).toContain("[--border:");
      expect(SURFACE[key]).toContain("[--card:");
    }
  });

  test("arbitrary values use underscores, never spaces", () => {
    // A space inside [] breaks the Tailwind class and it is silently purged.
    for (const value of Object.values(SURFACE)) {
      const arbitrary = value.match(/\[[^\]]*\]/g) ?? [];
      for (const token of arbitrary) {
        expect(token).not.toContain(" ");
      }
    }
  });

  test("every enum member maps to a class string", () => {
    expect(Object.keys(SURFACE).sort()).toEqual([
      "accent",
      "brand",
      "default",
      "inverted",
      "muted",
    ]);
    expect(Object.keys(SPACING).sort()).toEqual([
      "compact",
      "none",
      "normal",
      "spacious",
    ]);
    expect(Object.keys(WIDTH).sort()).toEqual([
      "content",
      "full",
      "prose",
      "wide",
    ]);
  });

  test("full width cancels the container padding at every breakpoint", () => {
    expect(WIDTH.full).toContain("px-0");
    expect(WIDTH.full).toContain("sm:px-0");
    expect(WIDTH.full).toContain("lg:px-0");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/editor && bun test ./src/blocks/_primitives/block-section.test.tsx`
Expected: FAIL — cannot resolve `./block-section`.

- [ ] **Step 4: Write the component**

```tsx
// packages/editor/src/blocks/_primitives/block-section.tsx
"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import type {
  BlockSpacing,
  BlockWidth,
  ResolvedBackground,
} from "./layout-types";

/**
 * The contrast contract.
 *
 * A surface does not merely paint a background — it rebinds the semantic
 * tokens for its whole subtree. Because every @repo/ui component is
 * token-driven, a Button or Card dropped into a navy section corrects itself
 * with no per-block knowledge and no variant plumbing.
 *
 * Blocks must therefore read semantic tokens only (text-foreground, bg-card,
 * border-border) and never a raw brand colour.
 *
 * Tailwind arbitrary values cannot contain spaces — use underscores.
 */
export const SURFACE: Record<ResolvedBackground, string> = {
  default: "bg-background",
  muted: "bg-section",
  brand:
    "bg-brand [--foreground:var(--brand-foreground)] " +
    "[--muted-foreground:color-mix(in_oklch,var(--brand-foreground)_78%,transparent)] " +
    "[--border:color-mix(in_oklch,var(--brand-foreground)_30%,transparent)] " +
    "[--card:color-mix(in_oklch,var(--brand-foreground)_12%,transparent)] " +
    "[--card-foreground:var(--brand-foreground)] " +
    "[--primary:var(--brand-foreground)] [--primary-foreground:var(--brand)]",
  inverted:
    "bg-inverted [--foreground:var(--inverted-foreground)] " +
    "[--muted-foreground:var(--inverted-muted)] " +
    "[--border:color-mix(in_oklch,var(--inverted-foreground)_18%,transparent)] " +
    "[--card:color-mix(in_oklch,var(--inverted-foreground)_8%,transparent)] " +
    "[--card-foreground:var(--inverted-foreground)] " +
    "[--primary:var(--brand)] [--primary-foreground:var(--brand-foreground)]",
  accent: "bg-brand-accent-muted",
};

/** Vertical rhythm. `normal` matches the py-16 used by hand-coded web pages. */
export const SPACING: Record<BlockSpacing, string> = {
  none: "py-0",
  compact: "py-8 sm:py-10 lg:py-12",
  normal: "py-12 sm:py-16 lg:py-24",
  spacious: "py-20 sm:py-28 lg:py-36",
};

/** Measure. `full` bleeds edge to edge and cancels the container padding. */
export const WIDTH: Record<BlockWidth, string> = {
  prose: "max-w-3xl",
  content: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none px-0 sm:px-0 lg:px-0",
};

interface BlockSectionProps {
  background: ResolvedBackground;
  children: ReactNode;
  /** Applied to the inner container, not the outer surface. */
  className?: string;
  spacing?: BlockSpacing;
  width?: BlockWidth;
}

export function BlockSection({
  background,
  children,
  className,
  spacing = "normal",
  width = "wide",
}: BlockSectionProps) {
  return (
    <section
      className={cn("relative text-foreground", SURFACE[background], SPACING[spacing])}
    >
      <div className={cn("mx-auto px-4 sm:px-6 lg:px-8", WIDTH[width], className)}>
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/editor && bun test ./src/blocks/_primitives`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add packages/editor/src/blocks/_primitives packages/editor/package.json bun.lock
git commit -m "feat: add BlockSection with the token-rebinding contrast contract"
```

---

### Task 7: `BlockHeading`, `BlockGrid`, `BlockCard`, `Reveal`

**Files:**
- Create: `packages/editor/src/blocks/_primitives/block-heading.tsx`
- Create: `packages/editor/src/blocks/_primitives/block-grid.tsx`
- Create: `packages/editor/src/blocks/_primitives/block-card.tsx`
- Create: `packages/editor/src/blocks/_primitives/reveal.tsx`
- Create: `packages/editor/src/blocks/_primitives/index.ts`
- Create: `packages/editor/src/blocks/_primitives/block-grid.test.ts`

**Interfaces:**
- Consumes: `cn` from `@repo/ui/lib/utils`; `Card` from `@repo/ui/components/ui/card`
- Produces:
  - `BlockHeading(props: { eyebrow?: string; title?: string; intro?: string; level?: 1 | 2 | 3; align?: "left" | "center"; className?: string })`
  - `BlockGrid(props: { columns?: 2 | 3 | 4; className?: string; children: ReactNode })`, plus exported `GRID_COLUMNS`
  - `BlockCard(props: { className?: string; children: ReactNode })`
  - `Reveal(props: { children: ReactNode; delay?: number; disabled?: boolean })`
  - `packages/editor/src/blocks/_primitives/index.ts` re-exports all primitives and the layout types.

- [ ] **Step 1: Write the failing test**

```ts
// packages/editor/src/blocks/_primitives/block-grid.test.ts
import { describe, expect, test } from "bun:test";
import { GRID_COLUMNS } from "./block-grid";

describe("grid columns", () => {
  test("maps each column count to a complete static class string", () => {
    expect(Object.keys(GRID_COLUMNS).sort()).toEqual(["2", "3", "4"]);
    for (const value of Object.values(GRID_COLUMNS)) {
      expect(value).toContain("grid-cols-1");
      expect(value).not.toContain("${");
    }
  });

  test("collapses to one column on phones and steps up at breakpoints", () => {
    expect(GRID_COLUMNS[2]).toBe("grid-cols-1 sm:grid-cols-2");
    expect(GRID_COLUMNS[3]).toBe("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3");
    expect(GRID_COLUMNS[4]).toBe("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/editor && bun test ./src/blocks/_primitives/block-grid.test.ts`
Expected: FAIL — cannot resolve `./block-grid`.

- [ ] **Step 3: Write `BlockGrid`**

```tsx
// packages/editor/src/blocks/_primitives/block-grid.tsx
"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Complete static class strings, never interpolated: Tailwind cannot see
 * `grid-cols-${n}` and would purge it, silently, in production only.
 * Replaces the inline `gridTemplateColumns: repeat(N,1fr)` the blocks used,
 * which never collapsed on phones.
 */
export const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

interface BlockGridProps {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}

export function BlockGrid({ children, className, columns = 3 }: BlockGridProps) {
  return (
    <div className={cn("grid gap-6 lg:gap-8", GRID_COLUMNS[columns], className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Write `BlockHeading`**

```tsx
// packages/editor/src/blocks/_primitives/block-heading.tsx
"use client";

import { cn } from "@repo/ui/lib/utils";
import { createElement } from "react";

interface BlockHeadingProps {
  align?: "left" | "center";
  className?: string;
  eyebrow?: string;
  intro?: string;
  /** Hero passes 1; every other block passes 2, keeping the outline correct. */
  level?: 1 | 2 | 3;
  title?: string;
}

const TITLE_SIZE: Record<1 | 2 | 3, string> = {
  1: "text-4xl sm:text-5xl lg:text-6xl",
  2: "text-2xl sm:text-3xl lg:text-4xl",
  3: "text-xl sm:text-2xl",
};

export function BlockHeading({
  align = "left",
  className,
  eyebrow,
  intro,
  level = 2,
  title,
}: BlockHeadingProps) {
  if (!(eyebrow || title || intro)) {
    return null;
  }
  return (
    <div
      className={cn(
        "mb-8 lg:mb-12",
        align === "center" && "mx-auto max-w-2xl text-center",
        className
      )}
    >
      {eyebrow ? (
        <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
          {eyebrow}
        </div>
      ) : null}
      {title
        ? createElement(
            `h${level}`,
            {
              className: cn(
                "font-display font-semibold text-balance text-foreground",
                TITLE_SIZE[level]
              ),
            },
            title
          )
        : null}
      {intro ? (
        <p className="mt-4 text-base text-muted-foreground leading-relaxed sm:text-lg">
          {intro}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Write `BlockCard` and `Reveal`**

```tsx
// packages/editor/src/blocks/_primitives/block-card.tsx
"use client";

import { Card } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Thin wrapper over the shared Card so blocks inherit the same surface as the
 * hand-coded web pages. Card reads --card / --card-foreground / --border, which
 * BlockSection rebinds, so this is automatically correct on every surface.
 */
export function BlockCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("h-full p-6", className)}>{children}</Card>
  );
}
```

```tsx
// packages/editor/src/blocks/_primitives/reveal.tsx
"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * The fade-and-rise the hand-coded web pages get from motion's whileInView.
 * Disabled in the editor (where blocks must be immediately visible to edit)
 * and, via motion's own reducedMotion handling, for users who ask for less.
 */
export function Reveal({
  children,
  delay = 0,
  disabled = false,
}: {
  children: ReactNode;
  delay?: number;
  disabled?: boolean;
}) {
  if (disabled) {
    return <>{children}</>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay, duration: 0.5 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
```

Add the dependency:

```bash
bun add motion --filter=@repo/editor
```

- [ ] **Step 6: Write the barrel**

This is a small, deliberate exception to the repo's no-barrel-files rule: it re-exports five sibling primitives only, so blocks can import them in one line.

```ts
// packages/editor/src/blocks/_primitives/index.ts
export { BlockCard } from "./block-card";
export { BlockGrid, GRID_COLUMNS } from "./block-grid";
export { BlockHeading } from "./block-heading";
export { BlockSection, SPACING, SURFACE, WIDTH } from "./block-section";
export type {
  BlockBackground,
  BlockLayout,
  BlockSpacing,
  BlockWidth,
  ResolvedBackground,
} from "./layout-types";
export { Reveal } from "./reveal";
export { resolveBackgrounds } from "./resolve-layout";
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd packages/editor && bun test ./src/blocks/_primitives`
Expected: PASS, 13 tests.

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix
git add packages/editor/src/blocks/_primitives packages/editor/package.json bun.lock
git commit -m "feat: add BlockHeading, BlockGrid, BlockCard and Reveal primitives"
```

---

### Task 8: Render both hosts through the resolver

Both the web renderer and the admin canvas must resolve backgrounds with the same function, or preview and production disagree.

**Files:**
- Modify: `apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx`
- Modify: `packages/editor/src/components/editor-shell/canvas/index.tsx`
- Modify: `packages/editor/src/blocks/types.ts`
- Modify: `packages/editor/src/render/index.ts`

**Interfaces:**
- Consumes: `resolveBackgrounds` (Task 5), `ResolvedBackground` (Task 5)
- Produces: every block's `Render` receives a new required prop `background: ResolvedBackground` alongside the existing `block`, `edit` and `onPatch`. Blocks pass it straight to `BlockSection`.

- [ ] **Step 1: Extend the block render signature**

`Render` is typed centrally on `BlockDefinition`, so this is a **one-line change that requires no per-block edits.** In `packages/editor/src/blocks/types.ts`, add the import:

```ts
import type { ResolvedBackground } from "./_primitives/layout-types";
```

and add the prop to the `Render` member of `BlockDefinition`:

```ts
  Render: React.ComponentType<{
    /** Surface this block paints, after auto-rhythm resolution. */
    background: ResolvedBackground;
    block: B;
    edit: boolean;
    onPatch: PatchFn;
  }>;
```

A component declaring only `{block, edit, onPatch}` stays assignable to a `ComponentType` whose props include `background` — a function taking fewer properties is assignable to one taking more. Every block also registers with `Render: XRender as never`, which bypasses the check regardless. So the 32 unmigrated blocks compile untouched and simply ignore the prop until Plan 2 migrates them.

- [ ] **Step 2: Export the resolver from the web-safe barrel**

In `packages/editor/src/render/index.ts`, beside the existing exports:

```ts
export { resolveBackgrounds } from "../blocks/_primitives/resolve-layout";
export type { ResolvedBackground } from "../blocks/_primitives/layout-types";
```

- [ ] **Step 3: Resolve in the web renderer**

In `apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx`:

```tsx
import {
  getBlock,
  resolveBackgrounds,
  useEditorStore,
  type ResolvedBackground,
} from "@repo/editor/render";

// …inside RenderedPage, after the store seeding…
  const backgrounds = resolveBackgrounds(doc.blocks);

  return (
    <div className="biso-surface">
      {doc.blocks.map((block, i) => (
        <BlockRenderer
          background={backgrounds[i]}
          block={block as Block}
          key={(block as Block).id}
        />
      ))}
    </div>
  );
}

function BlockRenderer({
  background,
  block,
}: {
  background: ResolvedBackground;
  block: Block;
}) {
  const def = getBlock(block.type);
  if (!def) {
    return null;
  }
  const noopPatch = () => undefined;
  return (
    <def.Render
      background={background}
      block={block as never}
      edit={false}
      onPatch={noopPatch}
    />
  );
}
```

- [ ] **Step 4: Resolve in the admin canvas**

In `packages/editor/src/components/editor-shell/canvas/index.tsx`, import the resolver:

```tsx
import { resolveBackgrounds } from "@/blocks/_primitives/resolve-layout";
```

Inside `CanvasPane`, derive the backgrounds once from the same `blocks` array the canvas already reads from `useBlocks()`:

```tsx
  const backgrounds = resolveBackgrounds(blocks);
```

Then pass each block's entry where the canvas renders `<def.Render …>`, alongside the props it already passes:

```tsx
  <def.Render
    background={backgrounds[index]}
    block={block as never}
    edit={mode === "edit"}
    onPatch={patchFor(block.id)}
  />
```

Use the index of the block within `blocks`. Both hosts now call the same
`resolveBackgrounds`, so preview and production cannot diverge.

- [ ] **Step 5: Verify types**

Run: `bun run check-types`
Expected: **no errors.** Step 1 explained why the 32 unmigrated blocks need no edit. If errors do appear, do not add `background` to 32 files — re-read Step 1, because something about the central typing changed.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
bun run check-types
git add packages/editor/src apps/web/src/app
git commit -m "feat: resolve block backgrounds through shared auto-rhythm in both hosts"
```

---

### Task 9: Rename `--accent` to `--page-accent` and install the brand palette

`--accent` is shadcn's reserved "subtle hover surface" token, consumed by `command`, `dialog`, `calendar`, `toolbar` and `toggle` in `@repo/ui`. Once blocks live in that system, writing a brand colour to `--accent` turns every dropdown hover inside the canvas bright blue.

**Scope guard:** this task changes only the files listed below. Do **not** touch `packages/editor/src/theme/editor.css` or any `#6b1e1e` under `apps/admin/src/app/(portal)/**`.

**Files:**
- Modify: `packages/editor/src/theme/presets.ts`
- Modify: `packages/editor/src/theme/apply.ts:5`
- Modify: `packages/editor/src/components/editor-shell/theme-scope.tsx:19-20`
- Modify: `packages/editor/src/editor/store.ts:85`
- Modify: `packages/editor/src/ai/tools/index.ts:107,109`
- Modify: `packages/editor/src/blocks/featuredCards/inspector.tsx:110,133`
- Modify: `packages/editor/src/blocks/team/inspector.tsx:12`
- Modify: `packages/editor/src/blocks/team/render.tsx:7`
- Modify: `apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx:65`
- Create: `packages/editor/src/theme/presets.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type AccentHue = "blue" | "navy" | "sky" | "gold" | "slate"`
  - `HUE_COLORS: Record<AccentHue, string>` — brand-derived hex values
  - `accentForDepartment(department: string): string` — unchanged signature
  - The CSS variable blocks read for the page accent is `--page-accent`. `--accent` reverts to its shadcn meaning.

- [ ] **Step 1: Write the failing test**

```ts
// packages/editor/src/theme/presets.test.ts
import { describe, expect, test } from "bun:test";
import { accentForDepartment, HUE_COLORS } from "./presets";

const PAPER_PALETTE = ["#6b1e1e", "#b08a3e", "#2f5d3a", "#2a4a7a"];

describe("accent palette", () => {
  test("contains no colour from the retired paper palette", () => {
    for (const hex of Object.values(HUE_COLORS)) {
      expect(PAPER_PALETTE).not.toContain(hex.toLowerCase());
    }
  });

  test("defaults an unknown department to BISO blue", () => {
    expect(accentForDepartment("does-not-exist").toLowerCase()).toBe("#3da9e0");
  });

  test("every mapped department resolves to a palette colour", () => {
    const palette = Object.values(HUE_COLORS).map((h) => h.toLowerCase());
    for (const dept of ["esn", "finans", "consulting", "marketing", "invest", "hr"]) {
      expect(palette).toContain(accentForDepartment(dept).toLowerCase());
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/editor && bun test ./src/theme/presets.test.ts`
Expected: FAIL — `HUE_COLORS` still contains `#6b1e1e`.

- [ ] **Step 3: Replace the palette**

```ts
// packages/editor/src/theme/presets.ts

/** Named brand swatches. Admins pick from these; there is no hex field. */
export type AccentHue = "blue" | "navy" | "sky" | "gold" | "slate";

export const HUE_COLORS: Record<AccentHue, string> = {
  blue: "#3DA9E0", // BISO blue — the default
  navy: "#001731", // BISO dark navy
  sky: "#7CC7EC", // lighter blue, for dark surfaces
  gold: "#F7D64A", // BISO yellow accent
  slate: "#33566F", // muted navy-blue, for dense pages
};

/** Map department slugs to their brand accent. */
export const DEPARTMENT_ACCENTS: Record<string, string> = {
  esn: HUE_COLORS.navy,
  finans: HUE_COLORS.slate,
  consulting: HUE_COLORS.blue,
  marketing: HUE_COLORS.gold,
  invest: HUE_COLORS.slate,
  hr: HUE_COLORS.sky,
};

export function accentForDepartment(department: string): string {
  return DEPARTMENT_ACCENTS[department] ?? HUE_COLORS.blue;
}
```

- [ ] **Step 4: Rename the variable at every write site**

`packages/editor/src/theme/apply.ts`:

```ts
"use client";

/** Set --page-accent on a DOM element (typically the ThemeScope wrapper). */
export function applyAccent(el: HTMLElement, hex: string) {
  el.style.setProperty("--page-accent", hex);
}
```

`packages/editor/src/components/editor-shell/theme-scope.tsx:19-20` — change the property name to `--page-accent` and the fallback from `"#6b1e1e"` to `"#3DA9E0"`.

`packages/editor/src/editor/store.ts:85` — `accentColor: "#3DA9E0"`.

`apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx:65` — `accentColor: source?.meta.accentColor ?? "#3DA9E0"`.

`packages/editor/src/blocks/featuredCards/inspector.tsx:110,133` and `packages/editor/src/blocks/team/inspector.tsx:12` — replace `#6b1e1e` with `HUE_COLORS.blue`, importing from `@/theme/presets`.

`packages/editor/src/blocks/team/render.tsx:7` — replace the claret gradient `linear-gradient(135deg,#6b1e1e,#a03030)` with a brand gradient built from the surface tokens: `linear-gradient(135deg,var(--brand-gradient-from),var(--brand-gradient-to))`.

- [ ] **Step 5: Fix the AI tool description**

`packages/editor/src/ai/tools/index.ts:107,109` currently instructs the model to use `claret=#6b1e1e, gold=#b08a3e, leaf=#2f5d3a, sky=#2a4a7a`, which would keep reintroducing off-brand accents no matter what the UI does.

```ts
      "Accepts a hex colour. Use one of the brand hues: blue=#3DA9E0, navy=#001731, sky=#7CC7EC, gold=#F7D64A, slate=#33566F.",
    parameters: z.object({
      hex: z.string().describe("Hex colour string, e.g. '#3DA9E0'"),
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/editor && bun test ./src/theme`
Expected: PASS, 3 tests.

- [ ] **Step 7: Confirm the scope guard held**

Run: `grep -rn "6b1e1e" packages/editor/src | grep -v theme/editor.css`
Expected: **no output.** Any remaining hit under `packages/editor/src` outside `theme/editor.css` is a missed site.

Run: `grep -rln "6b1e1e" "apps/admin/src/app/(portal)"`
Expected: the same file list as before this task — admin's studios are untouched.

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix
git add packages/editor/src apps/admin/src/app
git commit -m "refactor: rename block accent to --page-accent and adopt the brand swatch palette"
```

---

### Task 10: Shared Design panel in the inspector

`InspectorPane` renders `<def.Inspector>` at exactly one place, so this appears under every block automatically. `setProp` already splits on `.` and creates intermediate objects (`operations.ts:382-391`), so `onPatch("layout.background", …)` works with no store change.

**Files:**
- Create: `packages/editor/src/components/editor-shell/inspector/design-panel.tsx`
- Modify: `packages/editor/src/components/editor-shell/inspector/index.tsx:59`

**Interfaces:**
- Consumes: `InspRow`, `InspSection` from `./insp-parts`; `BlockLayout` (Task 5); `PatchFn` from `@/blocks/types`
- Produces: `DesignPanel(props: { layout?: BlockLayout; onPatch: PatchFn }): JSX.Element`

- [ ] **Step 1: Write the panel**

```tsx
// packages/editor/src/components/editor-shell/inspector/design-panel.tsx
"use client";

import type { PatchFn } from "@/blocks/types";
import type {
  BlockBackground,
  BlockLayout,
  BlockSpacing,
  BlockWidth,
} from "@/blocks/_primitives/layout-types";
import { InspRow, InspSection } from "./insp-parts";

const BACKGROUNDS: { label: string; value: BlockBackground }[] = [
  { label: "Auto", value: "auto" },
  { label: "Plain", value: "default" },
  { label: "Tinted", value: "muted" },
  { label: "Brand", value: "brand" },
  { label: "Dark", value: "inverted" },
  { label: "Highlight", value: "accent" },
];

const SPACINGS: { label: string; value: BlockSpacing }[] = [
  { label: "None", value: "none" },
  { label: "Tight", value: "compact" },
  { label: "Normal", value: "normal" },
  { label: "Airy", value: "spacious" },
];

const WIDTHS: { label: string; value: BlockWidth }[] = [
  { label: "Narrow", value: "prose" },
  { label: "Medium", value: "content" },
  { label: "Wide", value: "wide" },
  { label: "Full bleed", value: "full" },
];

/**
 * Rendered under every block's own inspector. "Auto" hands the background back
 * to auto-rhythm, which alternates plain and tinted down the page — so a page
 * nobody has touched still reads as composed.
 */
export function DesignPanel({
  layout,
  onPatch,
}: {
  layout?: BlockLayout;
  onPatch: PatchFn;
}) {
  return (
    <InspSection label="Design">
      <InspRow label="Background">
        <select
          onChange={(e) => onPatch("layout.background", e.target.value)}
          value={layout?.background ?? "auto"}
        >
          {BACKGROUNDS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </InspRow>
      <InspRow label="Spacing">
        <select
          onChange={(e) => onPatch("layout.spacing", e.target.value)}
          value={layout?.spacing ?? "normal"}
        >
          {SPACINGS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </InspRow>
      <InspRow label="Width">
        <select
          onChange={(e) => onPatch("layout.width", e.target.value)}
          value={layout?.width ?? "wide"}
        >
          {WIDTHS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </InspRow>
    </InspSection>
  );
}
```

- [ ] **Step 2: Mount it**

In `packages/editor/src/components/editor-shell/inspector/index.tsx`, directly after the `<def.Inspector … />` element at line 59:

```tsx
              <def.Inspector
                block={block as never}
                doc={doc}
                onPatch={onPatch}
              />
              <DesignPanel layout={block.layout} onPatch={onPatch} />
```

Add the import: `import { DesignPanel } from "./design-panel";`

- [ ] **Step 3: Verify it works end to end**

Run: `bun run check-types`
Expected: no errors.

Run: `bun run dev --filter=admin`, open a page at `/pages/{id}`, select any block.
Expected: a "Design" section appears at the bottom of the inspector with three dropdowns. Changing "Background" to "Dark" writes `layout.background = "inverted"` into the doc — confirm via the editor's undo history or by saving and re-reading the draft.

Note: the visual result only appears once a block composes `BlockSection`. Task 11 is the first.

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix
git add packages/editor/src/components/editor-shell/inspector
git commit -m "feat: add shared Design panel for block background, spacing and width"
```

---

### Task 11: Pilot — migrate the `cta` block end to end

The first block through the full stack. It is small (heading plus button) and has variants, so it exercises `BlockSection`, `BlockHeading`, the contrast contract, and the Design panel without the noise of a large block. **If anything in the foundation is wrong, this is where it surfaces.**

**Files:**
- Modify: `packages/editor/src/blocks/cta/render.tsx`
- Test: manual verification matrix (Step 4)

**Interfaces:**
- Consumes: `BlockSection`, `BlockHeading` (Tasks 6–7); the `background` prop (Task 8)
- Produces: the reference implementation every block in Plan 2 copies.

- [ ] **Step 1: Read the current block and its type**

Run: `cat packages/editor/src/blocks/cta/render.tsx && grep -n "interface CtaBlock" -A 10 packages/editor/src/editor/types.ts`
Note the existing props and variants so none are dropped.

- [ ] **Step 2: Rewrite the render**

`CtaBlock` is `{ id, label, title, type, url, variant?: "card" | "banner" | "gradient" }`
(`types.ts:186`). Note the fields are `label` and `url` — **not** `ctaLabel`/`ctaUrl`,
which is what the `hero` block uses. Every field is preserved below, including
inline editing of both the title and the button label, which the current block
supports and must not lose.

```tsx
// packages/editor/src/blocks/cta/render.tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { BlockSection } from "@/blocks/_primitives";
import type { ResolvedBackground } from "@/blocks/_primitives/layout-types";
import type { PatchFn } from "@/blocks/types";
import type { CtaBlock } from "@/editor/types";

interface Props {
  background: ResolvedBackground;
  block: CtaBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const HEADING =
  "font-display font-semibold text-balance text-3xl text-foreground sm:text-4xl lg:text-5xl";

/**
 * The paper-era variants were surface treatments. They map onto the brand
 * surfaces so the variant keeps its meaning without a second palette; `card`
 * defers to auto-rhythm. A lookup avoids a nested ternary, which Ultracite
 * rejects.
 */
const VARIANT_SURFACE: Record<
  NonNullable<CtaBlock["variant"]>,
  ResolvedBackground | null
> = {
  card: null,
  banner: "inverted",
  gradient: "brand",
};

export function CtaRender({ background, block, edit, onPatch }: Props) {
  const variant = block.variant ?? "card";

  return (
    <BlockSection
      background={VARIANT_SURFACE[variant] ?? background}
      spacing={block.layout?.spacing}
      width={block.layout?.width}
    >
      <div className="text-center">
        {edit ? (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the editor canvas uses contentEditable for inline editing.
          <h2
            className={HEADING}
            contentEditable
            data-edit="1"
            onBlur={(e) => onPatch("title", e.currentTarget.textContent ?? "")}
            suppressContentEditableWarning
          >
            {block.title}
          </h2>
        ) : (
          <h2 className={HEADING}>{block.title}</h2>
        )}
        <div className="mt-8">
          {edit ? (
            <Button size="lg" type="button">
              <span
                contentEditable
                data-edit="1"
                onBlur={(e) =>
                  onPatch("label", e.currentTarget.textContent ?? "")
                }
                suppressContentEditableWarning
              >
                {block.label}
              </span>
            </Button>
          ) : (
            <Button asChild size="lg">
              <a href={block.url}>{block.label}</a>
            </Button>
          )}
        </div>
      </div>
    </BlockSection>
  );
}
```

- [ ] **Step 3: Verify types, lint and the guard tests**

Run: `bun run check-types`
Expected: no errors.

Run: `cd packages/editor && bun test ./src`
Expected: PASS — including `no-dynamic-classes.test.ts`, which now scans the rewritten file.

- [ ] **Step 4: Run the verification matrix**

This is the definition of done for every block, in this plan and in Plan 2.

Run: `bun run build --filter=web && bun run build --filter=admin`
Expected: both succeed.

Run: `grep -rl "\.font-display" apps/web/.next/static/css/ apps/admin/.next/static/css/`
Expected: matches in both — proof the editor package's utilities survived the production build in each app.

Then, with `bun run dev`:

| Surface | Check |
|---|---|
| admin canvas, desktop 1180 | CTA renders in brand type and colours |
| admin canvas, tablet 820 | heading scales down, no overflow |
| admin canvas, mobile 390 | heading readable, button full-width-safe, no horizontal scroll |
| Design panel → Background: Dark | section turns navy **and the button inverts automatically** — this is the contrast contract working |
| Design panel → Background: Brand | section turns BISO blue, text stays legible |
| Design panel → Width: Narrow / Full bleed | measure visibly changes |
| Design panel → Spacing: Tight / Airy | vertical rhythm visibly changes |
| web, light mode | matches the admin canvas |
| web, dark mode (OS setting or devtools) | section and text both adapt; nothing stays bright |
| web, two CTAs with Background: Auto | the two sections alternate rather than repeat |

**The dark-background check in row 4 is the single most important assertion in this plan.** If the button does not invert by itself, the token rebinding in `SURFACE` is wrong and Plan 2 must not start.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/editor/src/blocks/cta
git commit -m "feat: migrate cta block to brand primitives as the pilot"
```

---

## Done when

- [ ] `bun run build --filter=web` and `bun run build --filter=admin` both pass.
- [ ] `bun run check-types` passes.
- [ ] `bun x ultracite check` passes.
- [ ] `cd packages/editor && bun test ./src` passes.
- [ ] `cd apps/web && bun run test src/app/styles.test.ts` passes.
- [ ] `grep -rn "6b1e1e" packages/editor/src | grep -v theme/editor.css` returns nothing.
- [ ] `grep -nE "^(body|html, body|body::before|::selection)" packages/editor/src/theme/tokens.css` returns nothing — the host-page leak is gone.
- [ ] `apps/admin/src/app/(portal)/**` is untouched — `git diff --stat main` shows no changes there.
- [ ] The Task 11 verification matrix passes in full, including the dark-background contrast check.

No completion claim is made without the command output backing it.

## Follow-on plans

This plan is phases 0–2 of the spec. The remaining three, each producing working software on its own:

- **Plan 2 — Block migration.** Tier 3 (20 presentational blocks), then Tier 1 (7 interactive blocks rebuilt on `@repo/ui`'s `Accordion`, `Tabs`, `Carousel`, `ToggleGroup`, `Select`). Delete `theme/tokens.css` and `theme/blocks.css` once the last block is off them.
- **Plan 3 — Live data.** The five missing `/api/pages/*` endpoints, the new `@repo/content-ui` package, Tier 2 (6 blocks), and deletion of the dead `/api/page-editor/collections/*` routes. Includes the regression pass on `/events`, `/jobs`, `/news` and `/shop`.
- **Plan 4 — Authoring.** Accent swatch UI, the canvas light/dark preview toggle, 4–5 starter templates, and the copilot extension (`layout` in the tool schema, raise `stopWhen: stepCountIs(5)`). The model question flagged in spec §8 is resolved by the owner before this plan is written.
