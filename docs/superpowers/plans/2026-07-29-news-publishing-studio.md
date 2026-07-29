# News Publishing Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin news editor with a guided, bilingual publishing studio that previews the public article and correctly saves drafts or publishes.

**Architecture:** Keep the existing Next.js Server Component page as the authorization and data-loading boundary, replace the client editor with a news-specific studio, and extend the existing news schema/actions to accept both locales in one request. Put translation/default-state logic in a pure helper so it can be tested without a browser, while keeping Appwrite permissions, audit logging, and revalidation in the server action.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Bun test, Zod, Appwrite TablesDB, Tailwind CSS, Ultracite/Biome

## Global Constraints

- Preserve existing news rows, `content_translations`, authorization, audit logging, and public rendering.
- Support existing articles with only one translation without creating invented content.
- Create or update only non-empty locale payloads; never delete another locale while saving.
- Require at least one localized headline.
- Add no dependency, database collection, scheduling feature, SEO model, or AI-generated content.
- Keep the existing `packages/api/appwrite.config.json` worktree modification untouched.
- Read the bundled Next.js App Router forms, Server Actions, Server/Client Components, and `revalidatePath` docs before editing Next.js code.
- Use `apply_patch` for source edits and follow the repository Lore commit protocol.

---

## File Structure

- `apps/admin/src/app/(portal)/_actions/schemas.ts`
  - Defines the bilingual `newsSchema` and inferred `NewsFormValues`.
- `apps/admin/src/app/(portal)/_actions/news.ts`
  - Validates and persists the news row and both translation rows.
- `apps/admin/src/app/(portal)/_actions/news.test.ts`
  - Covers draft/publish semantics and translation upserts against mocked Appwrite calls.
- `apps/admin/src/app/(portal)/_actions/content-scoping.test.ts`
  - Keeps the existing cross-campus authorization regression aligned with the new payload.
- `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.ts`
  - Converts legacy articles into editable state and derives non-empty translation inputs.
- `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts`
  - Covers locale mapping, missing-language behavior, and translation payload derivation.
- `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-preview.tsx`
  - Renders the reader-facing preview for the active language.
- `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-editor.tsx`
  - Owns studio state, guided steps, controls, validation, and submission.
- `apps/admin/src/app/(portal)/news/[id]/_components/news-editor-client.tsx`
  - Removed after its route imports the new studio.
- `apps/admin/src/app/(portal)/news/[id]/page.tsx`
  - Loads scoped campuses/departments and renders `NewsStudioEditor`.

---

### Task 1: Bilingual News Contract and Pure Studio State

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts:42-59`
- Create: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.ts`
- Create: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts`

**Interfaces:**
- Produces: `NewsFormValues` with `title_no`, `description_no`, `title_en`, and `description_en`.
- Produces: `NewsWithTranslations`.
- Produces: `createNewsStudioDefaults(article, campuses, defaultCampusId): NewsFormValues`.
- Produces: `getNewsTranslationInputs(values): NewsTranslationInput[]`.
- Consumes: Appwrite `Campus`, `ContentTranslations`, and `News` types.

- [ ] **Step 1: Write failing schema and state tests**

```ts
import { describe, expect, test } from "bun:test";
import { newsSchema } from "../../../_actions/schemas";
import {
  createNewsStudioDefaults,
  getNewsTranslationInputs,
} from "./news-studio-state";

