"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  type OrderItems,
  type Orders,
  OrdersStatus,
  type ProductVariations,
  type WebshopProducts,
  WebshopProductsInventoryMode,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
} from "@/lib/content-authorization";
import {
  type AutoTranslationOptions,
  type ContentLocale,
  getTargetLocale,
  isCurrentTranslationSource,
} from "@/lib/content-translation";
import {
  parseAutoTranslationOptions,
  scheduleContentTranslation,
  translateContentFields,
} from "@/lib/content-translation.server";
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
} from "@/lib/list-params";
import { paginationQueries } from "@/lib/list-queries";
import { loadRecruitmentLookups } from "@/lib/recruitment";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
  deriveContentRowTeams,
} from "@/lib/utils";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { type ProductFormValues, productSchema } from "./schemas";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/**
 * A product row with its locale rows hydrated. `WebshopProducts` already
 * declares `translation_refs` as a relationship array; this alias exists so the
 * list actions can name the shape they return, and so the two hydration paths
 * (the `translation_refs.*` select, and the metadata lookup `listProducts`
 * does) agree on one type.
 */
export type ProductWithTranslations = WebshopProducts & {
  translation_refs: ContentTranslations[];
};

interface ProductTranslationDraft {
  description: string;
  name: string;
}

type GenerateProductTranslationDraftInput = ProductTranslationDraft & {
  campusId: string;
  departmentId?: string | null;
  sourceLocale: ContentLocale;
};

interface ScheduleProductTranslationInput {
  autoTranslation?: AutoTranslationOptions;
  /** Locale rows as they stood before the save — see the stale check below. */
  existingByLocale: Map<string, ContentTranslations>;
  permissions: string[];
  productId: string;
  values: ProductFormValues;
}

const PRODUCT_RELATIONSHIP_SELECT = Query.select([
  "*",
  "campus.$id",
  "department.$id",
  "translation_refs.*",
]);

const getProductTranslationSource = (
  values: ProductFormValues,
  locale: ContentLocale
): ProductTranslationDraft =>
  locale === "no"
    ? {
        description: values.description?.trim() ?? "",
        name: values.name.trim(),
      }
    : {
        description: values.description_en?.trim() ?? "",
        name: values.name_en?.trim() ?? "",
      };

const hasProductTranslationContent = (
  translation: ProductTranslationDraft
): boolean => Boolean(translation.name || translation.description);

/** Whether the form carried content for this locale at all. */
const hasSubmittedProductLocale = (
  values: ProductFormValues,
  locale: ContentLocale
): boolean =>
  locale === "no"
    ? hasProductTranslationContent(getProductTranslationSource(values, "no"))
    : Boolean(values.name_en || values.description_en);

/** What a save writes for a submitted locale — English falls back to the shared fields. */
const getSubmittedProductTranslation = (
  values: ProductFormValues,
  locale: ContentLocale
): ProductTranslationDraft =>
  locale === "no"
    ? getProductTranslationSource(values, "no")
    : {
        description: values.description_en ?? values.description ?? "",
        name: values.name_en ?? values.name,
      };

/**
 * The locale as this save leaves it: submitted content when the form carried
 * any, otherwise the existing row, which the upsert re-links by `$id` without
 * editing it.
 */
const getSavedProductTranslation = (
  values: ProductFormValues,
  locale: ContentLocale,
  existingByLocale: Map<string, ContentTranslations>
): ProductTranslationDraft => {
  if (hasSubmittedProductLocale(values, locale)) {
    return getSubmittedProductTranslation(values, locale);
  }
  const existing = existingByLocale.get(locale);
  return {
    description: existing?.description ?? "",
    name: existing?.title ?? "",
  };
};

const translateProductDraft = async (
  sourceLocale: ContentLocale,
  source: ProductTranslationDraft
): Promise<ProductTranslationDraft> => {
  const translated = await translateContentFields({
    contentType: "shop product",
    fields: [
      { format: "plain", key: "name", value: source.name },
      {
        format: "html",
        key: "description",
        value: source.description,
      },
    ],
    sourceLocale,
    targetLocale: getTargetLocale(sourceLocale),
  });
  return {
    description: translated.description ?? "",
    name: translated.name ?? "",
  };
};

