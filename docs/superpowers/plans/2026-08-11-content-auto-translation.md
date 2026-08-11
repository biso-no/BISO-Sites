# Content Auto-Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent, bidirectional manual translation and non-blocking auto-translation to every structured bilingual publisher in the admin app.

**Architecture:** A server-only translation service owns the AI prompt and structured output. Each publishing action remains responsible for authorization and storage mapping, and uses stable Next.js `after()` to run enabled automatic translation after the source write returns. Shared pure locale helpers and UI controls keep labels and toggle semantics consistent across editors.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Bun test, Zod, AI SDK, OpenAI provider, Appwrite TablesDB, Ultracite/Biome, Turborepo.

## Global Constraints

- Support exactly `no` and `en`; the active editor locale is the source and the other locale is the destination.
- Manual translation is synchronous and reviewable; auto-translation is queued only after an explicit draft save, publish, or announcement send.
- Page-builder debounced autosave must never queue translation.
- Use stable `after()` from `next/server`; do not add a dependency or a durable queue.
- Use one `gpt-5-nano` structured-output request per translation operation.
- Preserve HTML structure, URLs, placeholders, identifiers, proper nouns, and empty optional values.
- Never overwrite a destination from a stale background source snapshot.
- Background failure must not fail or roll back the successful source save/publish.
- Preserve the user's unrelated untracked files.

---

### Task 1: Shared translation domain and queue

**Files:**
- Create: `apps/admin/src/lib/content-translation.ts`
- Create: `apps/admin/src/lib/content-translation.server.ts`
- Create: `apps/admin/src/lib/content-translation.test.ts`

**Interfaces:**
- Produces: `ContentLocale`, `AutoTranslationOptions`, `TranslationField`, `getTargetLocale`, `getTranslationActionLabel`, `getAutoTranslationDescription`, `isCurrentTranslationSource`, `translateContentFields`, and `scheduleContentTranslation`.

- [ ] **Step 1: Write failing pure-domain and scheduling tests**

```ts
test("maps each supported source locale to the other locale", () => {
  expect(getTargetLocale("no")).toBe("en");
  expect(getTargetLocale("en")).toBe("no");
});

test("names the destination language in manual and automatic copy", () => {
  expect(getTranslationActionLabel("no")).toBe("Generate English");
  expect(getTranslationActionLabel("en")).toBe("Generate Norwegian");
  expect(getAutoTranslationDescription("no", "save")).toBe(
    "Translate Norwegian to English after save"
  );
});

test("detects a stale source snapshot", () => {
  expect(isCurrentTranslationSource({ title: "A" }, { title: "B" })).toBeFalse();
  expect(isCurrentTranslationSource({ title: "A" }, { title: "A" })).toBeTrue();
});

test("does not defer disabled translation", () => {
  expect(scheduleContentTranslation({ enabled: false, task })).toBeFalse();
  expect(afterSpy).not.toHaveBeenCalled();
});

test("isolates deferred translation failures from the source operation", async () => {
  expect(scheduleContentTranslation({ enabled: true, task })).toBeTrue();
  await deferredCallback?.();
  expect(errorSpy).toHaveBeenCalledWith(
    "[content-translation] background task failed",
    expect.any(Error)
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bun test apps/admin/src/lib/content-translation.test.ts`

Expected: FAIL because the shared translation modules do not exist.

- [ ] **Step 3: Implement the pure contract and server service**

```ts
export type ContentLocale = "no" | "en";
export type AutoTranslationOptions = {
  enabled: boolean;
  sourceLocale: ContentLocale;
};
export type TranslationField = {
  format: "plain" | "html";
  key: string;
  value: string;
};

export const getTargetLocale = (source: ContentLocale): ContentLocale =>
  source === "no" ? "en" : "no";

export const isCurrentTranslationSource = (
  submitted: Record<string, string>,
  current: Record<string, string>
): boolean =>
  Object.entries(submitted).every(([key, value]) => current[key] === value);
```

`translateContentFields` must validate unique safe keys, omit empty values from the model schema, issue one `generateObject` request with `openai("gpt-5-nano")`, and merge empty fields back as empty strings. `scheduleContentTranslation` must call `after()` only when enabled and catch/log callback failures.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `bun test apps/admin/src/lib/content-translation.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 5: Refactor duplicated names/prompt fragments without changing behavior**

Run the same focused test after refactoring and keep it green.

---

### Task 2: Shared editor controls

**Files:**
- Create: `apps/admin/src/app/_components/content-translation-controls.tsx`
- Create: `apps/admin/src/app/_components/content-translation-controls.test.tsx`

**Interfaces:**
- Consumes: locale helpers from Task 1.
- Produces:

```ts
type AutoTranslateControlProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  operation: "save" | "publish" | "send";
  sourceLocale: ContentLocale;
};

