# Page Editor Stage 1: Sections and Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's flat block list with sections that hold one to four responsive columns of blocks, end to end: storage, rendering on the site, and building in the editor.

**Architecture:** `PageDoc` becomes version 2: `sections[] → columns[] → blocks[]`. Pure tree helpers and operations in `packages/editor/src/editor/` do every mutation; the zustand store wraps them with history. One `SectionView` renders a section on both the admin canvas and the public site, laid out by a new `theme/sections.css` that uses container queries, so the editor's device preview hits the real breakpoints. Blocks keep their current (pre-redesign) look in this stage; stages 2 and 3 rebuild them.

**Tech Stack:** TypeScript, React 19, Next.js 16, zustand + immer, @dnd-kit (core + sortable), bun:test with `react-dom/server`, Appwrite via `@repo/api`.

**Spec:** `docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md` (D2, D3, D5, D6, D10, D13, C5b in particular).

## Roadmap (one plan per stage; later plans are written when their stage starts)

1. **Sections and columns** (this plan).
2. **Look, part A:** v2 tokens on the canvas frame and site wrapper, new block primitives, Photo section background, and the blocks Page header, Text, Heading, Quote, Callout, Highlights, Facts, Image, Gallery, Video, Stats, Divider, Buttons, Call-to-action band.
3. **Look, part B:** Cards, Timeline, Steps, FAQ, Tabs, Team, Contact, Events, News, Jobs, Partners, Units, Shop, Signup, Form, Documents, Marquee; remove the cut blocks and the legacy `blocks.css`; guard tests.
4. **Themes:** department theme columns, the picker and contrast rules, publish copying to the department, themed nav/footer/coded pages, accent removal.
5. **Routing, publishing, uploads, copilot, fixes:** `projects/` pages, the national-project redirect, revalidation on publish, chunked uploads, the copilot on the new model, C11 fixes.
6. **Winter Games page.**

## Global Constraints

- Bun only. `bun run check-types` must pass (it is the only type signal; `next build` ignores type errors in web).
- Test runners differ by package: `packages/editor` and `apps/admin` use `bun test`; `packages/api` and `apps/web` use `vitest` (`bunx vitest run <file>`). `bun run test` at the root runs them all through turbo.
- Format with `bun x ultracite fix` before each commit.
- All Appwrite access goes through `@repo/api`. Never import `appwrite` / `node-appwrite` in app code.
- Schema edits go in `packages/api/appwrite.config.json`; **Markus pushes them and regenerates `packages/api/types/appwrite.ts`**. Never hand-edit the types file.
- The editor's interface keeps its current look (D10). New controls reuse the existing `.pe-*` classes and `theme/editor.css` tokens; no new visual language in the chrome.
- The editor stylesheet must not reach the host page: every new selector is scoped under `.pg-*` / `.pe-*` (enforced by `theme/brand-surface.test.ts`, "nothing reaches the host page").
- Production (D13): unpublished test pages and test media may be created to verify, must be deleted afterwards and listed in the hand-over. Never publish, never push schema, never `git push`.
- `"use server"` files export only async functions; after touching one, run `bun run build --filter=admin`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Breakpoints (container widths of the page): **tablet ≤ 1023px, phone ≤ 639px**.

## Review Focus

- **Changing a section to fewer columns** must never drop blocks: the removed columns' blocks join the last remaining column, in order (Task 3 test `shrinking columns keeps every block`).
- **Old or malformed documents** (v1 `{ meta, blocks }`, missing `sections`, missing layout fields) must render as an empty page, not throw, on the site and in the editor (Task 2 tests, Task 7 web test `renders an old-format document as an empty page`).
- **Undo after a cross-column move or a column-count change** restores the exact previous tree (Task 4 test `undo restores a cross-column move`).
- **A section with nothing in it** renders no empty padded band on the public site, but stays visible and droppable in the editor (Task 5 test `renders nothing for an empty section outside the editor`).
- **Auto-translation of a sectioned page** must still find the text: the translation walker skips the key `columns`, which would silently skip every block (Task 7 test `translates text inside a column`).

---

### Task 1: Feature branch and additive schema (then hand-off)

**Files:**
- Modify: `packages/api/appwrite.config.json` (`page_translations` columns ~line 4136; `departments` columns ~line 2286; `media` bucket ~line 12457)

**Interfaces:**
- Produces: `page_translations.draft_doc` and `page_translations.published_doc` (`mediumtext`), `departments.theme_dark` and `departments.theme_accent` (`varchar`, size 7), `media.maximumFileSize = 157286400`. After Markus pushes and regenerates, `PageTranslations` has `draft_doc: string | null` and `published_doc: string | null`.

- [ ] **Step 1: Create the branch**

```bash
git checkout redesign/apps-web && git checkout -b feat/page-editor-redesign
git add docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md docs/superpowers/plans/2026-10-23-page-editor-stage-1-sections.md
git commit -m "docs: page editor redesign spec and stage 1 plan"
```

- [ ] **Step 2: Add the columns and bucket size**

Append to `page_translations.columns`, mirroring the existing `mediumtext` shape (e.g. `m365_remediation_snapshot.result`):
`{"key": "draft_doc", "type": "mediumtext", "required": false, "array": false, "default": null, "encrypt": false}` and the same for `published_doc`.
Append to the `app` database `departments.columns`:
`{"key": "theme_dark", "type": "varchar", "required": false, "array": false, "size": 7, "default": null, "encrypt": false}` and the same for `theme_accent`.
Set the `media` bucket's `maximumFileSize` to `157286400`. Do **not** remove `draft_document` / `puck_document` (cutover only).

- [ ] **Step 3: Validate the JSON**

Run: `python3 -I -c "import json;json.load(open('packages/api/appwrite.config.json'))" && echo ok`
Expected: `ok`

- [ ] **Step 4: Commit and hand off**

```bash
git add packages/api/appwrite.config.json
git commit -m "feat(api): add mediumtext page documents, department theme columns, 150 MB media"
```

Stop and ask Markus to push the schema and regenerate types (`appwrite push tables`, `appwrite push buckets`, then `appwrite types -l ts ./types` in `packages/api`). Tell him the `varchar` shape is new to this file and should be checked when pushing. Continue only when `grep -n "draft_doc" packages/api/types/appwrite.ts` finds the new field.

---

### Task 2: Document model v2, normalization and tree reads