const scheduleProductTranslation = ({
  autoTranslation,
  existingByLocale,
  permissions,
  productId,
  values,
}: ScheduleProductTranslationInput): boolean => {
  const sourceLocale = autoTranslation?.sourceLocale;
  const source = sourceLocale
    ? getProductTranslationSource(values, sourceLocale)
    : undefined;

  return scheduleContentTranslation({
    enabled: Boolean(autoTranslation?.enabled && source?.name.trim()),
    task: async () => {
      if (!(source && sourceLocale)) {
        return;
      }
      const translated = await translateProductDraft(sourceLocale, source);
      // Fresh admin client: the request that scheduled this callback is done.
      const { db } = await createAdminClient();
      const currentProduct = await db.getRow<ProductWithTranslations>(
        "app",
        "webshop_products",
        productId,
        [PRODUCT_RELATIONSHIP_SELECT]
      );
      const ownership = getContentOwnership(currentProduct, {
        legacyFallback: true,
      });
      if (
        !isCurrentTranslationSource(
          {
            campusId: values.campus_id,
            departmentId: values.department_id ?? null,
            memberOnly: values.member_only,
            status: values.status,
          },
          {
            campusId: ownership.campus,
            departmentId: ownership.department,
            memberOnly: currentProduct.member_only,
            status: currentProduct.status,
          }
        )
      ) {
        return;
      }
      // The synchronous save linked the source locale before scheduling, so
      // the parent relation is the authoritative read path here.
      const currentTranslations = currentProduct.translation_refs ?? [];
      const currentSource = currentTranslations.find(
        (translation) => translation.locale === sourceLocale
      );
      if (
        !(
          currentSource &&
          isCurrentTranslationSource(
            { description: source.description, name: source.name },
            {
              description: currentSource.description ?? "",
              name: currentSource.title ?? "",
            }
          )
        )
      ) {
        return;
      }

      const targetLocale = getTargetLocale(sourceLocale);
      const currentTarget = currentTranslations.find(
        (translation) => translation.locale === targetLocale
      );
      // The destination is only ours to overwrite while it still holds exactly
      // what this save left there. An editor who translated the other locale by
      // hand while the model request was in flight owns the newer text.
      if (
        !isCurrentTranslationSource(
          getSavedProductTranslation(values, targetLocale, existingByLocale),
          {
            description: currentTarget?.description ?? "",
            name: currentTarget?.title ?? "",
          }
        )
      ) {
        return;
      }
      const translatedFields = {
        description: translated.description,
        title: translated.name,
      };
      if (currentTarget) {
        await db.updateRow(
          "app",
          "content_translations",
          currentTarget.$id,
          translatedFields,
          permissions
        );
        return;
      }
      await db.createRow(
        "app",
        "content_translations",
        ID.unique(),
        {
          ...translatedFields,
          content_id: productId,
          content_type: "product",
          locale: targetLocale,
          // A fresh destination row must arrive already related to its parent.
          product_ref: productId,
          short_description: null,
        },
        permissions
      );
    },
  });
};

export async function generateProductTranslationDraft(
  input: GenerateProductTranslationDraftInput
) {
  const ctx = await requireAuth();
  if (input.sourceLocale !== "no" && input.sourceLocale !== "en") {
    return { error: "Unsupported source locale" };
  }
  const source = {
    description: input.description ?? "",
    name: input.name ?? "",
  };
  if (!hasProductTranslationContent(source)) {
    return { error: "Add source content before translating" };
  }

  try {
    assertWriteAccess(ctx, input.campusId, input.departmentId ?? null);
    return { data: await translateProductDraft(input.sourceLocale, source) };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to translate product",
    };
  }
}

interface NestedProductTranslation {
  $id?: string;
  $permissions: string[];
  content_id?: string;
  content_type?: "product";
  description?: string;
  locale?: string;
  short_description?: string | null;
  title?: string;
}

/**
 * Nested relationship children for the product upsert. Locales with submitted
 * content carry full data (`$id` reuses an existing row); existing locales the
 * form left untouched are included by `$id` with `$permissions` only, so a
 * status transition re-stamps their visibility without unlinking or editing.
 */