describe("news studio state", () => {
  test("maps translations by locale rather than row order", () => {
    const article = {
      $id: "news-1",
      author: "BISO",
      campus_id: "campus-oslo",
      department_id: null,
      image: null,
      slug: "student-news",
      status: "draft",
      sticky: false,
      translation_refs: [
        {
          additional_fields: JSON.stringify({ category: "general" }),
          description: "English body",
          locale: "en",
          title: "English title",
        },
        {
          additional_fields: JSON.stringify({ category: "general" }),
          description: "Norsk brødtekst",
          locale: "no",
          title: "Norsk tittel",
        },
      ],
    };

    const values = createNewsStudioDefaults(
      article as never,
      [{ $id: "campus-oslo", name: "Oslo" }] as never,
      "campus-oslo"
    );

    expect(values.title_no).toBe("Norsk tittel");
    expect(values.title_en).toBe("English title");
    expect(values.description_no).toBe("Norsk brødtekst");
    expect(values.description_en).toBe("English body");
  });

  test("keeps a missing locale empty for a legacy article", () => {
    const values = createNewsStudioDefaults(
      {
        campus_id: "campus-oslo",
        translation_refs: [{ locale: "no", title: "Bare norsk" }],
      } as never,
      [] as never,
      "campus-oslo"
    );

    expect(values.title_no).toBe("Bare norsk");
    expect(values.title_en).toBe("");
    expect(getNewsTranslationInputs(values)).toEqual([
      {
        description: "",
        locale: "no",
        title: "Bare norsk",
      },
    ]);
  });

  test("requires a headline in at least one locale", () => {
    const result = newsSchema.safeParse({
      author: null,
      campus_id: "campus-oslo",
      category: null,
      department_id: null,
      description_en: "",
      description_no: "",
      image: "",
      slug: "student-news",
      status: "draft",
      sticky: false,
      title_en: "",
      title_no: "",
    });

    expect(result.success).toBeFalse();
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bun test 'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts'
```

Expected: FAIL because `news-studio-state.ts` does not exist and `newsSchema`
still expects the legacy `title`, `description`, and `locale` fields.

- [ ] **Step 3: Replace the legacy news schema with the bilingual contract**

```ts
export const newsSchema = z
  .object({
    title_no: z.string(),
    description_no: z.string().optional().nullable(),
    title_en: z.string(),
    description_en: z.string().optional().nullable(),
    campus_id: z.string().min(1, "Campus is required"),
    department_id: z.string().optional().nullable(),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must be lowercase alphanumeric with hyphens"
      ),
    status: z.enum(["draft", "published"]),
    author: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    image: z.string().url().optional().nullable().or(z.literal("")),
    sticky: z.boolean().default(false),
  })
  .superRefine((values, context) => {
    if (!(values.title_no.trim() || values.title_en.trim())) {
      context.addIssue({
        code: "custom",
        message: "A Norwegian or English headline is required",
        path: ["title_no"],
      });
    }
  });
```

- [ ] **Step 4: Implement deterministic default-state and translation helpers**

```ts
import type {
  Campus,
  ContentTranslations,
  News,
} from "@repo/api/types/appwrite";
import type { NewsFormValues } from "../../../_actions/schemas";

export type NewsLocale = "no" | "en";
export type NewsWithTranslations = News & {
  translation_refs: ContentTranslations[];
};

export interface NewsTranslationInput {
  description: string;
  locale: NewsLocale;
  title: string;
}

const parseCategory = (
  translation: ContentTranslations | undefined
): string | null => {
  if (!translation?.additional_fields) {
    return null;
  }
  try {
    const fields = JSON.parse(translation.additional_fields) as {
      category?: unknown;
    };
    return typeof fields.category === "string" ? fields.category : null;
  } catch {
    return null;
  }
};

export const createNewsStudioDefaults = (
  article: NewsWithTranslations | null,
  campuses: Campus[],
  defaultCampusId?: string
): NewsFormValues => {
  const norwegian = article?.translation_refs.find(
    (translation) => translation.locale === "no"
  );
  const english = article?.translation_refs.find(
    (translation) => translation.locale === "en"
  );
  const primary = norwegian ?? english;

  return {
    author: article?.author ?? null,
    campus_id:
      article?.campus_id ?? defaultCampusId ?? campuses[0]?.$id ?? "",
    category: parseCategory(primary),
    department_id: article?.department_id ?? null,
    description_en: english?.description ?? "",
    description_no: norwegian?.description ?? "",
    image: article?.image ?? "",
    slug: article?.slug ?? "",
    status: article?.status === "published" ? "published" : "draft",
    sticky: article?.sticky ?? false,
    title_en: english?.title ?? "",
    title_no: norwegian?.title ?? "",
  };
};

export const getNewsTranslationInputs = (
  values: NewsFormValues
): NewsTranslationInput[] => {
  const translations: NewsTranslationInput[] = [
    {
      description: values.description_no?.trim() ?? "",
      locale: "no",
      title: values.title_no.trim(),
    },
    {
      description: values.description_en?.trim() ?? "",
      locale: "en",
      title: values.title_en.trim(),
    },
  ];

  return translations.filter(
    (translation) => translation.title || translation.description
  );
};
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
bun test 'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit the contract**

```bash
git add 'apps/admin/src/app/(portal)/_actions/schemas.ts' \
  'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.ts' \
  'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts'
git commit -m "Make news editing bilingual by contract" \
  -m "Confidence: high
Scope-risk: narrow
Tested: Bun news studio state tests"
```

---

### Task 2: Persist Both Locales and Honor Publish on Create

**Files:**
- Create: `apps/admin/src/app/(portal)/_actions/news.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/news.ts:107-337`
- Modify: `apps/admin/src/app/(portal)/_actions/content-scoping.test.ts:100-122`

**Interfaces:**
- Consumes: the Task 1 `NewsFormValues` contract.
- Consumes: `getNewsTranslationInputs(values)`.
- Produces: unchanged public action signatures:
  - `createNews(values: NewsFormValues): Promise<{ data: string } | { error: unknown }>`
  - `updateNews(id: string, values: NewsFormValues): Promise<{ data: string } | { error: unknown }>`

- [ ] **Step 1: Write failing action tests**

Create a Bun test module that mocks `@repo/api/server`,
`@/lib/authorization`, `@/lib/recruitment`, `next/cache`, and `./audit-log`.
Use this valid payload in each test:

```ts
const publishedValues: NewsFormValues = {
  author: "BISO",
  campus_id: "campus-oslo",
  category: "announcement",
  department_id: null,
  description_en: "English body",
  description_no: "Norsk brødtekst",
  image: "",
  slug: "student-news",
  status: "published",
  sticky: true,
  title_en: "English title",
  title_no: "Norsk tittel",
};
```

Cover these assertions:

```ts
test("creates a published row and both translations", async () => {
  const result = await createNews(publishedValues);

  expect(result).toEqual({ data: "news-1" });
  expect(db.createRow).toHaveBeenCalledWith(
    "app",
    "news",
    "unique()",
    expect.objectContaining({ status: "published" }),
    expect.any(Array)
  );
  expect(db.createRow).toHaveBeenCalledWith(
    "app",
    "content_translations",
    "unique()",
    expect.objectContaining({ locale: "no", title: "Norsk tittel" }),
    expect.any(Array)
  );
  expect(db.createRow).toHaveBeenCalledWith(
    "app",
    "content_translations",
    "unique()",
    expect.objectContaining({ locale: "en", title: "English title" }),
    expect.any(Array)
  );
});

test("does not create an empty optional locale", async () => {
  await createNews({
    ...publishedValues,
    description_en: "",
    status: "draft",
    title_en: "",
  });

  const translationCalls = db.createRow.mock.calls.filter(
    (call) => call[1] === "content_translations"
  );
  expect(translationCalls).toHaveLength(1);
  expect(translationCalls[0]?.[3]).toEqual(
    expect.objectContaining({ locale: "no" })
  );
});

test("upserts new locale and preserves an omitted existing locale", async () => {
  mockExistingArticleAndTranslations({
    translations: [
      {
        $id: "translation-en",
        content_id: "news-1",
        locale: "en",
        title: "Existing English",
      },
    ],
  });

  await updateNews("news-1", {
    ...publishedValues,
    description_en: "",
    title_en: "",
  });

  expect(db.createRow).toHaveBeenCalledWith(
    "app",
    "content_translations",
    "unique()",
    expect.objectContaining({ locale: "no" }),
    expect.any(Array)
  );
  expect(db.updateRow).toHaveBeenCalledWith(
    "app",
    "content_translations",
    "translation-en",
    {},
    expect.any(Array)
  );
});
```

- [ ] **Step 2: Run action tests and verify RED**

Run:

```bash
bun test 'apps/admin/src/app/(portal)/_actions/news.test.ts'
```

Expected: FAIL because the action expects one `locale` and always creates new
articles with `status: "draft"`.

- [ ] **Step 3: Implement publish authorization and translation persistence**

For `createNews`:

```ts
const status = validated.data.status;
if (status === "published") {
  assertPublishAccess(ctx, validated.data.campus_id);
}

const translations = getNewsTranslationInputs(validated.data);
await Promise.all(
  translations.map((translation) =>
    db.createRow(
      "app",
      "content_translations",
      "unique()",
      {
        additional_fields: JSON.stringify({
          author: validated.data.author,
          category: validated.data.category,
        }),
        content_id: article.$id,
        content_type: "news",
        description: translation.description,
        locale: translation.locale,
        title: translation.title,
      },
      translationPermissions
    )
  )
);
```

For `updateNews`, fetch all current translation rows once, index them by
locale, upsert every value returned by `getNewsTranslationInputs`, and
re-stamp permissions with an empty data update for existing locales omitted
from the payload:

```ts
const currentTranslations = await db.listRows<ContentTranslations>(
  "app",
  "content_translations",
  [
    Query.equal("content_type", "news"),
    Query.equal("content_id", id),
    Query.limit(10),
  ]
);
const currentByLocale = new Map(
  currentTranslations.rows.map((translation) => [
    translation.locale,
    translation,
  ])
);
const submittedTranslations = getNewsTranslationInputs(validated.data);
const submittedLocales = new Set(
  submittedTranslations.map((translation) => translation.locale)
);

await Promise.all(
  submittedTranslations.map((translation) => {
    const existingTranslation = currentByLocale.get(translation.locale);
    const data = {
      additional_fields: JSON.stringify({
        author: validated.data.author,
        category: validated.data.category,
      }),
      content_id: id,
      content_type: "news",
      description: translation.description,
      locale: translation.locale,
      title: translation.title,
    };
    return existingTranslation
      ? db.updateRow(
          "app",
          "content_translations",
          existingTranslation.$id,
          data,
          translationPermissions
        )
      : db.createRow(
          "app",
          "content_translations",
          "unique()",
          data,
          translationPermissions
        );
  })
);

await Promise.all(
  currentTranslations.rows
    .filter((translation) => !submittedLocales.has(translation.locale))
    .map((translation) =>
      db.updateRow(
        "app",
        "content_translations",
        translation.$id,
        {},
        translationPermissions
      )
    )
);
```

- [ ] **Step 4: Update the existing content-scope regression payload**

Replace `title`, `description`, and `locale` in the news case with:

```ts
description_en: "",
description_no: "Body",
title_en: "",
title_no: "Campus news",
```

- [ ] **Step 5: Run focused action tests and verify GREEN**

Run:

```bash
bun test \
  'apps/admin/src/app/(portal)/_actions/news.test.ts' \
  'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit persistence behavior**

```bash
git add 'apps/admin/src/app/(portal)/_actions/news.ts' \
  'apps/admin/src/app/(portal)/_actions/news.test.ts' \
  'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts'
git commit -m "Keep news translations together through publishing" \
  -m "Constraint: Existing single-language translations must remain intact
Confidence: high
Scope-risk: moderate
Tested: Bun news action and content-scoping tests"
```

---

### Task 3: Load Department Scope for the Studio

**Files:**
- Modify: `apps/admin/src/app/(portal)/news/[id]/page.tsx:1-77`

**Interfaces:**
- Consumes: `listDepartmentsForCampus(campusId): Promise<Departments[]>`.
- Produces these `NewsStudioEditor` props:
  - `allowedDepartmentIds?: string[]`
  - `campuses: Campus[]`
  - `canChangeCampus: boolean`
  - `defaultCampusId: string`
  - `initialDepartments: Departments[]`
  - `article`, `isNew`, and existing labels

- [ ] **Step 1: Add scoped department loading**

Follow the verified jobs-page authorization boundary:

```ts
const campusIdForDepartments = article?.campus_id ?? effectiveCampusId;
const departments = campusIdForDepartments
  ? await listDepartmentsForCampus(campusIdForDepartments)
  : [];
const isDepartmentUser = !(isGlobalAdmin || isCampusAdmin);
const allowedDepartmentIds =
  isDepartmentUser && ctx.resolvedDepartmentIds.length > 0
    ? departments
        .filter((department) =>
          ctx.resolvedDepartmentIds.includes(department.$id)
        )
        .map((department) => department.$id)
    : undefined;
const initialDepartments = allowedDepartmentIds
  ? departments.filter((department) =>
      allowedDepartmentIds.includes(department.$id)
    )
  : departments;
```

Pass those values to `NewsStudioEditor`. Keep the current global/campus admin
campus filtering unchanged.

- [ ] **Step 2: Run the admin typecheck to expose the planned prop mismatch**

Run:

```bash
bun run --cwd apps/admin check-types
```

Expected: FAIL until Task 4 provides `NewsStudioEditor` and its new prop
contract. This failure is the integration RED checkpoint.

Do not commit Task 3 separately because it intentionally depends on Task 4.

---

### Task 4: Build the Full News Studio and Live Preview

**Files:**
- Create: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-preview.tsx`
- Create: `apps/admin/src/app/(portal)/news/[id]/_components/news-studio-editor.tsx`
- Modify: `apps/admin/src/app/(portal)/news/[id]/page.tsx`
- Delete: `apps/admin/src/app/(portal)/news/[id]/_components/news-editor-client.tsx`

**Interfaces:**
- Consumes: `createNewsStudioDefaults`, `NewsLocale`, `NewsWithTranslations`,
  and `NewsFormValues`.
- Consumes: `createNews`, `updateNews`, `listDepartmentsForCampus`, existing
  `ContentEditor`, and `ImageUploadField`.
- Produces: `NewsStudioPreview({ values, locale, campusName, departmentName })`.
- Produces: `NewsStudioEditor(props)` with the prop contract from Task 3.

- [ ] **Step 1: Create the reader-facing preview**

Render the public-page hierarchy with the active localized content:

```tsx
export function NewsStudioPreview({
  campusName,
  departmentName,
  locale,
  values,
}: NewsStudioPreviewProps) {
  const title = locale === "no" ? values.title_no : values.title_en;
  const description =
    locale === "no" ? values.description_no : values.description_en;

  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
      {values.image ? (
        <div className="relative h-52 overflow-hidden">
          <Image
            alt={title || "Article cover"}
            className="object-cover"
            fill
            sizes="(max-width: 1024px) 100vw, 440px"
            src={values.image}
          />
        </div>
      ) : (
        <div className="grid h-36 place-items-center bg-[#001731] text-white/70">
          Cover image
        </div>
      )}
      <article className="space-y-4 p-6">
        <p className="text-[11px] text-slate-500 uppercase tracking-[0.14em]">
          {[campusName, departmentName, values.category]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h2 className="font-light text-4xl leading-none tracking-tight text-[#07111f]">
          {title || "Article headline"}
        </h2>
        <p className="text-slate-500 text-sm">
          {values.author || "BISO"} · {new Date().toLocaleDateString()}
        </p>
        <PlateContentRenderer
          className="prose-sm text-slate-700"
          value={description}
        />
      </article>
    </div>
  );
}
```

- [ ] **Step 2: Create the studio state and submission boundary**

Use one typed state object and one setter that marks it dirty:

```tsx
const [step, setStep] = useState(0);
const [locale, setLocale] = useState<NewsLocale>("no");
const [values, setValues] = useState(() =>
  createNewsStudioDefaults(article, campuses, defaultCampusId)
);
const [dirty, setDirty] = useState(false);
const [pendingStatus, setPendingStatus] = useState<
  NewsFormValues["status"] | null
>(null);

const setValue = <Key extends keyof NewsFormValues>(
  key: Key,
  value: NewsFormValues[Key]
): void => {
  setValues((current) => ({ ...current, [key]: value }));
  setDirty(true);
};

const submit = async (status: NewsFormValues["status"]): Promise<void> => {
  const payload = { ...values, status };
  const validated = newsSchema.safeParse(payload);
  if (!validated.success) {
    toast.error(labels.saveError);
    return;
  }

  setPendingStatus(status);
  try {
    const result = isNew
      ? await createNews(validated.data)
      : await updateNews(article!.$id, validated.data);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : labels.saveError
      );
      return;
    }
    setDirty(false);
    toast.success(
      status === "published" ? labels.publishSuccess : labels.saveSuccess
    );
    if (isNew) {
      router.push(`/news/${result.data}`);
      return;
    }
    router.refresh();
  } finally {
    setPendingStatus(null);
  }
};
```

- [ ] **Step 3: Build the persistent studio shell**

Use this structure and the jobs editor's responsive Tailwind patterns:

```tsx
<div className="-m-8 min-h-screen overflow-hidden bg-[#faf7f2] text-[#07111f] md:-m-12">
  <div className="flex min-h-screen flex-col">
    <NewsStudioHeader
      articleTitle={values.title_no || values.title_en}
      isNew={isNew}
      onDiscard={() => router.push("/news")}
      onPublish={() => submit("published")}
      onSaveDraft={() => submit("draft")}
      pendingStatus={pendingStatus}
    />
    <NewsStudioStepRail
      dirty={dirty}
      locale={locale}
      onLocaleChange={setLocale}
      onStepChange={setStep}
      step={step}
    />
    <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
      <section className="min-h-0 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto max-w-3xl">
          {step === 0 && <NewsEssentialsStep />}
          {step === 1 && <NewsArticleStep />}
          {step === 2 && <NewsMediaVisibilityStep />}
          {step === 3 && <NewsReviewStep />}
        </div>
      </section>
      <aside className="hidden min-h-0 border-slate-200 border-l bg-[#e8f2f7] lg:flex lg:flex-col">
        <NewsStudioPreview
          campusName={campusName}
          departmentName={departmentName}
          locale={locale}
          values={values}
        />
      </aside>
    </main>
    <NewsStudioFooter
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      onContinue={() =>
        setStep((current) => Math.min(NEWS_STEPS.length - 1, current + 1))
      }
      onPublish={() => submit("published")}
      onSaveDraft={() => submit("draft")}
      pendingStatus={pendingStatus}
      step={step}
    />
  </div>
</div>
```

Define the four step labels exactly as:

```ts
const NEWS_STEPS = [
  "Essentials",
  "Article",
  "Media & Visibility",
  "Review",
] as const;
```

- [ ] **Step 4: Implement each approved step**

Essentials:

- localized headline and locale label
- editable generated slug
- author and category
- campus selector
- department selector filtered by `allowedDepartmentIds`
- campus changes clear the department and reload departments

Article:

- `ContentEditor` with `variant="news"`
- active locale reads and writes its own description field
- visible active-language label

Media & Visibility:

- existing `ImageUploadField`
- sticky toggle with explanatory copy
- current scope and status summary

Review:

- checklist for headline, slug, campus, cover image, and article body
- active locale summary plus indication when the other locale is empty
- draft and publish buttons wired to `submit`

Every input must have a visible `<label>` or `aria-label`; every control is a
native `<button>`, `<input>`, `<select>`, or existing accessible editor
component.

- [ ] **Step 5: Generate slugs without overwriting manual values**

On localized headline blur:

```ts
if (!values.slug) {
  setValue(
    "slug",
    generateSlug(values.title_no || values.title_en)
  );
}
```

- [ ] **Step 6: Replace the route import and remove the legacy editor**

In `page.tsx`:

```ts
import { NewsStudioEditor } from "./_components/news-studio-editor";
```

Render it with the Task 3 scoped props. Delete
`news-editor-client.tsx` only after the new import resolves.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```bash
bun test \
  'apps/admin/src/app/(portal)/news/[id]/_components/news-studio-state.test.ts' \
  'apps/admin/src/app/(portal)/_actions/news.test.ts' \
  'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts'
bun run --cwd apps/admin check-types
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit the studio**

```bash
git add 'apps/admin/src/app/(portal)/news/[id]' \
  'apps/admin/src/app/(portal)/_actions'
git commit -m "Give news publishers the full studio workflow" \
  -m "Constraint: Preserve the existing public news and Appwrite storage contract
Rejected: Share a new framework with jobs and products | outside this change
Confidence: high
Scope-risk: moderate
Tested: Focused Bun tests and admin TypeScript check"
```

---

### Task 5: Quality and Browser Verification

**Files:**
- Modify only files already in scope if verification exposes defects.

**Interfaces:**
- Verifies the complete studio and server-action contract.

- [ ] **Step 1: Run automatic formatting**

Run:

```bash
bun x ultracite fix \
  'apps/admin/src/app/(portal)/_actions/schemas.ts' \
  'apps/admin/src/app/(portal)/_actions/news.ts' \
  'apps/admin/src/app/(portal)/_actions/news.test.ts' \
  'apps/admin/src/app/(portal)/_actions/content-scoping.test.ts' \
  'apps/admin/src/app/(portal)/news/[id]/page.tsx' \
  'apps/admin/src/app/(portal)/news/[id]/_components'
```

Review the diff and revert no user-owned file.

- [ ] **Step 2: Run the admin verification suite**

Run:

```bash
bun test ./src
bun run check-types
bun run lint
```

Working directory: `apps/admin`.

Expected: all tests pass, TypeScript reports no errors, and lint reports no
new violations.

- [ ] **Step 3: Run repository Ultracite and diff checks**

Run:

```bash
bun x ultracite check
git diff --check
git status --short
```

Expected: no issues in changed files; the pre-existing
`packages/api/appwrite.config.json` modification remains unstaged and
unchanged.

- [ ] **Step 4: Verify desktop behavior in the browser**

Start the admin app on port 3001 and verify:

1. `/news/new` opens the four-step studio.
2. Norwegian and English tabs maintain independent headline/body content.
3. The slug is generated once and manual slug edits remain unchanged.
4. Campus changes reload and constrain department choices.
5. Draft save creates a draft and navigates to the persisted editor.
6. Publish creates a published article, not a draft.
7. The preview updates headline, metadata, cover, and body for the active
   locale.
8. Existing single-language articles open with the missing locale empty and
   save without deleting their stored translation.

- [ ] **Step 5: Verify narrow-width and keyboard behavior**

At a mobile viewport:

- editor content remains usable without the desktop preview
- header/footer actions do not overlap
- steps can be reached and activated

Using only the keyboard:

- locale tabs, steps, fields, save, and publish are reachable
- visible focus is present
- disabled pending controls cannot be triggered twice

- [ ] **Step 6: Commit verification fixes if any**

If verification required changes:

```bash
git add 'apps/admin/src/app/(portal)/_actions' \
  'apps/admin/src/app/(portal)/news/[id]'
git commit -m "Keep the news studio reliable across publishing paths" \
  -m "Confidence: high
Scope-risk: narrow
Tested: Admin tests, typecheck, lint, Ultracite, and browser flows"
```

- [ ] **Step 7: Record final evidence**

Capture the exact passing commands, browser routes, viewport sizes, and any
remaining environmental limitation in the final handoff. Do not claim a check
passed unless its output was read in this session.
