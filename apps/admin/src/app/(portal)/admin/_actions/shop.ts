"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  getUserAuthContext,
  type UserAuthContext,
} from "@/lib/authorization";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";
import type {
  WebshopProducts,
  ContentTranslations,
  WebshopProductStatus,
} from "@repo/api/types/appwrite";
import { productSchema, type ProductFormValues } from "./schemas";



async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) redirect("/auth/login");
  return ctx;
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
  let translations: ContentTranslations[] = [];

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
    translation_refs: translations.filter(
      (t) => t.content_id === product.$id
    ),
  }));
}

export async function getProduct(id: string) {
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [Query.equal("$id", id), Query.limit(1)]
  );
  const product = response.rows[0];
  if (!product) return null;

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

  assertWriteAccess(ctx, validated.data.campus_id);

  const { db } = await createSessionClient();

  const product = await db.createRow("app", "webshop_products", "unique()", {
    slug: validated.data.slug,
    status: "draft" as WebshopProductStatus,
    campus_id: validated.data.campus_id,
    departmentId: validated.data.department_id ?? null,
    category: validated.data.category ?? null,
    regular_price: validated.data.regular_price,
    member_price: validated.data.member_price ?? null,
    member_only: validated.data.member_only ?? false,
    image: validated.data.image || null,
    stock: validated.data.stock ?? null,
  });

  await db.createRow("app", "content_translations", "unique()", {
    content_id: product.$id,
    content_type: "product",
    locale: "no",
    title: validated.data.name,
    description: validated.data.description ?? "",
  });

  revalidatePath("/admin/shop");
  return { data: product.$id };
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
  if (!product) return { error: "Product not found" };

  assertWriteAccess(ctx, product.campus_id, product.departmentId);

  await db.updateRow("app", "webshop_products", id, {
    slug: validated.data.slug,
    status: validated.data.status as WebshopProductStatus,
    campus_id: validated.data.campus_id,
    departmentId: validated.data.department_id ?? null,
    category: validated.data.category ?? null,
    regular_price: validated.data.regular_price,
    member_price: validated.data.member_price ?? null,
    member_only: validated.data.member_only ?? false,
    image: validated.data.image || null,
    stock: validated.data.stock ?? null,
  });

  const existingTranslation = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "product"),
      Query.equal("content_id", id),
      Query.limit(1),
    ]
  );

  const translationData = {
    content_id: id,
    content_type: "product",
    locale: "no",
    title: validated.data.name,
    description: validated.data.description ?? "",
  };

  if (existingTranslation.rows[0]) {
    await db.updateRow(
      "app",
      "content_translations",
      existingTranslation.rows[0].$id,
      translationData
    );
  } else {
    await db.createRow(
      "app",
      "content_translations",
      "unique()",
      translationData
    );
  }

  revalidatePath("/admin/shop");
  revalidatePath(`/admin/shop/${id}`);
  return { data: id };
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
  if (!product) return { error: "Product not found" };

  assertWriteAccess(ctx, product.campus_id, product.departmentId);

  const translations = await db.listRows(
    "app",
    "content_translations",
    [Query.equal("content_type", "product"), Query.equal("content_id", id)]
  );
  await Promise.all(
    translations.rows.map((t) =>
      db.deleteRow("app", "content_translations", t.$id)
    )
  );
  await db.deleteRow("app", "webshop_products", id);

  revalidatePath("/admin/shop");
  return { data: true };
}