function buildProductTranslationChildren(
  productId: string,
  values: ProductFormValues,
  existingByLocale: Map<string, ContentTranslations>,
  permissions: string[]
): NestedProductTranslation[] {
  const children: NestedProductTranslation[] = [];

  for (const locale of ["no", "en"] as const) {
    const existing = existingByLocale.get(locale);
    if (hasSubmittedProductLocale(values, locale)) {
      const submitted = getSubmittedProductTranslation(values, locale);
      children.push({
        ...(existing ? { $id: existing.$id } : {}),
        $permissions: permissions,
        content_id: productId,
        content_type: "product",
        description: submitted.description,
        locale,
        short_description: values.short_description ?? null,
        title: submitted.name,
      });
    } else if (existing) {
      children.push({ $id: existing.$id, $permissions: permissions });
    }
  }

  return children;
}

/**
 * Existing locales are looked up by content metadata, not the relation: rows
 * that predate the relationship backfill are unlinked, and matching them here
 * both prevents duplicate locale rows and re-links them on the next save.
 */
async function loadProductTranslationsByLocale(
  db: AdminDb,
  productId: string
): Promise<Map<string, ContentTranslations>> {
  const current = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "product"),
      Query.equal("content_id", productId),
      Query.limit(5),
    ]
  );
  return new Map(
    current.rows.map((translation) => [translation.locale, translation])
  );
}

function buildProductFields(data: ProductFormValues) {
  return {
    slug: data.slug,
    // Canonical ownership relationships; the scalar columns remain as
    // migration-era compatibility metadata only.
    campus: data.campus_id,
    campus_id: data.campus_id,
    department: data.department_id ?? null,
    departmentId: data.department_id ?? null,
    category: data.category ?? null,
    regular_price: data.regular_price,
    member_price: data.member_price ?? null,
    member_only: data.member_only ?? false,
    image: data.image || null,
    stock: data.stock ?? null,
    tags: data.tags ?? null,
    images: data.images ?? null,
    cover_pattern: data.cover_pattern ?? "dotted",
    linked_event_id: data.linked_event_id ?? null,
    inventory_mode: data.inventory_mode ?? "unlimited",
    finago_account_number: data.finago_account_number ?? null,
  };
}

type ProductVariationInput = NonNullable<
  ProductFormValues["variations"]
>[number];

function readProductVariations(
  data: ProductFormValues
): ProductVariationInput[] {
  if (data.variations) {
    return data.variations;
  }
  if (!data.variants_json) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(data.variants_json);
    return Array.isArray(parsed) ? (parsed as ProductVariationInput[]) : [];
  } catch {
    return [];
  }
}

async function syncProductVariations(
  db: AdminDb,
  productId: string,
  values: ProductFormValues,
  existingVariations: ProductVariations[] = []
): Promise<void> {
  const requested = readProductVariations(values);
  const existingIds = new Set(
    existingVariations.map((variation) => variation.$id)
  );
  const requestedIds = new Set(requested.map((variation) => variation.id));

  for (const variation of existingVariations) {
    if (!requestedIds.has(variation.$id)) {
      await db.deleteRow("app", "product_variations", variation.$id);
    }
  }

  for (const [sortOrder, variation] of requested.entries()) {
    const variationId = existingIds.has(variation.id)
      ? variation.id
      : ID.unique();
    await db.upsertRow("app", "product_variations", variationId, {
      enabled: true,
      name: variation.name,
      product: productId,
      regular_price: variation.price,
      sort_order: sortOrder,
      stock: variation.stock,
    });
  }
}

async function buildProductPermissions(
  db: AdminDb,
  values: ProductFormValues
): Promise<{ rowPermissions: string[]; translationPermissions: string[] }> {
  const lookups = await loadRecruitmentLookups(db);
  const audience = values.member_only ? "members" : "public";
  const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
    campus_id: values.campus_id,
    department_id: values.department_id ?? null,
  });
  return {
    rowPermissions: buildContentRowPermissions({
      status: values.status,
      audience,
      campusTeam,
      deptTeam,
    }),
    translationPermissions: buildContentTranslationPermissions({
      audience,
      status: values.status,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    }),
  };
}

/**
 * Appwrite expands a value list into an `$id` IN-list and refuses one longer
 * than this ("Query on attribute has greater than 500 values: $id"), so every
 * id-set filter in this file is bounded by it.
 */
const MAX_ID_FILTER_VALUES = 500;