type TranslationReviewCardProps = {
  disabled?: boolean;
  isTranslating: boolean;
  onTranslate: () => void;
  sourceLocale: ContentLocale;
};
```

- [ ] **Step 1: Write failing accessible component tests**

Render each control with a real `Switch`/`Button`; assert that the switch is named `Auto-translate`, its description names both languages, and the review button label changes with `sourceLocale`.

- [ ] **Step 2: Run the component test and verify RED**

Run: `bun test apps/admin/src/app/_components/content-translation-controls.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the controls with existing UI primitives**

Use `@repo/ui/components/ui/switch`, `@repo/ui/components/ui/button`, and semantic labels. Keep layout classes configurable through an optional `className`; do not encode a studio-specific color scheme.

- [ ] **Step 4: Run the component test and verify GREEN**

Run the same Bun test and confirm both locale directions pass.

---

### Task 3: Source-aware bilingual schemas

**Files:**
- Modify: `packages/shared/types/events.ts`
- Modify: `packages/shared/types/recruitment.ts`
- Modify: `packages/shared/recruitment.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts`
- Create: `apps/admin/src/app/(portal)/_actions/schemas.test.ts`

**Interfaces:**
- Produces form schemas that accept one complete locale for a draft/publish request while rejecting content with no usable locale.

- [ ] **Step 1: Add failing validation tests**

Cover Norwegian-only and English-only valid inputs for jobs, events, products, benefits, and announcements. Cover an all-empty invalid input for each schema. Retain existing per-feature non-language validation.

- [ ] **Step 2: Run the schema tests and verify RED**

Run: `bun test packages/shared/recruitment.test.ts 'apps/admin/src/app/(portal)/_actions/schemas.test.ts'`

Expected: source-only fixtures fail under the current both-languages-required schemas.

- [ ] **Step 3: Relax only locale-pair requirements**

Use Zod `superRefine` to require at least one complete source locale. Keep required dates, status, scope, price, and other domain rules unchanged. Do not add `AutoTranslationOptions` to persisted form values.

- [ ] **Step 4: Run schema tests and verify GREEN**

Run the same command and confirm old and new cases pass.

---

### Task 4: Jobs and events

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/jobs.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/events.ts`
- Modify: `apps/admin/src/app/(portal)/jobs/[id]/_components/job-studio-editor.tsx`
- Modify: `apps/admin/src/app/(portal)/events/[id]/_components/event-studio-editor.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/jobs-translation.test.ts`
- Create: `apps/admin/src/app/(portal)/_actions/events-translation.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces bidirectional `generateJobTranslationDraft` and `generateEventTranslationDraft`, plus create/update actions accepting optional `AutoTranslationOptions`.

- [ ] **Step 1: Add failing adapter tests**

Test both locale directions, mapping of every translated field, disabled scheduling, enabled scheduling after the primary write, destination-only Appwrite updates, and stale-source skips.

- [ ] **Step 2: Run the focused action tests and verify RED**

Run: `bun test 'apps/admin/src/app/(portal)/_actions/jobs-translation.test.ts' 'apps/admin/src/app/(portal)/_actions/events-translation.test.ts'`

- [ ] **Step 3: Replace fixed Norwegian generators with bidirectional adapters**

The manual actions accept `{ sourceLocale, title, shortDescription?, description }` and return the target-locale fields. The auto callbacks translate the submitted source snapshot, reload current source content, call `isCurrentTranslationSource`, then upsert only `getTargetLocale(sourceLocale)`.

- [ ] **Step 4: Move controls to publishing boundaries**

Remove the job Essentials translation card. Remove only event translation from Essentials while retaining social pre-fill. Put `AutoTranslateControl` beside the global Save/Publish actions and `TranslationReviewCard` in each Review step. Labels must be derived from the active locale. Pass `{ enabled: autoTranslate, sourceLocale: locale }` to create/update submissions.

- [ ] **Step 5: Run focused tests**

Run the two action tests plus `bun test packages/shared/recruitment.test.ts` and confirm green.

---

