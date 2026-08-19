"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Orders,
  ProductVariations,
  WebshopProducts,
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

type ProductWithTranslations = WebshopProducts & {
  translation_refs?: ContentTranslations[] | null;
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

export async function listProducts(opts?: {
  campusId?: string;
  status?: string;
  category?: string;
}) {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.select(["*", "variations.*"]),
    Query.limit(100),
    ...applyContentRelationshipScopeQueries(ctx),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  if (opts?.category) {
    queries.push(Query.equal("category", opts.category));
  }

  const response = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    queries
  );

  const productIds = response.rows.map((p) => p.$id);
  const translations: ContentTranslations[] = [];

  if (productIds.length > 0) {
    const chunkSize = 25;
    for (let i = 0; i < productIds.length; i += chunkSize) {
      const chunk = productIds.slice(i, i + chunkSize);
      const res = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "product"),
          Query.equal("content_id", chunk),
          Query.limit(chunk.length * 2),
        ]
      );
      translations.push(...res.rows);
    }
  }

  return response.rows.map((product) => ({
    ...product,
    translation_refs: translations.filter((t) => t.content_id === product.$id),
  }));
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

export async function listOrders(opts?: {
  campusId?: string;
  status?: string;
}) {
  const ctx = await requireAuth();
  // Orders remain an operational commerce surface with its own narrow session
  // authorization — they are intentionally outside the general content model.
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderDesc("$createdAt"),
    Query.select([
      "*",
      "order_items.*",
      "order_items.product.*",
      "order_items.variation.*",
    ]),
    Query.limit(50),
    // orders is campus-scoped only (no department column).
    ...applyScopeQueries(ctx, { departmentField: null }),
  ];

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  }

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const response = await db.listRows<Orders>("app", "orders", queries);
  return response.rows;
}