/** Whole-catalog reads: 57 products today, so one page covers the table. */
const PRODUCT_SCAN_LIMIT = 500;

/** A tracked product below this is surfaced as low stock. */
const LOW_STOCK_THRESHOLD = 5;

/** Locale rows per product (`no` + `en`), used to size the hydration read. */
const TRANSLATIONS_PER_PRODUCT = 2;

const TRANSLATION_HYDRATION_CHUNK = 25;

/**
 * Locale rows for a set of products, read by content metadata rather than the
 * `translation_refs` relation: the list select deliberately omits it (see
 * `listProducts`), and chunking keeps each `content_id` IN-list small.
 */
async function loadProductTranslations(
  db: AdminDb,
  productIds: string[]
): Promise<ContentTranslations[]> {
  const translations: ContentTranslations[] = [];
  for (let i = 0; i < productIds.length; i += TRANSLATION_HYDRATION_CHUNK) {
    const chunk = productIds.slice(i, i + TRANSLATION_HYDRATION_CHUNK);
    const res = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "product"),
        Query.equal("content_id", chunk),
        Query.limit(chunk.length * TRANSLATIONS_PER_PRODUCT),
      ]
    );
    translations.push(...res.rows);
  }
  return translations;
}

/**
 * Product ids whose translated title matches `q`.
 *
 * Products keep their names in `content_translations`, not on the row, so a
 * title search cannot be a column filter on `webshop_products`. Resolving to
 * ids first and feeding them back as `Query.equal("$id", …)` keeps the scope,
 * status and pagination filters — and therefore `total` — on the ONE query the
 * page is drawn from; filtering in JS after the fact would page the wrong set.
 *
 * Bounded by `MAX_ID_FILTER_VALUES`: with 114 product locale rows in total the
 * cap is unreachable today, and it is the hard Appwrite limit regardless.
 */
async function findProductIdsByTitle(
  db: AdminDb,
  q: string
): Promise<string[]> {
  const response = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "product"),
      // `content_translations` carries a fulltext index on `title`
      // (`search_title`), which `Query.search` uses and `Query.contains` does
      // not.
      Query.search("title", q),
      Query.select(["$id", "content_id"]),
      Query.limit(MAX_ID_FILTER_VALUES),
    ]
  );
  // A product has one row per locale, so the same content_id arrives twice.
  const ids = new Set<string>();
  for (const row of response.rows) {
    if (row.content_id) {
      ids.add(row.content_id);
    }
  }
  return [...ids];
}

const PRODUCT_LOCALE_PREFERENCE = "no";

/** The name the shop UI shows for a product: Norwegian, any locale, then slug. */
function resolveProductTitle(
  product: Pick<WebshopProducts, "$id" | "slug">,
  translations: ContentTranslations[]
): string {
  const rows = translations.filter((row) => row.content_id === product.$id);
  return (
    rows.find((row) => row.locale === PRODUCT_LOCALE_PREFERENCE)?.title ??
    rows[0]?.title ??
    product.slug
  );
}

export async function listProducts(
  params: ListParams & { status?: string; category?: string }
): Promise<PaginatedResult<ProductWithTranslations>> {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary. They are
  // applied to the ONE product query, so they hold on every page and under
  // every filter combination.
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.select(["*", "variations.*"]),
    ...paginationQueries(params),
    ...applyContentRelationshipScopeQueries(ctx),
  ];

  if (params.status && params.status !== "all") {
    queries.push(Query.equal("status", params.status));
  }

  if (params.category) {
    queries.push(Query.equal("category", params.category));
  }

  if (params.q) {
    // The list UI has always searched slug as well as name, so the predicate is
    // "translated title matches OR slug matches". `Query.or` rejects a
    // single-clause list, so with no title hit the predicate collapses to the
    // slug match rather than short-circuiting — a product whose slug matches
    // but whose title does not must still be reachable.
    const titleIds = await findProductIdsByTitle(db, params.q);
    const slugMatch = Query.contains("slug", params.q);
    queries.push(
      titleIds.length > 0
        ? Query.or([Query.equal("$id", titleIds), slugMatch])
        : slugMatch
    );
  }

  const response = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    queries
  );

  const translations = await loadProductTranslations(
    db,
    response.rows.map((product) => product.$id)
  );

  return {
    rows: response.rows.map((product) => ({
      ...product,
      translation_refs: translations.filter(
        (t) => t.content_id === product.$id
      ),
    })),
    total: response.total,
    page: params.page,
    size: params.size,
  };
}