**Files:**
- Modify: `packages/editor/src/editor/types.ts`
- Create: `packages/editor/src/editor/ids.ts`
- Create: `packages/editor/src/editor/sections.ts`
- Create: `packages/editor/src/editor/tree.ts`
- Create: `packages/editor/src/editor/test-fixtures.ts`
- Modify: `packages/editor/src/editor/serialize.ts` (`normalizePageDoc`, `fromJSON`)
- Test: `packages/editor/src/editor/tree.test.ts`, `packages/editor/src/editor/serialize.test.ts` (replace the legacy-migration cases)

**Interfaces:**
- Produces (types.ts):
  - `PAGE_DOC_VERSION = 2`
  - `type SectionColumns = "1" | "1-1" | "2-1" | "1-2" | "1-1-1" | "1-1-1-1"`
  - `type SectionBackground = "white" | "tinted" | "dark"` (stage 2 adds `"photo"`)
  - `type SectionSpacing = "tight" | "normal" | "roomy"`, `type SectionAlign = "top" | "middle" | "bottom"`, `type SectionTablet = "row" | "stack"`
  - `interface SectionLayout { align; background; columns: SectionColumns; hideOnPhone: boolean; phoneReverse: boolean; spacing; tablet }`
  - `interface Column { blocks: Block[]; id: string }`
  - `interface Section { anchor?: string; columns: Column[]; id: string; layout: SectionLayout }`
  - `Block` gains `hideOnPhone?: boolean` (keep the existing `layout?: BlockLayout` until stage 3 deletes it).
  - `interface PageDoc { meta: PageMeta; sections: Section[]; version: 2 }`
  - `interface InsertTarget { beforeBlockId?: string; columnId: string }` (no `beforeBlockId` = end of column)
- Produces (ids.ts): `newId(prefix: "b" | "c" | "s"): string` → `${prefix}-` + 6 base-36 chars (the format `rid()` uses today).
- Produces (sections.ts): `DEFAULT_SECTION_LAYOUT: SectionLayout` (`columns "1"`, `background "white"`, `spacing "normal"`, `align "top"`, `tablet "row"`, `phoneReverse false`, `hideOnPhone false`), `COLUMN_COUNT: Record<SectionColumns, number>`, `emptySection(columns?: SectionColumns): Section`, `sectionOf(...blocks: Block[]): Section` (one column holding the blocks).
- Produces (tree.ts): `walkBlocks(doc: PageDoc): Block[]` (reading order), `findBlock(doc, blockId): { block: Block; blockIndex: number; column: Column; section: Section } | null`, `findColumn(doc, columnId): { column: Column; section: Section } | null`, `findSection(doc, sectionId): { index: number; section: Section } | null`, `targetAfterBlock(doc, blockId): InsertTarget | null`, `defaultInsertTarget(doc, selectedBlockId: string | null): InsertTarget | null` (after the selected block, else null).
- Produces (serialize.ts): `normalizePageDoc(doc: PageDoc): PageDoc` returns a v2 doc. Not version 2 or no `sections` array → `{ version: 2, meta: doc.meta, sections: [] }`. Missing layout fields come from `DEFAULT_SECTION_LAYOUT`. A column count that disagrees with `layout.columns` is padded with empty columns, or has its extra columns merged into the last kept column.
- Produces (test-fixtures.ts, test-only helpers): `block(id: string, type?: BlockType): Block` (from `emptyBlock`, id overridden), `section(id: string, columns: SectionColumns, blockIds: string[][]): Section` (column ids `${id}-c${i}`), `doc(...sections: Section[]): PageDoc`.

- [ ] **Step 1: Write the failing tests**

```ts
// tree.test.ts
const d = doc(section("s-1", "1-1", [["b-1", "b-2"], ["b-3"]]), section("s-2", "1", [["b-4"]]));

test("walkBlocks reads sections, then columns, then blocks", () => {
  expect(walkBlocks(d).map((b) => b.id)).toEqual(["b-1", "b-2", "b-3", "b-4"]);
});
test("findBlock locates a block in a second column", () => {
  const found = findBlock(d, "b-3");
  expect(found?.section.id).toBe("s-1");
  expect(found?.column.id).toBe("s-1-c1");
  expect(found?.blockIndex).toBe(0);
});
test("targetAfterBlock points before the next block, or at the column end", () => {
  expect(targetAfterBlock(d, "b-1")).toEqual({ columnId: "s-1-c0", beforeBlockId: "b-2" });
  expect(targetAfterBlock(d, "b-2")).toEqual({ columnId: "s-1-c0" });
  expect(targetAfterBlock(d, "missing")).toBeNull();
});
test("defaultInsertTarget follows the selection", () => {
  expect(defaultInsertTarget(d, "b-3")).toEqual({ columnId: "s-1-c1" });
  expect(defaultInsertTarget(d, null)).toBeNull();
});

// serialize.test.ts
test("an old flat document becomes an empty v2 page with its meta", () => {
  const old = { meta: d.meta, blocks: [block("b-9")] } as unknown as PageDoc;
  expect(normalizePageDoc(old)).toEqual({ version: 2, meta: d.meta, sections: [] });
});
test("missing layout fields take the defaults", () => {
  const partial = doc({ ...section("s-1", "1", [["b-1"]]), layout: { columns: "1" } as SectionLayout });
  expect(normalizePageDoc(partial).sections[0].layout).toEqual(DEFAULT_SECTION_LAYOUT);
});
test("a two-column layout with one stored column gets an empty second column", () => {
  const s = section("s-1", "1", [["b-1"]]);
  const n = normalizePageDoc(doc({ ...s, layout: { ...s.layout, columns: "1-1" } }));
  expect(n.sections[0].columns.map((c) => c.blocks.length)).toEqual([1, 0]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/editor && bun test src/editor/tree.test.ts src/editor/serialize.test.ts`
Expected: FAIL (modules / exports missing)

- [ ] **Step 3: Implement the types, ids, sections, tree helpers and `normalizePageDoc`**

Drop the v1 migrations in `serialize.ts` (departmentGrid `layout`, team hues): D2 means no old documents survive. `fromJSON` keeps calling `normalizePageDoc`. Use the same "fix the column count" logic that Task 3's `setSectionLayout` uses: export `resizeColumns(section: Section, columns: SectionColumns): void` from `sections.ts` (it mutates).

- [ ] **Step 4: Run them to see them pass**

Run: `cd packages/editor && bun test src/editor/tree.test.ts src/editor/serialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/editor
git commit -m "feat(editor): page documents are sections of columns of blocks"
```

(Other packages will not type-check until Task 7; that is expected between Tasks 2 and 7.)

---

### Task 3: Tree operations

**Files:**
- Modify: `packages/editor/src/editor/operations.ts` (replace the flat-list operations; keep `emptyBlock` and its defaults)
- Test: `packages/editor/src/editor/operations.test.ts` (create)