### Task 5: News and shop products

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/news.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/shop.ts`
- Modify: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-editor.tsx`
- Modify: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.ts`
- Modify: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts`
- Modify: `apps/admin/src/app/(portal)/shop/[id]/_components/shop-studio-editor.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/shop-translation.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces manual translation actions and auto-translation options on news/product create/update actions.

- [ ] **Step 1: Add failing mapping and scheduling tests**

For news, extend the existing tests/state tests to cover locale-aware field extraction and application. For products, cover canonical Norwegian fields versus English `content_translations`, both directions, stale-source skips, and enabled/disabled scheduling.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `bun test 'apps/admin/src/app/(portal)/_actions/news.test.ts' 'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts' 'apps/admin/src/app/(portal)/_actions/shop-translation.test.ts'`

- [ ] **Step 3: Implement action adapters**

Translate news headline, lead/body representation, SEO fields, caption, and alt text that exist in the form model. Translate product name and description. Preserve media and price/inventory values. Upsert/delete behavior for optional locales must remain unchanged when auto-translation is disabled.

- [ ] **Step 4: Add global and review controls**

Put the auto switch next to each global action bar and a manual card in Review. Manual success fills the destination values and changes the editor/preview locale to the destination.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 5 command and confirm zero failures.

---

### Task 6: Member benefits and announcements

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/benefits.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/announcements.ts`
- Modify: `apps/admin/src/app/(portal)/benefits/[id]/_components/benefit-editor-client.tsx`
- Modify: `apps/admin/src/app/(portal)/communications/_components/announcement-studio-editor.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/benefits-translation.test.ts`
- Create: `apps/admin/src/app/(portal)/_actions/announcements-translation.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces manual and automatic translation for direct bilingual columns; announcement send can queue translate-then-deliver.

- [ ] **Step 1: Add failing direct-column adapter tests**

Benefits must update only `title_<target>`, `description_<target>`, and teaser fields. Announcements must update only `title_<target>`/`body_<target>`. A send with auto-translation must schedule one callback in which destination persistence completes before dispatch begins.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `bun test 'apps/admin/src/app/(portal)/_actions/benefits-translation.test.ts' 'apps/admin/src/app/(portal)/_actions/announcements-translation.test.ts'`

- [ ] **Step 3: Implement adapters and queued send ordering**

Draft save/publish follows the standard queue. For announcement send with auto enabled, persist the source synchronously, then schedule one callback that translates, performs the stale-source check, updates the destination, and invokes the existing delivery logic. Return a queued result to the client.

- [ ] **Step 4: Add editor controls**

Benefits get the switch in `EditorHeader` actions and a translation card above final buttons. Announcements get the switch in `ActionBar` and a real Review translation card; remove the fixed `Generate Norwegian` control from the content step.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 6 command and confirm zero failures.

---

### Task 7: Page builder

**Files:**
- Modify: `apps/admin/src/app/api/translate-page/route.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/pages.ts`
- Modify: `apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx`
- Modify: `packages/editor/src/components/editor-shell/index.tsx`
- Modify: `packages/editor/src/components/editor-shell/topbar/index.tsx`
- Modify: `packages/editor/src/context/editor-callbacks.tsx`
- Create: `apps/admin/src/app/(portal)/_actions/pages-translation.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces a reusable page-document translator, `topbarActions?: ReactNode` in `EditorShell`, and `publishPageAction(pageId, locale, autoTranslation?)`.

- [ ] **Step 1: Add failing page scheduling tests**

Assert that ordinary `savePageEditorDoc` never schedules translation, disabled publish does not schedule, enabled publish schedules the active document as source, stale callbacks skip the target write, and a successful callback saves then publishes the destination locale.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bun test 'apps/admin/src/app/(portal)/_actions/pages-translation.test.ts'`

- [ ] **Step 3: Extract page translation onto the shared service**

Keep `/api/translate-page` as the manual client endpoint, but replace its direct model call with the shared translator. Preserve document path application and confirmation behavior.

- [ ] **Step 4: Add the page topbar switch and publish option**

Pass an app-owned `AutoTranslateControl` into `EditorShell` through `topbarActions`. `Topbar` renders the slot before Publish. `handleSave` keeps its exact existing signature and never receives the toggle. `handlePublish` passes `{ enabled: autoTranslate, sourceLocale: locale }`.

- [ ] **Step 5: Run focused tests and package type checking**

Run: `bun test 'apps/admin/src/app/(portal)/_actions/pages-translation.test.ts' && bun x turbo run check-types --filter=@repo/editor --filter=admin`

Expected: tests and both type checks pass.

---

### Task 8: Cross-feature verification and cleanup

**Files:**
- Modify only files already touched in Tasks 1–7 when verification finds an issue.

**Interfaces:**
- Produces verified behavior and a reviewable diff with no unrelated changes.

- [ ] **Step 1: Run all focused translation and schema tests**

Run all tests created or modified by this plan in one Bun invocation and confirm zero failures.

- [ ] **Step 2: Run the admin test suite**

Run: `bun x turbo run test --filter=admin`

- [ ] **Step 3: Run static verification**

Run: `bun x turbo run check-types lint --filter=admin --filter=@repo/editor --filter=@repo/shared`

- [ ] **Step 4: Run production builds**

Run: `bun x turbo run build --filter=admin`

- [ ] **Step 5: Run Ultracite and inspect the final diff**

Run: `bun x ultracite check apps/admin packages/editor packages/shared` if the CLI accepts scoped paths; otherwise run the repository-standard `bun x ultracite check`. Then inspect `git diff --check`, `git status --short`, and `git diff --stat` to confirm that the unrelated untracked files remain untouched.

- [ ] **Step 6: Perform final code review**

Review authorization boundaries, publish/send ordering, destination-only writes, stale-source guards, accessibility, responsive action layout, and truthful queued-success messages. Fix any load-bearing finding, then repeat its focused verification.