export interface ProductStats {
  all: number;
  archived: number;
  drafts: number;
  lowStock: number;
  pending: number;
  published: number;
}

/**
 * Catalog KPI tiles and status chips, counted across the FULL scoped set.
 *
 * The list is paginated, so these cannot be derived from the visible rows —
 * they would report one page's worth and change as the user paged. Deliberately
 * takes no page/size and issues no offset: a projected 500-row read covers the
 * whole table (57 products) cheaply enough to run alongside the page query, and
 * `all` comes from Appwrite's own total so it agrees with the pagination bar.
 */
export async function countProductStats(): Promise<ProductStats> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const response = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [
      Query.select(["$id", "status", "inventory_mode", "stock"]),
      Query.limit(PRODUCT_SCAN_LIMIT),
      ...applyContentRelationshipScopeQueries(ctx),
    ]
  );

  const stats: ProductStats = {
    all: response.total,
    archived: 0,
    drafts: 0,
    lowStock: 0,
    pending: 0,
    published: 0,
  };

  for (const product of response.rows) {
    if (product.status === WebshopProductsStatus.PUBLISHED) {
      stats.published += 1;
    } else if (product.status === WebshopProductsStatus.DRAFT) {
      stats.drafts += 1;
    } else if (product.status === WebshopProductsStatus.PENDING_APPROVAL) {
      stats.pending += 1;
    } else if (product.status === WebshopProductsStatus.ARCHIVED) {
      stats.archived += 1;
    }

    if (
      product.inventory_mode === WebshopProductsInventoryMode.TRACKED &&
      typeof product.stock === "number" &&
      product.stock < LOW_STOCK_THRESHOLD
    ) {
      stats.lowStock += 1;
    }
  }

  return stats;
}

/**
 * Catalog products for the orders tab's product filter.
 *
 * Sourced from `webshop_products` rather than by scanning order items: the
 * filter matches on catalog product id, which is exact and survives a rename,
 * and 57 scoped rows are one cheap read. Same scope boundary as
 * `listProducts` — the admin client bypasses row security.
 */
export async function listOrderProductOptions(): Promise<
  { id: string; name: string }[]
> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const response = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [
      Query.select(["$id", "slug"]),
      Query.limit(PRODUCT_SCAN_LIMIT),
      ...applyContentRelationshipScopeQueries(ctx),
    ]
  );

  const translations = await loadProductTranslations(
    db,
    response.rows.map((product) => product.$id)
  );

  return response.rows
    .map((product) => ({
      id: product.$id,
      name: resolveProductTitle(product, translations),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProduct(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const response = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [
      Query.equal("$id", id),
      Query.select(["*", "variations.*"]),
      Query.limit(1),
    ]
  );
  const product = response.rows[0];
  if (!product) {
    return null;
  }
  // Treat a row outside the caller's campus/department scope as not found.
  const ownership = getContentOwnership(product, { legacyFallback: true });
  if (!hasRowAccess(ctx, ownership.campus, ownership.department)) {
    return null;
  }

  const translationsResponse = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "product"),
      Query.equal("content_id", id),
      Query.limit(10),
    ]
  );

  return { ...product, translation_refs: translationsResponse.rows };
}

export async function createProduct(
  values: ProductFormValues,
  autoTranslation?: AutoTranslationOptions
) {
  const ctx = await requireAuth();
  const validated = productSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db } = await createAdminClient();
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: false,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
    });
    if (validated.data.status === "published") {
      assertPublishAccess(
        ctx,
        validated.data.campus_id,
        validated.data.department_id ?? null
      );
    }

    const { rowPermissions, translationPermissions } =
      await buildProductPermissions(db, validated.data);

    const productId = ID.unique();
    const product = await db.upsertRow(
      "app",
      "webshop_products",
      productId,
      {
        ...buildProductFields(validated.data),
        status: validated.data.status as WebshopProductsStatus,
        translation_refs: buildProductTranslationChildren(
          productId,
          validated.data,
          new Map(),
          translationPermissions
        ),
      },
      rowPermissions
    );
    await syncProductVariations(db, productId, validated.data);

    await logAuditEvent(ctx, "product_created", {
      resourceId: product.$id,
      resourceType: "product",
    });
    const translationQueued = scheduleProductTranslation({
      autoTranslation: translationOptions,
      existingByLocale: new Map(),
      permissions: translationPermissions,
      productId: product.$id,
      values: validated.data,
    });
    revalidatePath("/shop");
    return translationQueued
      ? { data: product.$id, translationQueued: true as const }
      : { data: product.$id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save product",
    };
  }
}

