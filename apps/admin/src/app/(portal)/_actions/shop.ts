"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Orders,
  WebshopProducts,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { type ProductFormValues, productSchema } from "./schemas";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

interface TranslationData {
  content_id: string;
  content_type: string;
  description: string;
  locale: string;
  short_description: string | null;
  title: string;
}

async function upsertTranslation(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  existing: ContentTranslations | undefined,
  data: TranslationData
) {
  if (existing) {
    await db.updateRow("app", "content_translations", existing.$id, data);
  } else {
    await db.createRow("app", "content_translations", "unique()", data);
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
    ...applyScopeQueries(ctx),
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

export async function createProduct(values: ProductFormValues) {
  const ctx = await requireAuth();
  const validated = productSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    assertWriteAccess(ctx, validated.data.campus_id);

    const { db } = await createSessionClient();

    const product = await db.createRow("app", "webshop_products", "unique()", {
      ...buildProductFields(validated.data),
      status: "draft" as WebshopProductsStatus,
    });

    await db.createRow("app", "content_translations", "unique()", {
      content_id: product.$id,
      content_type: "product",
      locale: "no",
      title: validated.data.name,
      description: validated.data.description ?? "",
      short_description: validated.data.short_description ?? null,
    });

    if (validated.data.name_en || validated.data.description_en) {
      await db.createRow("app", "content_translations", "unique()", {
        content_id: product.$id,
        content_type: "product",
        locale: "en",
        title: validated.data.name_en ?? validated.data.name,
        description:
          validated.data.description_en ?? validated.data.description ?? "",
        short_description: validated.data.short_description ?? null,
      });
    }

    await logAuditEvent(ctx, "product_created", {
      resourceId: product.$id,
      resourceType: "product",
    });
    revalidatePath("/shop");
    return { data: product.$id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save product",
    };
  }
}

export async function updateProduct(id: string, values: ProductFormValues) {
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
    assertWriteAccess(ctx, product.campus_id, product.departmentId);
    if (
      product.status === "published" ||
      validated.data.status === "published"
    ) {
      assertPublishAccess(ctx, product.campus_id);
      assertPublishAccess(ctx, validated.data.campus_id);
    }

    await db.updateRow("app", "webshop_products", id, {
      ...buildProductFields(validated.data),
      status: validated.data.status as WebshopProductsStatus,
    });

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

    await upsertTranslation(db, noTranslation, {
      content_id: id,
      content_type: "product",
      locale: "no",
      title: validated.data.name,
      description: validated.data.description ?? "",
      short_description: validated.data.short_description ?? null,
    });

    if (validated.data.name_en || validated.data.description_en) {
      await upsertTranslation(db, enTranslation, {
        content_id: id,
        content_type: "product",
        locale: "en",
        title: validated.data.name_en ?? validated.data.name,
        description:
          validated.data.description_en ?? validated.data.description ?? "",
        short_description: validated.data.short_description ?? null,
      });
    }

    await logAuditEvent(ctx, "product_updated", {
      resourceId: id,
      resourceType: "product",
      payload: { status: validated.data.status },
    });
    revalidatePath("/shop");
    revalidatePath(`/shop/${id}`);
    return { data: id };
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
    ...applyScopeQueries(ctx),
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