**Interfaces:**
- Consumes: Task 2's types, `newId`, `emptySection`, `resizeColumns`, `findBlock`, `findColumn`, `findSection`.
- Produces (all mutate the given doc / immer draft):
  - `insertBlock(doc, type: BlockType, target: InsertTarget): string | null` (null when the column doesn't exist)
  - `insertBlockInNewSection(doc, type: BlockType, sectionIndex: number): { blockId: string; sectionId: string }`
  - `removeBlock(doc, blockId): void`, `duplicateBlock(doc, blockId): string | null` (copy right after the original, new id)
  - `moveBlock(doc, blockId, target: InsertTarget): void` (no-op when `target.beforeBlockId === blockId` or the target column is missing)
  - `moveBlockToNewSection(doc, blockId, sectionIndex: number): string | null` (returns the new section id)
  - `insertSection(doc, columns: SectionColumns, sectionIndex: number): string`
  - `removeSection(doc, sectionId): void`, `duplicateSection(doc, sectionId): string | null` (fresh ids for the section, its columns and its blocks; inserted right after)
  - `moveSection(doc, sectionId, beforeSectionId?: string): void` (no `beforeSectionId` = to the end)
  - `setSectionLayout(doc, sectionId, patch: Partial<SectionLayout>): void` (calls `resizeColumns` when `columns` changes)
  - `setSectionAnchor(doc, sectionId, anchor: string): void` (stores `slugifyAnchor(anchor)`; empty string removes `anchor`)
  - `slugifyAnchor(input: string): string` (lowercase, `æ→ae ø→o å→a`, non `[a-z0-9]` runs → `-`, trimmed of `-`)
  - unchanged signatures, now tree-aware: `setProp(doc, blockId, path, value)`, `setVariant`, `bindCollection`, `applyAccent`, `setMeta`
  - `reorder` is deleted.

- [ ] **Step 1: Write the failing tests** (fresh `d` from Task 2's fixture in each test)

```ts
test("insertBlock places a block before another in a column", () => {
  const id = insertBlock(d, "stats", { columnId: "s-1-c1", beforeBlockId: "b-3" });
  expect(ids(d, "s-1-c1")).toEqual([id, "b-3"]);
});
test("insertBlock into a missing column changes nothing", () => {
  expect(insertBlock(d, "stats", { columnId: "nope" })).toBeNull();
  expect(walkBlocks(d)).toHaveLength(4);
});
test("moveBlock moves across sections to the column end", () => {
  moveBlock(d, "b-1", { columnId: "s-2-c0" });
  expect(ids(d, "s-1-c0")).toEqual(["b-2"]);
  expect(ids(d, "s-2-c0")).toEqual(["b-4", "b-1"]);
});
test("moveBlock reorders inside a column", () => {
  moveBlock(d, "b-2", { columnId: "s-1-c0", beforeBlockId: "b-1" });
  expect(ids(d, "s-1-c0")).toEqual(["b-2", "b-1"]);
});
test("shrinking columns keeps every block", () => {
  setSectionLayout(d, "s-1", { columns: "1" });
  expect(d.sections[0].columns).toHaveLength(1);
  expect(ids(d, d.sections[0].columns[0].id)).toEqual(["b-1", "b-2", "b-3"]);
});
test("growing columns adds empty columns with unique ids", () => {
  setSectionLayout(d, "s-2", { columns: "1-1-1" });
  const cols = d.sections[1].columns;
  expect(cols.map((c) => c.blocks.length)).toEqual([1, 0, 0]);
  expect(new Set(cols.map((c) => c.id)).size).toBe(3);
});
test("duplicateSection copies with fresh ids right after the original", () => {
  const copyId = duplicateSection(d, "s-1");
  expect(d.sections.map((s) => s.id)).toEqual(["s-1", copyId, "s-2"]);
  const copied = walkBlocks({ ...d, sections: [d.sections[1]] });
  expect(copied.map((b) => b.type)).toEqual(["text", "text", "text"]);
  expect(copied.some((b) => ["b-1", "b-2", "b-3"].includes(b.id))).toBe(false);
});
test("a block can start a new section", () => {
  const sectionId = moveBlockToNewSection(d, "b-3", 0);
  expect(d.sections[0].id).toBe(sectionId);
  expect(ids(d, d.sections[0].columns[0].id)).toEqual(["b-3"]);
  expect(ids(d, "s-1-c1")).toEqual([]);
});
test("moveSection puts a section before another, or at the end", () => {
  moveSection(d, "s-2", "s-1");
  expect(d.sections.map((s) => s.id)).toEqual(["s-2", "s-1"]);
  moveSection(d, "s-2");
  expect(d.sections.map((s) => s.id)).toEqual(["s-1", "s-2"]);
});
test("setProp reaches a block inside a column", () => {
  setProp(d, "b-3", "body.0.text", "Hei");
  expect((findBlock(d, "b-3")?.block as TextBlock).body[0].text).toBe("Hei");
});
test("anchors are slugified", () => {
  setSectionAnchor(d, "s-1", "Se Aftermovien!");
  expect(d.sections[0].anchor).toBe("se-aftermovien");
  expect(slugifyAnchor("Påmelding & billetter")).toBe("pamelding-billetter");
});
```

(`ids(doc, columnId)` is a three-line helper in the test file that returns the column's block ids.)

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/editor && bun test src/editor/operations.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the operations listed under Interfaces**

- [ ] **Step 4: Run to see them pass**

Run: `cd packages/editor && bun test src/editor/operations.test.ts src/editor/tree.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/editor/operations.ts packages/editor/src/editor/operations.test.ts
git commit -m "feat(editor): operations for sections, columns and moving blocks between them"
```

---

### Task 4: Store, hooks and autosave on the tree

**Files:**
- Modify: `packages/editor/src/editor/store.ts`, `packages/editor/src/editor/hooks.ts`
- Modify: `packages/editor/src/components/editor-shell/autosave-signature.ts`
- Test: `packages/editor/src/editor/store-tree.test.ts` (create), `packages/editor/src/components/editor-shell/autosave-signature.test.ts`, `packages/editor/src/editor/store-status.test.ts` (fixture update)

**Interfaces:**
- Consumes: Task 3 operations, Task 2 `defaultInsertTarget`, `findBlock`, `findSection`.
- Produces (store state and actions; existing ones not listed keep their signatures):
  - `EMPTY_DOC` is `{ version: 2, meta: <unchanged meta>, sections: [] }`. History snapshots are `{ meta, sections }`.
  - `selectedSectionId: string | null`, `selectSection(id: string | null)`. It clears `selection`, and `select(id)` clears `selectedSectionId`.
  - `insertTarget: InsertTarget | null` and `setInsertTarget(target: InsertTarget | null)`.
  - `insertBlock(type, target?: InsertTarget): string`. The target is `target ?? insertTarget ?? defaultInsertTarget(doc, selection)`. If there's still no target, the block goes into a new one-column section at the end. Afterwards `insertTarget` is cleared and the new block is selected.
  - `moveBlock(blockId, target)`, `moveBlockToNewSection(blockId, sectionIndex)`, `insertBlockInNewSection(type, sectionIndex): string` (block id)
  - `insertSection(columns, sectionIndex): string`, `removeSection(id)`, `duplicateSection(id)`, `moveSection(id, beforeSectionId?)`, `setSectionLayout(id, patch)`, `setSectionAnchor(id, anchor)`
  - `removeBlock` and `removeSection` clear any selection they delete. Removing a section clears `selection` when the selected block was inside it.
  - `reorder` is removed.
  - Hooks: `useSections()`, `useSelectedSectionId()`, `useInsertTarget()`; `useBlocks` is removed.
  - `autosaveSignature(doc)` serializes `{ sections, meta minus status }`.

- [ ] **Step 1: Write the failing tests**

```ts
beforeEach(() => useEditorStore.getState().setDoc(doc(section("s-1", "1-1", [["b-1"], ["b-2"]]))));

test("insertBlock with nothing selected appends a one-column section", () => {
  const id = useEditorStore.getState().insertBlock("stats");
  const { sections } = useEditorStore.getState().doc;
  expect(sections).toHaveLength(2);
  expect(sections[1].layout.columns).toBe("1");
  expect(sections[1].columns[0].blocks[0].id).toBe(id);
});
test("insertBlock uses and clears the pending insert target", () => {
  const s = useEditorStore.getState();
  s.setInsertTarget({ columnId: "s-1-c1" });
  const id = s.insertBlock("stats");
  expect(useEditorStore.getState().doc.sections[0].columns[1].blocks.map((b) => b.id)).toEqual(["b-2", id]);
  expect(useEditorStore.getState().insertTarget).toBeNull();
});
test("undo restores a cross-column move", () => {
  const before = structuredClone(useEditorStore.getState().doc.sections);
  useEditorStore.getState().moveBlock("b-1", { columnId: "s-1-c1" });
  useEditorStore.getState().undo();
  expect(useEditorStore.getState().doc.sections).toEqual(before);
});
test("selecting a block and selecting a section exclude each other", () => {
  const s = useEditorStore.getState();
  s.select("b-1");
  s.selectSection("s-1");
  expect(useEditorStore.getState().selection).toBeNull();
  s.select("b-2");
  expect(useEditorStore.getState().selectedSectionId).toBeNull();
});
test("removing a section clears a selected block inside it", () => {
  useEditorStore.getState().select("b-2");
  useEditorStore.getState().removeSection("s-1");
  expect(useEditorStore.getState().selection).toBeNull();
});

// autosave-signature.test.ts (add)
test("a section layout change is a new signature; a status change is not", () => {
  const a = doc(section("s-1", "1", [["b-1"]]));
  const b = structuredClone(a); b.sections[0].layout.background = "dark";
  const c = structuredClone(a); c.meta.status = "published";
  expect(autosaveSignature(b)).not.toBe(autosaveSignature(a));
  expect(autosaveSignature(c)).toBe(autosaveSignature(a));
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/editor && bun test src/editor/store-tree.test.ts src/components/editor-shell/autosave-signature.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the store, hooks and signature changes**

- [ ] **Step 4: Run the editor/ and editor-shell tests**

Run: `cd packages/editor && bun test src/editor src/components/editor-shell/autosave-signature.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/editor packages/editor/src/components/editor-shell/autosave-signature*
git commit -m "feat(editor): store selects and edits sections, with undo across columns"
```

---

### Task 5: SectionView and responsive section CSS

**Files:**
- Create: `packages/editor/src/sections/section-view.tsx`
- Create: `packages/editor/src/theme/sections.css`; Modify: `packages/editor/src/theme/styles.css` (import it after `blocks.css`)
- Modify: `packages/editor/src/theme/blocks.css:14-18` (the page container becomes `container: pg-page / inline-size`)
- Modify: `packages/editor/src/blocks/block-view.tsx`
- Modify: `packages/editor/src/editor/sections.ts` (add `legacyBackground`)
- Modify: `packages/editor/src/render/index.ts`, `packages/editor/src/index.ts` (exports)
- Test: `packages/editor/src/sections/section-view.test.tsx` (create), `packages/editor/src/theme/sections-css.test.ts` (create), `packages/editor/src/blocks/block-view.test.tsx` (rewrite the "Design panel" suite)

**Interfaces:**
- Consumes: Task 2 types.
- Produces:
  - `SectionView({ section, renderBlock, renderColumnEnd?, edit? }: { edit?: boolean; renderBlock: (block: Block) => ReactNode; renderColumnEnd?: (column: Column, columnIndex: number) => ReactNode; section: Section })`. It renders `<section class="pg-sec" id={anchor} data-columns data-background data-spacing data-align data-tablet [data-phone-reverse] [data-hide-phone]>`, containing `<div class="pg-sec__grid">`, with one `<div class="pg-col" data-col={i}>` per column. Each block sits in `<div class="pg-col__item" [data-hide-phone]>`. When `edit` is false and every column is empty, it renders `null`.
  - `legacyBackground(bg: SectionBackground): ResolvedBackground` (`white→"default"`, `tinted→"muted"`, `dark→"inverted"`). It is interim until stage 2.
  - `BlockView` keeps its props. Its frame now always uses `data-spacing="compact"` and `data-width="full"`, and ignores `block.layout` (the section owns spacing and width). It still paints `SURFACE[background]`.
  - Exports from `@repo/editor/render` and `@repo/editor`: `SectionView`, `legacyBackground`, `walkBlocks`, and the types `Section`, `Column`, `SectionLayout`, `SectionColumns`, `InsertTarget`.
- CSS contract (`sections.css`):
  - `.pg-sec` paints its background (`white` → `var(--paper)`, `tinted` → `var(--paper-2)`, `dark` → `var(--inverted)` with `--inverted-foreground` text; legacy tokens until stage 2).
  - Vertical padding: `tight` 2rem, `normal` `clamp(3rem, 6cqi, 5rem)`, `roomy` `clamp(4rem, 9cqi, 8rem)`. `cqi` is relative to the page container, so the preview matches.
  - Inline padding: `clamp(1rem, 4cqi, 2rem)`.
  - `.pg-sec__grid` is centred with `max-width: 1200px`, gap `clamp(1.5rem, 3cqi, 3rem)`, and `align-items` from `data-align`. Templates: `1` = `1fr`, `1-1` = `1fr 1fr`, `2-1` = `2fr 1fr`, `1-2` = `1fr 2fr`, `1-1-1` = `repeat(3, 1fr)`, `1-1-1-1` = `repeat(4, 1fr)`.
  - `.pg-col` has `container: pg / inline-size; min-width: 0`. Blocks' existing `@container pg` rules then respond to the column width.
  - `@container pg-page (max-width: 1023px)`: `[data-tablet="stack"]` becomes one column; `1-1-1-1` with `row` becomes `1fr 1fr`.
  - `@container pg-page (max-width: 639px)`: one column; `[data-phone-reverse]` reverses the order (`display: flex; flex-direction: column-reverse`); `[data-hide-phone]` gets `display: none`. Exception: under `.pe-frame[data-editing]` it shows at `opacity: .45`.

- [ ] **Step 1: Write the failing tests**

```tsx
// section-view.test.tsx
const s = section("s-1", "1-1", [["b-1"], ["b-2"]]);
const html = (sec: Section, edit = false) =>
  renderToStaticMarkup(<SectionView edit={edit} renderBlock={(b) => <p>{b.id}</p>} section={sec} />);

test("a two-column section exposes its layout as data attributes", () => {
  const out = html(s);
  expect(out).toContain('class="pg-sec"');
  expect(out).toContain('data-columns="1-1"');
  expect(out).toContain('data-tablet="row"');
  expect(out.match(/class="pg-col"/g)).toHaveLength(2);
});
test("phone options and the anchor reach the markup", () => {
  const out = html({ ...s, anchor: "aftermovie", layout: { ...s.layout, phoneReverse: true, hideOnPhone: true } });
  expect(out).toContain('id="aftermovie"');
  expect(out).toContain("data-phone-reverse");
  expect(out).toContain("data-hide-phone");
});
test("a block hidden on phones is marked", () => {
  const sec = structuredClone(s); sec.columns[0].blocks[0].hideOnPhone = true;
  expect(html(sec)).toContain('<div class="pg-col__item" data-hide-phone=""><p>b-1</p>');
});
test("renders nothing for an empty section outside the editor", () => {
  const empty = section("s-2", "1-1", [[], []]);
  expect(html(empty)).toBe("");
  expect(html(empty, true)).toContain('class="pg-sec"');
});

// sections-css.test.ts (read the files with Bun.file(...).text())
test("columns are the block container and the page is pg-page", () => {
  expect(sectionsCss).toMatch(/\.pg-col\s*{[^}]*container:\s*pg\s*\/\s*inline-size/);
  expect(blocksCss).toMatch(/container:\s*pg-page\s*\/\s*inline-size/);
});
test("phones stack and tablets can", () => {
  expect(sectionsCss).toContain("@container pg-page (max-width: 639px)");
  expect(sectionsCss).toContain("@container pg-page (max-width: 1023px)");
  expect(sectionsCss).toContain('[data-tablet="stack"]');
});
```

Rewrite `block-view.test.tsx`'s suite: every registered block, rendered through `BlockView` with background `"inverted"`, contains `data-spacing="compact"` and `data-width="full"` (or, for `appliesLayout` blocks, the `SURFACE.inverted` classes). Keep the "unknown types render nothing" and "cta is not double-framed" cases.

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/editor && bun test src/sections src/theme/sections-css.test.ts src/blocks/block-view.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement SectionView, sections.css, the blocks.css container rename, BlockView and exports**

- [ ] **Step 4: Run the whole editor suite**

Run: `cd packages/editor && bun test ./src`
Expected: PASS. `theme/brand-surface.test.ts`, "nothing reaches the host page", must still pass. Any other failure here must come from consumers that Tasks 6–9 update, not from these files.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src
git commit -m "feat(editor): render sections as responsive column grids"
```

---

### Task 6: Feeds, AI context, copilot inserts and unit templates

**Files:**
- Modify: `packages/editor/src/editor/page-feeds.ts` (iterate `walkBlocks(doc)`)
- Modify: `packages/editor/src/editor/serialize.ts` (`serializePageForAI`)
- Modify: `packages/editor/src/components/editor-shell/copilot/chat-panel.tsx` (`insert_block`)
- Modify: `packages/editor/src/editor/templates.ts` (return `Section[]`)
- Modify: `packages/editor/src/ai/prompt.ts` only if it describes the page as a flat list
- Test: `packages/editor/src/editor/page-feeds.test.ts`, `packages/editor/src/editor/serialize.test.ts`, `packages/editor/src/editor/templates.test.ts`, `packages/editor/src/ai/prompt.test.ts` (fixture updates)

**Interfaces:**
- Consumes: `walkBlocks`, `findBlock`, `targetAfterBlock`, `sectionOf`.
- Produces:
  - `unitPageTemplate(input): Section[]`, one single-column section per template block, in today's order.
  - `serializePageForAI(doc, selection)`. The header gains `sections: N`. The body lists `Section i [id] columns=… background=…`, then `  Column j [id]`, then `    k. <blockSummary>` (with ` ← SELECTED` as today). The selected block's full JSON is appended as today.
  - The copilot's `insert_block` keeps its args `{ type, afterId? }`. With `afterId` it calls `store.insertBlock(type, targetAfterBlock(doc, afterId) ?? undefined)`. Stage 5 extends the tools.

- [ ] **Step 1: Write the failing tests**

```ts
test("feeds are collected from blocks inside columns", () => {
  const events = block("b-9", "events");
  const d = doc(section("s-1", "1", [["b-1"]]), { ...section("s-2", "1-1", [["b-2"], []]), });
  d.sections[1].columns[1].blocks.push(events);
  d.meta.department = "dept-1";
  expect(collectPageFeedRequests(d, "no").map((r) => r.key)).toContain("events|dept-1|no");
});
test("the AI sees the section and column structure", () => {
  const out = serializePageForAI(doc(section("s-1", "1-1", [["b-1"], ["b-2"]])), "b-2");
  expect(out).toContain("Section 1 [s-1] columns=1-1 background=white");
  expect(out).toContain("  Column 2 [s-1-c1]");
  expect(out).toMatch(/\[b-2\] type=text.*← SELECTED/);
});
test("a project unit template is one section per block, in the same order", () => {
  const sections = unitPageTemplate({ campusLabel: "Oslo", kind: "project", locale: "no", name: "Fadderullan" });
  expect(sections.every((s) => s.columns.length === 1 && s.columns[0].blocks.length === 1)).toBe(true);
  expect(sections.map((s) => s.columns[0].blocks[0].type)).toEqual(["hero", "text", "events", "gallery", "text", "contact"]);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/editor && bun test src/editor src/ai`
Expected: FAIL in the three new cases

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run to see them pass**

Run: `cd packages/editor && bun test src/editor src/ai`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src
git commit -m "feat(editor): feeds, AI context and templates read the section tree"
```

---

### Task 7: Storage columns and the admin and web hosts

**Files:**
- Modify: `packages/api/page-builder.ts`. The local `PageDoc` becomes `{ meta: PageMeta; sections: unknown[]; version: 2 }`. It reads and writes `draft_doc` / `published_doc` instead of `draft_document` / `puck_document` (lines ~179, 184, 302, 342–345, 478, 544, 601).
- Modify: `packages/api/page-builder.test.ts`
- Modify: `apps/admin/src/lib/page-document-translation.ts`. Walk `document.sections` with path `"sections"`. Remove `"columns"` from `SKIP_FIELDS` (it is a number on legacy blocks and an array of columns now).
- Modify: `apps/admin/src/lib/page-document-translation.test.ts`
- Modify: `apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx`. Empty docs are `{ version: 2, meta, sections: [] }`. The "has content" check at line ~249 becomes `sections.length > 0`.
- Modify: `apps/admin/src/app/(portal)/_actions/departments.ts:735-750`. `createUnitPage` builds `{ version: 2, meta, sections: unitPageTemplate(...) }`. Also update the stale column comment at ~621.
- Modify: `apps/admin/src/app/(portal)/_actions/departments.test.ts:250-300`
- Modify: `apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx`. Map `doc.sections` to `SectionView`, whose `renderBlock` renders `BlockView` with `legacyBackground(section.layout.background)`. Drop `resolveBackgrounds`.
- Modify: `apps/web/src/app/(public)/[...slug]/_components/rendered-page.test.tsx`, `apps/web/src/lib/data/page-feeds.test.ts`
- Modify: the comment at `apps/web/src/app/(public)/units/[...segments]/page.tsx:49`

**Interfaces:**
- Consumes: Task 1's regenerated `PageTranslations` (`draft_doc`, `published_doc`); `SectionView`, `legacyBackground` and `walkBlocks` from `@repo/editor/render`; `unitPageTemplate` returning `Section[]`.
- Produces:
  - `getPage` returns `published_doc ?? draft_doc` parsed, as today.
  - `savePageDraft` and `savePageTranslationDraft` write `draft_doc`.
  - `publishPage` copies `draft_doc` to `published_doc`.

- [ ] **Step 1: Write the failing tests**

```ts
// page-builder.test.ts: adapt the existing fixtures (draft_doc instead of draft_document), then add
test("publishing copies the draft document into published_doc", async () => {
  // existing publishPage harness; assert the updateRow payload
  expect(updateRow).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ published_doc: draftJson }) }));
});