export async function updateProduct(
  id: string,
  values: ProductFormValues,
  autoTranslation?: AutoTranslationOptions
) {
  const ctx = await requireAuth();
  const validated = productSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const { db } = await createAdminClient();

  const existing = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [
      Query.equal("$id", id),
      Query.select(["*", "variations.*"]),
      Query.limit(1),
    ]
  );
  const product = existing.rows[0];
  if (!product) {
    return { error: "Product not found" };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    // Authorize both the persisted scope and the requested scope so ownership
    // transfers require access on each side.
    const persisted = getContentOwnership(product, { legacyFallback: true });
    assertWriteAccess(ctx, persisted.campus, persisted.department);
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: false,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
    });
    if (
      product.status === "published" ||
      validated.data.status === "published"
    ) {
      assertPublishAccess(ctx, persisted.campus, persisted.department);
      assertPublishAccess(
        ctx,
        validated.data.campus_id,
        validated.data.department_id ?? null
      );
    }

    const { rowPermissions, translationPermissions } =
      await buildProductPermissions(db, validated.data);

    const existingByLocale = await loadProductTranslationsByLocale(db, id);
    await db.upsertRow(
      "app",
      "webshop_products",
      id,
      {
        ...buildProductFields(validated.data),
        status: validated.data.status as WebshopProductsStatus,
        translation_refs: buildProductTranslationChildren(
          id,
          validated.data,
          existingByLocale,
          translationPermissions
        ),
      },
      rowPermissions
    );
    await syncProductVariations(
      db,
      id,
      validated.data,
      product.variations ?? []
    );

    await logAuditEvent(ctx, "product_updated", {
      resourceId: id,
      resourceType: "product",
      payload: { status: validated.data.status },
    });
    const translationQueued = scheduleProductTranslation({
      autoTranslation: translationOptions,
      existingByLocale,
      permissions: translationPermissions,
      productId: id,
      values: validated.data,
    });
    revalidatePath("/shop");
    revalidatePath(`/shop/${id}`);
    return translationQueued
      ? { data: id, translationQueued: true as const }
      : { data: id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save product",
    };
  }
}

export async function deleteProduct(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const existing = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [Query.equal("$id", id), Query.limit(1)]
  );
  const product = existing.rows[0];
  if (!product) {
    return { error: "Product not found" };
  }

  try {
    const ownership = getContentOwnership(product, { legacyFallback: true });
    assertWriteAccess(ctx, ownership.campus, ownership.department);

    const translations = await db.listRows("app", "content_translations", [
      Query.equal("content_type", "product"),
      Query.equal("content_id", id),
    ]);
    await Promise.all(
      translations.rows.map((t) =>
        db.deleteRow("app", "content_translations", t.$id)
      )
    );
    await db.deleteRow("app", "webshop_products", id);

    await logAuditEvent(ctx, "product_deleted", {
      resourceId: id,
      resourceType: "product",
    });
    revalidatePath("/shop");
    return { data: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete product",
    };
  }
}

/** Appwrite stops counting at this, and it is also the largest `Query.limit`. */
const APPWRITE_TOTAL_CAP = 5000;

/** How many `order_items` one product-resolution round trip reads. */
const ORDER_ITEM_SCAN_PAGE = 500;

/**
 * Ceiling on product-resolution round trips. A product with more line items
 * than this scans is reported as truncated rather than paged forever.
 */
const MAX_ORDER_ITEM_SCAN_PAGES = 20;

interface OrderFilters {
  from?: string;
  productId?: string;
  q?: string;
  status?: string;
  to?: string;
}

/**
 * `Query.select` returns a relationship as `{ $id }`; without it Appwrite
 * returns the bare id string. Read both so the helper does not silently return
 * nothing if the projection ever changes.
 */
