"use server";

import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Orders,
  WebshopProducts,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
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

interface TranslationData {
  content_id: string;
  content_type: string;
  description: string;
  locale: string;
  short_description: string | null;
  title: string;
}

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
  permissions: string[];
  productId: string;
  values: ProductFormValues;
}

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
      const { db } = await createAdminClient();
      const currentProduct = await db.getRow<WebshopProducts>(
        "app",
        "webshop_products",
        productId
      );
      if (
        !isCurrentTranslationSource(
          {
            campusId: values.campus_id,
            departmentId: values.department_id ?? null,
            memberOnly: values.member_only,
            status: values.status,
          },
          {
            campusId: currentProduct.campus_id,
            departmentId: currentProduct.departmentId ?? null,
            memberOnly: currentProduct.member_only,
            status: currentProduct.status,
          }
        )
      ) {
        return;
      }
      const currentTranslations = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "product"),
          Query.equal("content_id", productId),
          Query.limit(5),
        ]
      );
      const currentSource = currentTranslations.rows.find(
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
      const currentTarget = currentTranslations.rows.find(
        (translation) => translation.locale === targetLocale
      );
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
        "unique()",
        {
          ...translatedFields,
          content_id: productId,
          content_type: "product",
          locale: targetLocale,
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

async function upsertTranslation(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  existing: ContentTranslations | undefined,
  data: TranslationData,
  permissions: string[]
) {
  if (existing) {
    await db.updateRow(
      "app",
      "content_translations",
      existing.$id,
      data,
      permissions
    );
  } else {
    await db.createRow(
      "app",
      "content_translations",
      "unique()",
      data,
      permissions
    );
  }
}

async function syncNorwegianProductTranslation(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  existing: ContentTranslations | undefined,
  productId: string,
  values: ProductFormValues,
  permissions: string[]
): Promise<void> {
  const translation = getProductTranslationSource(values, "no");
  if (hasProductTranslationContent(translation)) {
    await upsertTranslation(
      db,
      existing,
      {
        content_id: productId,
        content_type: "product",
        description: translation.description,
        locale: "no",
        short_description: values.short_description ?? null,
        title: translation.name,
      },
      permissions
    );
    return;
  }
  if (existing) {
    await db.updateRow(
      "app",
      "content_translations",
      existing.$id,
      {},
      permissions
    );
  }
}

function buildProductFields(data: ProductFormValues) {
  return {
    slug: data.slug,
    campus_id: data.campus_id,
    departmentId: data.department_id ?? null,
    category: data.category ?? null,
    regular_price: data.regular_price,
    member_price: data.member_price ?? null,
    member_only: data.member_only ?? false,
    image: data.image || null,
    stock: data.stock ?? null,
    variants_json: data.variants_json ?? null,
    tags: data.tags ?? null,
    images: data.images ?? null,
    cover_pattern: data.cover_pattern ?? "dotted",
    linked_event_id: data.linked_event_id ?? null,
    inventory_mode: data.inventory_mode ?? "unlimited",
    finago_account_number: data.finago_account_number ?? null,
  };
}

export async function listProducts(opts?: {
  campusId?: string;
  status?: string;
  category?: string;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
    // webshop_products uses `departmentId` (camelCase), not `department_id`.
    ...applyScopeQueries(ctx, { departmentField: "departmentId" }),
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
  const { db } = await createSessionClient();

  const response = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [Query.equal("$id", id), Query.limit(1)]
  );
  const product = response.rows[0];
  // Treat a row outside the caller's campus/department scope as not found.
  if (
    !(product && hasRowAccess(ctx, product.campus_id, product.departmentId))
  ) {
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
    assertWriteAccess(ctx, validated.data.campus_id);
    if (validated.data.status === "published") {
      assertPublishAccess(ctx, validated.data.campus_id);
    }

    const { db } = await createSessionClient();

    const lookups = await loadRecruitmentLookups(db);
    const status = validated.data.status;
    const audience = validated.data.member_only ? "members" : "public";
    const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });
    const rowPermissions = buildContentRowPermissions({
      status,
      audience,
      campusTeam,
      deptTeam,
    });
    const translationPermissions = buildContentTranslationPermissions({
      audience,
      status,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    });

    const product = await db.createRow(
      "app",
      "webshop_products",
      "unique()",
      {
        ...buildProductFields(validated.data),
        status: status as WebshopProductsStatus,
      },
      rowPermissions
    );

    const norwegianTranslation = getProductTranslationSource(
      validated.data,
      "no"
    );
    if (hasProductTranslationContent(norwegianTranslation)) {
      await db.createRow(
        "app",
        "content_translations",
        "unique()",
        {
          content_id: product.$id,
          content_type: "product",
          locale: "no",
          title: norwegianTranslation.name,
          description: norwegianTranslation.description,
          short_description: validated.data.short_description ?? null,
        },
        translationPermissions
      );
    }

    if (validated.data.name_en || validated.data.description_en) {
      await db.createRow(
        "app",
        "content_translations",
        "unique()",
        {
          content_id: product.$id,
          content_type: "product",
          locale: "en",
          title: validated.data.name_en ?? validated.data.name,
          description:
            validated.data.description_en ?? validated.data.description ?? "",
          short_description: validated.data.short_description ?? null,
        },
        translationPermissions
      );
    }

    await logAuditEvent(ctx, "product_created", {
      resourceId: product.$id,
      resourceType: "product",
    });
    const translationQueued = scheduleProductTranslation({
      autoTranslation: translationOptions,
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

  const { db } = await createSessionClient();

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
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    assertWriteAccess(ctx, product.campus_id, product.departmentId);
    assertWriteAccess(
      ctx,
      validated.data.campus_id,
      validated.data.department_id ?? null
    );
    if (
      product.status === "published" ||
      validated.data.status === "published"
    ) {
      assertPublishAccess(ctx, product.campus_id);
      assertPublishAccess(ctx, validated.data.campus_id);
    }

    const lookups = await loadRecruitmentLookups(db);
    const audience = validated.data.member_only ? "members" : "public";
    const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });
    const rowPermissions = buildContentRowPermissions({
      status: validated.data.status,
      audience,
      campusTeam,
      deptTeam,
    });
    const translationPermissions = buildContentTranslationPermissions({
      audience,
      status: validated.data.status,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    });

    await db.updateRow(
      "app",
      "webshop_products",
      id,
      {
        ...buildProductFields(validated.data),
        status: validated.data.status as WebshopProductsStatus,
      },
      rowPermissions
    );

    const existingTranslations = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "product"),
        Query.equal("content_id", id),
        Query.limit(5),
      ]
    );

    const noTranslation = existingTranslations.rows.find(
      (t) => t.locale === "no"
    );
    const enTranslation = existingTranslations.rows.find(
      (t) => t.locale === "en"
    );

    await syncNorwegianProductTranslation(
      db,
      noTranslation,
      id,
      validated.data,
      translationPermissions
    );

    if (validated.data.name_en || validated.data.description_en) {
      await upsertTranslation(
        db,
        enTranslation,
        {
          content_id: id,
          content_type: "product",
          locale: "en",
          title: validated.data.name_en ?? validated.data.name,
          description:
            validated.data.description_en ?? validated.data.description ?? "",
          short_description: validated.data.short_description ?? null,
        },
        translationPermissions
      );
    } else if (enTranslation) {
      // English content was not edited this time; still re-stamp its
      // permissions so a status transition never leaves a stale read(any).
      await db.updateRow(
        "app",
        "content_translations",
        enTranslation.$id,
        {},
        translationPermissions
      );
    }

    await logAuditEvent(ctx, "product_updated", {
      resourceId: id,
      resourceType: "product",
      payload: { status: validated.data.status },
    });
    const translationQueued = scheduleProductTranslation({
      autoTranslation: translationOptions,
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
  const { db } = await createSessionClient();

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
    assertWriteAccess(ctx, product.campus_id, product.departmentId);

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
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderDesc("$createdAt"),
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