// page-document-translation.test.ts
test("translates text inside a column", async () => {
  const document = { version: 2, meta: { title: "Om oss", slug: "x", department: "", status: "draft", accentColor: "#3DA9E0" },
    sections: [{ id: "s-1", layout: {}, columns: [{ id: "c-1", blocks: [] }, { id: "c-2", blocks: [{ id: "b-1", type: "quote", text: "Hei alle sammen", author: "", role: "" }] }] }] };
  const translated = await translatePageDocument(document, /* existing fake translator */);
  expect(translated.sections[0].columns[1].blocks[0].text).toBe("<translated>Hei alle sammen");
});

// departments.test.ts: the createUnitPage expectations become
expect(call.doc.version).toBe(2);
expect(call.doc.sections.map((s) => s.columns[0].blocks[0].type)).toEqual([...same lists as today]);

// rendered-page.test.tsx
test("renders a two-column section", () => { /* doc with section("s-1","1-1",[["b-1"],["b-2"]]) using quote blocks */ 
  expect(html.match(/class="pg-col"/g)).toHaveLength(2); expect(html).toContain("first quote"); });
test("renders an old-format document as an empty page", () => {
  const html = renderToStaticMarkup(<RenderedPage doc={{ meta, blocks: [] } as unknown as PageDoc} locale="no" />);
  expect(html).toContain("pg-page"); expect(html).not.toContain("pg-sec");
});
```

Match the existing helper and translator names in each test file. The snippets show the assertions, not the harness.

- [ ] **Step 2: Run to see them fail**

`packages/api` and `apps/web` use **vitest**; `apps/admin` and `packages/editor` use **bun test**. Run each in its own runner:

```bash
(cd packages/api && bunx vitest run page-builder.test.ts)
(cd apps/admin && bun test src/lib/page-document-translation.test.ts "src/app/(portal)/_actions/departments.test.ts")
(cd apps/web && bunx vitest run "src/app/(public)/[...slug]/_components/rendered-page.test.tsx" src/lib/data/page-feeds.test.ts)
```

Expected: FAIL

- [ ] **Step 3: Implement the changes listed under Files**

- [ ] **Step 4: Run the tests, type-check and build admin**

Run: the Step 2 commands, then `bun run check-types --filter=@repo/api --filter=@repo/editor --filter=admin --filter=web`, then `bun run build --filter=admin`
Expected: tests PASS; check-types exits 0; the admin build prints `✓ Compiled`. The canvas and inspector still use the flat API until Tasks 8–9. If check-types fails only in `packages/editor/src/components/editor-shell/{canvas,inspector,palette,index.tsx}`, note the errors and continue; Tasks 8–9 remove them.

- [ ] **Step 5: Commit**

```bash
git add packages/api apps/admin apps/web
git commit -m "feat: store and render sectioned page documents"
```

---

### Task 8: Canvas with sections, columns and drag-and-drop

**Files:**
- Create: `packages/editor/src/components/editor-shell/canvas/drop.ts`
- Create: `packages/editor/src/components/editor-shell/canvas/section-frame.tsx` (sortable section chrome around `SectionView`, per-column end drop zones, "+ Add block")
- Create: `packages/editor/src/components/editor-shell/canvas/add-section.tsx` (the six-layout picker used between sections, at the page end and in the empty state)
- Modify: `packages/editor/src/components/editor-shell/canvas/index.tsx`
- Modify: `packages/editor/src/components/editor-shell/index.tsx` (drag handlers, collision filter, drag overlay labels)
- Modify: `packages/editor/src/theme/editor.css` (`.pe-section*`, `.pe-col*`, `.pe-add-section*` in the existing chrome style: same outline colour, tag, handle and row-action treatments as `.pe-block`)
- Test: `packages/editor/src/components/editor-shell/canvas/drop.test.ts`

**Interfaces:**
- Consumes: store actions from Task 4; `SectionView` from Task 5.
- Produces (drop.ts):
  - `type DragSource = { source: "palette"; type: BlockType } | { source: "block"; blockId: string } | { source: "section"; sectionId: string }`
  - `type DropTarget = { kind: "block"; blockId: string } | { kind: "column"; columnId: string } | { kind: "section"; sectionId: string } | { kind: "new-section"; index: number }`
  - `type DropAction = { kind: "insert-block"; type: BlockType; target: InsertTarget } | { kind: "insert-block-new-section"; type: BlockType; index: number } | { kind: "move-block"; blockId: string; target: InsertTarget } | { kind: "move-block-new-section"; blockId: string; index: number } | { kind: "move-section"; sectionId: string; beforeSectionId?: string } | { kind: "none" }`
  - `resolveDrop(doc: PageDoc, source: DragSource, target: DropTarget | null): DropAction`. Rules:
    - A block or palette item dropped **on a block** goes before it.
    - Within the same column, moving **downward** goes after the over block (array-move semantics, matching the sortable animation).
    - **On a column** means the end of that column.
    - **On `new-section`** means a new section at that index.
    - A section **on a section** moves before it, or after it when moving downward.
    - A section on `new-section` moves before `sections[index]`, or to the end.
    - Anything else is `none`.
  - `acceptsDrop(source: DragSource["source"], target: DropTarget["kind"]): boolean`. Sections accept only `section` / `new-section`. Blocks and palette items accept only `block` / `column` / `new-section`.
  - `dropTargetOf(data: unknown): DropTarget | null` reads dnd-kit `over.data.current`.
- DnD ids: block sortables use the block id with `data { kind: "block", blockId }`. Column end zones use `col:<columnId>` with `{ kind: "column", columnId }`. Section sortables use `sec:<sectionId>` with `{ kind: "section", sectionId }`. New-section zones use `new-section:<index>` with `{ kind: "new-section", index }`.
- `EditorShell` uses a custom `collisionDetection` that filters `droppableContainers` with `acceptsDrop`, then applies `closestCenter`.
- In edit mode, the canvas frame gets `data-editing` (so phone-hidden content shows dimmed, per Task 5's CSS).

- [ ] **Step 1: Write the failing tests**

```ts
const d = doc(section("s-1", "1-1", [["b-1", "b-2"], ["b-3"]]), section("s-2", "1", [["b-4"]]));
const palette = { source: "palette", type: "stats" } as const;