function readRelationId(value: unknown): string | null {
  if (typeof value === "string") {
    return value || null;
  }
  if (value && typeof value === "object" && "$id" in value) {
    const id = (value as { $id: unknown }).$id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/**
 * A yyyy-mm-dd range as whole-day UTC bounds on `$createdAt`. One-sided ranges
 * become an open comparison rather than a `between` against a fabricated bound.
 */
function orderDateQueries(from?: string, to?: string): string[] {
  const start = from ? `${from}T00:00:00.000Z` : null;
  const end = to ? `${to}T23:59:59.999Z` : null;
  if (start && end) {
    return [Query.between("$createdAt", start, end)];
  }
  if (start) {
    return [Query.greaterThanEqual("$createdAt", start)];
  }
  if (end) {
    return [Query.lessThanEqual("$createdAt", end)];
  }
  return [];
}

/** Shape of an Appwrite row id, so a pasted order id can be matched exactly. */
const APPWRITE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_]{0,35}$/;

/**
 * `$id` supports no substring operator, so a free-text search covers the buyer
 * columns and only adds an exact id match when `q` could actually be one.
 */
function orderSearchQuery(q: string): string {
  const clauses = [
    Query.contains("buyer_name", q),
    Query.contains("buyer_email", q),
  ];
  if (APPWRITE_ID_PATTERN.test(q)) {
    clauses.push(Query.equal("$id", q));
  }
  return Query.or(clauses);
}

/**
 * Adds each row's distinct parent order id to `ids`, stopping at `limit`.
 * Returns whether a new id had to be dropped — i.e. whether more exist.
 */
function collectOrderIds(
  rows: OrderItems[],
  ids: Set<string>,
  limit: number
): boolean {
  for (const item of rows) {
    const orderId = readRelationId(item.order);
    if (!orderId || ids.has(orderId)) {
      continue;
    }
    if (ids.size >= limit) {
      return true;
    }
    ids.add(orderId);
  }
  return false;
}

/**
 * Order ids that contain the given product, resolved via `order_items` rather
 * than a nested query on `orders`.
 *
 * A nested filter (`Query.equal("order_items.product.$id", …)`) is expanded by
 * Appwrite into an `$id` IN-list capped at 500 and SILENTLY truncated — the
 * sibling `Query.contains("order_items.name", …)` fails outright with "Query on
 * attribute has greater than 500 values: $id". Resolving here makes the bound
 * explicit and reportable instead.
 *
 * `limit` is a parameter, not a constant, because the CSV export needs an
 * uncapped resolution while the screen only needs the first page's worth.
 */
export async function listOrderIdsForProduct(
  productId: string,
  opts?: { limit?: number }
): Promise<{ ids: string[]; truncated: boolean }> {
  await requireAuth();
  // Session client: order_items carries the same operational row security as
  // orders, so this resolution cannot widen what the caller may see.
  const { db } = await createSessionClient();

  const limit = opts?.limit ?? MAX_ID_FILTER_VALUES;
  const ids = new Set<string>();
  let cursor: string | undefined;
  let reachedLimit = false;
  let exhausted = false;

  for (let page = 0; page < MAX_ORDER_ITEM_SCAN_PAGES; page += 1) {
    const queries = [
      Query.equal("product.$id", productId),
      Query.select(["$id", "order.$id"]),
      Query.limit(ORDER_ITEM_SCAN_PAGE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await db.listRows<OrderItems>(
      "app",
      "order_items",
      queries
    );
    if (response.rows.length === 0) {
      exhausted = true;
      break;
    }

    reachedLimit = collectOrderIds(response.rows, ids, limit);
    if (reachedLimit) {
      break;
    }
    if (response.rows.length < ORDER_ITEM_SCAN_PAGE) {
      exhausted = true;
      break;
    }
    cursor = response.rows.at(-1)?.$id;
    if (!cursor) {
      exhausted = true;
      break;
    }
  }

  return { ids: [...ids], truncated: reachedLimit || !exhausted };
}

/**
 * The filters `listOrders` and `countOrderStats` MUST agree on, so the KPI
 * tiles and status chips describe exactly the set the list is drawn from.
 *
 * Returns `null` when a product filter provably matches no orders, so the
 * caller can answer without asking Appwrite for `Query.equal("$id", [])`
 * (which it rejects).
 */
async function orderFilterQueries(
  filters: OrderFilters
): Promise<{ queries: string[]; truncated: boolean } | null> {
  const queries: string[] = [];
  let truncated = false;

  if (filters.productId) {
    const resolved = await listOrderIdsForProduct(filters.productId);
    if (resolved.ids.length === 0) {
      return null;
    }
    queries.push(Query.equal("$id", resolved.ids));
    truncated = resolved.truncated;
  }

  if (filters.status && filters.status !== "all") {
    queries.push(Query.equal("status", filters.status));
  }

  queries.push(...orderDateQueries(filters.from, filters.to));

  if (filters.q) {
    queries.push(orderSearchQuery(filters.q));
  }

  return { queries, truncated };
}

export async function listOrders(
  params: ListParams & OrderFilters
): Promise<PaginatedResult<Orders> & { truncated?: boolean }> {
  const ctx = await requireAuth();
  // Orders remain an operational commerce surface with its own narrow session
  // authorization — they are intentionally outside the general content model.
  const { db } = await createSessionClient();

  const filters = await orderFilterQueries(params);
  if (filters === null) {
    return { ...emptyResult<Orders>(params), truncated: false };
  }

  const queries: string[] = [
    Query.orderDesc("$createdAt"),
    Query.select([
      "*",
      "order_items.*",
      "order_items.product.*",
      "order_items.variation.*",
    ]),
    ...paginationQueries(params),
    // orders is campus-scoped only (no department column).
    ...applyScopeQueries(ctx, { departmentField: null }),
    ...filters.queries,
  ];

  const response = await db.listRows<Orders>("app", "orders", queries);
  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
    truncated: filters.truncated,
  };
}

export interface OrderStats {
  all: number;
  cancelled: number;
  /** True when the numbers describe only the first `APPWRITE_TOTAL_CAP` rows. */
  capped: boolean;
  paid: number;
  paidRevenue: number;
  pending: number;
  /** Same tally as `pending`; named for the KPI tile that reads it. */
  pendingCount: number;
  refunded: number;
}

const EMPTY_ORDER_STATS: OrderStats = {
  all: 0,
  cancelled: 0,
  capped: false,
  paid: 0,
  paidRevenue: 0,
  pending: 0,
  pendingCount: 0,
  refunded: 0,
};

/**
 * Revenue and status counts for the same scoped, filtered set `listOrders`
 * pages through — the list is paginated, so they cannot come from the visible
 * rows.
 *
 * `paidRevenue` needs the amounts, so this reads a projection rather than
 * counting: one 5000-row page, newest first, which is Appwrite's hard limit on
 * both `Query.limit` and the reported `total`. When that cap is hit the numbers
 * describe the newest 5000 matching orders only, and `capped` says so — the UI
 * must render "5000+", never an exact figure. Narrowing by date or status
 * brings a real total back into range.
 */
export async function countOrderStats(
  filters: OrderFilters
): Promise<OrderStats> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const filterQueries = await orderFilterQueries(filters);
  if (filterQueries === null) {
    return { ...EMPTY_ORDER_STATS };
  }

  const response = await db.listRows<Orders>("app", "orders", [
    Query.orderDesc("$createdAt"),
    Query.select(["$id", "status", "total"]),
    Query.limit(APPWRITE_TOTAL_CAP),
    ...applyScopeQueries(ctx, { departmentField: null }),
    ...filterQueries.queries,
  ]);

  const stats: OrderStats = {
    ...EMPTY_ORDER_STATS,
    all: response.total,
    capped:
      response.total >= APPWRITE_TOTAL_CAP ||
      response.rows.length >= APPWRITE_TOTAL_CAP,
  };

  for (const order of response.rows) {
    if (order.status === OrdersStatus.PAID) {
      stats.paid += 1;
      stats.paidRevenue += order.total ?? 0;
    } else if (order.status === OrdersStatus.PENDING) {
      stats.pending += 1;
    } else if (order.status === OrdersStatus.REFUNDED) {
      stats.refunded += 1;
    } else if (order.status === OrdersStatus.CANCELLED) {
      stats.cancelled += 1;
    }
  }
  stats.pendingCount = stats.pending;

  return stats;
}