test("palette onto a block inserts before it", () => {
  expect(resolveDrop(d, palette, { kind: "block", blockId: "b-3" }))
    .toEqual({ kind: "insert-block", type: "stats", target: { columnId: "s-1-c1", beforeBlockId: "b-3" } });
});
test("palette onto a column appends", () => {
  expect(resolveDrop(d, palette, { kind: "column", columnId: "s-2-c0" }))
    .toEqual({ kind: "insert-block", type: "stats", target: { columnId: "s-2-c0" } });
});
test("palette onto a new-section zone starts a section", () => {
  expect(resolveDrop(d, palette, { kind: "new-section", index: 1 })).toEqual({ kind: "insert-block-new-section", type: "stats", index: 1 });
});
test("moving down inside a column lands after the target", () => {
  expect(resolveDrop(d, { source: "block", blockId: "b-1" }, { kind: "block", blockId: "b-2" }))
    .toEqual({ kind: "move-block", blockId: "b-1", target: { columnId: "s-1-c0" } });
});
test("moving up inside a column lands before the target", () => {
  expect(resolveDrop(d, { source: "block", blockId: "b-2" }, { kind: "block", blockId: "b-1" }))
    .toEqual({ kind: "move-block", blockId: "b-2", target: { columnId: "s-1-c0", beforeBlockId: "b-1" } });
});
test("moving to another column lands before the target", () => {
  expect(resolveDrop(d, { source: "block", blockId: "b-1" }, { kind: "block", blockId: "b-4" }))
    .toEqual({ kind: "move-block", blockId: "b-1", target: { columnId: "s-2-c0", beforeBlockId: "b-4" } });
});
test("dropping a block on itself does nothing", () => {
  expect(resolveDrop(d, { source: "block", blockId: "b-1" }, { kind: "block", blockId: "b-1" })).toEqual({ kind: "none" });
});
test("sections reorder with array-move semantics", () => {
  expect(resolveDrop(d, { source: "section", sectionId: "s-1" }, { kind: "section", sectionId: "s-2" }))
    .toEqual({ kind: "move-section", sectionId: "s-1" });
  expect(resolveDrop(d, { source: "section", sectionId: "s-2" }, { kind: "section", sectionId: "s-1" }))
    .toEqual({ kind: "move-section", sectionId: "s-2", beforeSectionId: "s-1" });
});
test("sections and blocks only see their own drop zones", () => {
  expect(acceptsDrop("section", "column")).toBe(false);
  expect(acceptsDrop("block", "section")).toBe(false);
  expect(acceptsDrop("palette", "new-section")).toBe(true);
});
test("no target, no action", () => {
  expect(resolveDrop(d, palette, null)).toEqual({ kind: "none" });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/editor && bun test src/components/editor-shell/canvas/drop.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement drop.ts, then the canvas, section frame, add-section picker and shell wiring**

Canvas behaviour to build:
- **Sections:** each section is wrapped in a sortable `.pe-section`. Hover outlines it. A click on the section chrome (its tag, or padding outside any block) calls `selectSection`. Selected shows a tag `Section · N columns`, a drag handle and duplicate/delete buttons.
- **Columns:** shown as dashed `.pe-col` outlines while the section is hovered or selected, or during a drag. Each column ends with its `col:` drop zone and a "+ Add block" button that calls `setInsertTarget({ columnId })` and highlights that column.
- **Blocks:** keep today's `SortableBlock`. Its zipper "+" between blocks inserts `text` at `targetAfterBlock`.
- **Adding sections:** a slim "+ Add section" control between sections and after the last one opens the `add-section` picker (calls `insertSection(columns, index)`). While dragging, those positions become `new-section:<index>` zones with the existing `DropLine`.
- **Empty page:** "Add your first section" with the picker.

- [ ] **Step 4: Run the tests and type-check the editor**

Run: `cd packages/editor && bun test ./src && bun run check-types`
Expected: PASS. Errors may remain only in `inspector/` and `palette/`, which Task 9 owns.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src
git commit -m "feat(editor): build pages from sections and columns on the canvas"
```

---

### Task 9: Inspector section settings, outline tree and palette target

**Files:**
- Create: `packages/editor/src/components/editor-shell/inspector/section-panel.tsx`
- Create: `packages/editor/src/components/editor-shell/inspector/block-visibility.tsx`
- Modify: `packages/editor/src/components/editor-shell/inspector/index.tsx`. Use `findBlock` for the selected block. Show `SectionPanel` when `selectedSectionId` is set. Below a block's inspector, show `BlockVisibility` and a "Section settings" link that selects the parent section. The outline becomes a tree.
- Modify: `packages/editor/src/components/editor-shell/palette/index.tsx`. While `insertTarget` is set, show "Adding to section N, column M · Cancel"; a click inserts there.
- Delete: `packages/editor/src/components/editor-shell/inspector/design-panel.tsx` and `design-panel.test.tsx`
- Test: `packages/editor/src/components/editor-shell/inspector/section-panel.test.tsx`, `block-visibility.test.tsx`

**Interfaces:**
- Consumes: store `setSectionLayout`, `setSectionAnchor`, `duplicateSection`, `removeSection`, `setProp`, `setInsertTarget`; `findSection`, `findBlock`, `COLUMN_COUNT`.
- Produces:
  - `SectionPanel({ onAnchor, onDelete, onDuplicate, onLayout, section }: { onAnchor: (anchor: string) => void; onDelete: () => void; onDuplicate: () => void; onLayout: (patch: Partial<SectionLayout>) => void; section: Section })`. It is built with `InspSection` / `InspRow` and the existing button-group styling. It contains:
    - **Columns:** six icon buttons, aria-labels "One column", "Two equal columns", "Wide left", "Wide right", "Three columns", "Four columns".
    - **Background:** White / Tinted / Dark.
    - **Spacing:** Tight / Normal / Roomy.
    - **Align columns:** Top / Middle / Bottom.
    - **Tablet:** "Side by side" / "Stacked".
    - **Phone:** the text "Always stacked." A checkbox labelled "Show column 2 first" when there are two columns, or "Reverse order on phone" when there are three or four; hidden for one column. A checkbox "Hide section on phone".
    - **Link name:** an input feeding `onAnchor`, with helper text "Buttons can link to #name".
    - **Actions:** Duplicate / Delete.
  - `BlockVisibility({ block, onPatch }: { block: Block; onPatch: PatchFn })` is a checkbox "Hide on phone" that patches `"hideOnPhone"`.

- [ ] **Step 1: Write the failing tests** (call the components as functions and walk the element tree, as `design-panel.test.tsx` did)

```tsx
test("choosing Tinted patches the background", () => {
  const patches: Partial<SectionLayout>[] = [];
  const tree = SectionPanel({ section: section("s-1", "1-1", [[], []]), onLayout: (p) => patches.push(p), onAnchor() {}, onDelete() {}, onDuplicate() {} });
  buttonLabelled(tree, "Tinted")?.props.onClick();
  expect(patches).toEqual([{ background: "tinted" }]);
});
test("two columns offer 'Show column 2 first'; one column offers no reversing", () => {
  expect(renderToStaticMarkup(<SectionPanel {...props(section("s", "1-1", [[], []]))} />)).toContain("Show column 2 first");
  const one = renderToStaticMarkup(<SectionPanel {...props(section("s", "1", [[]]))} />);
  expect(one).not.toContain("Show column 2 first");
  expect(one).not.toContain("Reverse order on phone");
});
test("four columns can switch to one", () => {
  const patches: Partial<SectionLayout>[] = [];
  const tree = SectionPanel({ ...props(section("s", "1-1-1-1", [[], [], [], []])), onLayout: (p) => patches.push(p) });
  buttonLabelled(tree, "One column")?.props.onClick();
  expect(patches).toEqual([{ columns: "1" }]);
});
test("Hide on phone patches the block", () => {
  const patches: [string, unknown][] = [];
  const tree = BlockVisibility({ block: block("b-1"), onPatch: (p, v) => patches.push([p, v]) });
  checkboxOf(tree)?.props.onChange({ target: { checked: true } });
  expect(patches).toEqual([["hideOnPhone", true]]);
});
```

(`buttonLabelled`, `checkboxOf` and `props` are small tree-walking helpers in the test file, in the style of `collectSelects` in the deleted `design-panel.test.tsx`.)

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/editor && bun test src/components/editor-shell/inspector`
Expected: FAIL

- [ ] **Step 3: Implement the panels, inspector wiring, outline tree and palette target**

- [ ] **Step 4: Run everything for the editor and type-check the repo**

Run: `cd packages/editor && bun test ./src && cd ../.. && bun run check-types`
Expected: all PASS, check-types exits 0

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src
git commit -m "feat(editor): section settings, outline tree and add-to-column from the palette"
```

---

### Task 10: Verification pass

**Files:** none new (fixes go to the task that owns the file).

- [ ] **Step 1: Full automated checks**

Run: `bun x ultracite fix && bun run check-types && bun run test --filter=@repo/editor --filter=@repo/api --filter=admin --filter=web && bun run build --filter=admin --filter=web`
Expected: all exit 0. Both builds compile. Fix any failure in its owning task's files and commit with that task's scope.

- [ ] **Step 2: Editor check in the browser (D13)**

Start `bun run dev --filter=admin`. Create a page named "TEST stage 1 – delete me" (a draft; never publish). Then:
- Add a two-column section with text left and stats right.
- Drag a block between the columns.
- Change the section to one column and back.
- Toggle Tablet: Stacked and Phone: Show column 2 first.
- Check the desktop, tablet and phone previews.
- Undo three times.
- Reload and confirm autosave kept the tree.

If you can't sign in locally, say so in the hand-over and skip this step; do not work around auth.

- [ ] **Step 3: Remove the test page**

Delete the test page's `pages` row and its `page_translations` rows with a short `bun` script using `createAdminClient()` from `@repo/api/server`. Record the deleted row ids for the hand-over. Do not commit the script.

- [ ] **Step 4: Hand-over note**

Add a short "Stage 1 done" entry to the spec's end (date, what works, test rows created/deleted, anything deferred). Commit:

```bash
git add docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md
git commit -m "docs: record stage 1 completion"
```
