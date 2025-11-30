"use server";

import { openai } from "@ai-sdk/openai";
import { getStorageFileUrl, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  ContentType,
  Locale,
  Status,
  type WebshopProducts,
} from "@repo/api/types/appwrite";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type {
  CreateProductData,
  ListProductsParams,
  ProductTranslation,
  ProductWithTranslations,
  UpdateProductData,
} from "@/lib/types/product";
import {
  normalizeProductRow,
  PRODUCT_SELECT_FIELDS,
} from "./_utils/translatable";

type AdminDbClient = Awaited<ReturnType<typeof createSessionClient>>["db"];
type ProductStatus = CreateProductData["status"];

const PRODUCT_STATUS_MAP: Record<ProductStatus, Status> = {
  draft: Status.DRAFT,
  published: Status.PUBLISHED,
  archived: Status.ARCHIVED,
};

const mapProductStatus = (status: ProductStatus): Status =>
  PRODUCT_STATUS_MAP[status] ?? Status.ARCHIVED;

const serializeMetadata = (
  metadata: CreateProductData["metadata"] | UpdateProductData["metadata"]
) => (metadata ? JSON.stringify(metadata) : null);

const BASE_UPDATE_FIELDS: (keyof UpdateProductData)[] = [
  "slug",
  "campus_id",
  "category",
  "regular_price",
  "member_price",
  "member_only",
  "stock",
  "image",
];

const collectBaseProductUpdates = (data: UpdateProductData) => {
  const updateData: Record<string, unknown> = {};

  for (const field of BASE_UPDATE_FIELDS) {
    const value = data[field];
    if (value !== undefined) {
      updateData[field] = value;
    }
  }

  if (data.status !== undefined) {
    updateData.status = mapProductStatus(data.status);
  }

  if (data.metadata !== undefined) {
    updateData.metadata = serializeMetadata(data.metadata);
  }

  return updateData;
};

const buildTranslationRefsForUpdate = async (
  db: AdminDbClient,
  id: string,
  translations: UpdateProductData["translations"] | undefined
) => {
  if (!translations) {
    return;
  }

  const existingProduct = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [
      Query.equal("$id", id),
      Query.select(["translation_refs.$id", "translation_refs.locale"]),
      Query.limit(1),
    ]
  );

  const existingTranslations = existingProduct.rows[0]?.translation_refs ?? [];
  const existingTranslationsArray = Array.isArray(existingTranslations)
    ? existingTranslations.filter(
        (translation): translation is ContentTranslations =>
          typeof translation !== "string"
      )
    : [];

  const buildTranslation = (
    locale: Locale,
    translation: ProductTranslation
  ): ContentTranslations => {
    const existing = existingTranslationsArray.find(
      (item) => item.locale === locale
    );

    return {
      ...(existing?.$id ? { $id: existing.$id } : {}),
      content_type: ContentType.PRODUCT,
      content_id: id,
      locale,
      title: translation.title,
      description: translation.description,
    } as ContentTranslations;
  };

  return [
    buildTranslation(Locale.EN, translations.en),
    buildTranslation(Locale.NO, translations.no),
  ];
};

export async function listProducts(
  params: ListProductsParams = {}
): Promise<ProductWithTranslations[]> {
  try {
    const { db } = await createSessionClient();

    const queries = [
      Query.select([...PRODUCT_SELECT_FIELDS]),
      Query.orderDesc("$createdAt"),
    ];

    if (params.status) {
      queries.push(Query.equal("status", params.status));
    }

    if (params.campus_id) {
      queries.push(Query.equal("campus_id", params.campus_id));
    }

    if (params.category) {
      queries.push(Query.equal("category", params.category));
    }

    if (params.member_only !== undefined) {
      queries.push(Query.equal("member_only", params.member_only));
    }

    if (typeof params.stock_min === "number") {
      queries.push(Query.greaterThanEqual("stock", params.stock_min));
    }

    if (typeof params.stock_max === "number") {
      queries.push(Query.lessThanEqual("stock", params.stock_max));
    }

    if (typeof params.price_min === "number") {
      queries.push(Query.greaterThanEqual("regular_price", params.price_min));
    }

    if (typeof params.price_max === "number") {
      queries.push(Query.lessThanEqual("regular_price", params.price_max));
    }

    if (params.limit) {
      queries.push(Query.limit(params.limit));
    }

    if (params.offset) {
      queries.push(Query.offset(params.offset));
    }

    if (params.search?.trim()) {
      queries.push(Query.search("slug", params.search.trim()));
    }

    const response = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      queries
    );
    return response.rows.map(normalizeProductRow);
  } catch (error) {
    console.error("Error listing products:", error);
    return [];
  }
}

export async function getProduct(
  id: string
): Promise<ProductWithTranslations | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      [
        Query.equal("$id", id),
        Query.limit(1),
        Query.select([...PRODUCT_SELECT_FIELDS]),
      ]
    );

    const product = response.rows[0];

    if (!product) {
      return null;
    }

    return normalizeProductRow(product);
  } catch (error) {
    console.error("Error getting product:", error);
    return null;
  }
}

async function _getProductBySlug(
  slug: string
): Promise<ProductWithTranslations | null> {
  try {
    const { db } = await createSessionClient();

    const productsResponse = await db.listRows<WebshopProducts>(
      "app",
      "webshop_products",
      [
        Query.equal("slug", slug),
        Query.limit(1),
        Query.select([...PRODUCT_SELECT_FIELDS]),
      ]
    );

    const product = productsResponse.rows[0];

    if (!product) {
      return null;
    }

    return normalizeProductRow(product);
  } catch (error) {
    console.error("Error getting product by slug:", error);
    return null;
  }
}

export async function createProduct(
  data: CreateProductData,
  skipRevalidation = false
): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient();
    const statusValue = mapProductStatus(data.status);

    // Build translation_refs array with both required translations
    const translationRefs: ContentTranslations[] = [
      {
        content_type: ContentType.PRODUCT,
        content_id: "unique()",
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.description,
      } as ContentTranslations,
      {
        content_type: ContentType.PRODUCT,
        content_id: "unique()",
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.description,
      } as ContentTranslations,
    ];

    const product = await db.createRow<WebshopProducts>(
      "app",
      "webshop_products",
      "unique()",
      {
        slug: data.slug,
        status: statusValue,
        campus_id: data.campus_id,
        // Top-level database fields (required by schema)
        category: data.category,
        regular_price: data.regular_price,
        member_price: data.member_price ?? null,
        member_only: data.member_only ?? false,
        stock: data.stock ?? null,
        image: data.image ?? null,
        // Additional metadata
        metadata: serializeMetadata(data.metadata),
        // Relationship fields
        campus: data.campus_id,
        departmentId: null,
        department: null,
        translation_refs: translationRefs,
      } as any
    );

    if (!skipRevalidation) {
      revalidatePath("/shop");
      revalidatePath("/admin/products");
    }

    return product;
  } catch (error) {
    console.error("Error creating product:", error);
    return null;
  }
}

export async function updateProduct(
  id: string,
  data: UpdateProductData,
  skipRevalidation = false
): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient();

    const updateData = collectBaseProductUpdates(data);
    const translationRefs = await buildTranslationRefsForUpdate(
      db,
      id,
      data.translations
    );

    if (translationRefs) {
      updateData.translation_refs = translationRefs;
    }

    const product = await db.updateRow<WebshopProducts>(
      "app",
      "webshop_products",
      id,
      updateData
    );

    if (!skipRevalidation) {
      revalidatePath("/shop");
      revalidatePath("/admin/products");
    }

    return product ?? null;
  } catch (error) {
    console.error("Error updating product:", error);
    return null;
  }
}

export async function deleteProduct(
  id: string,
  skipRevalidation = false
): Promise<boolean> {
  try {
    const { db } = await createSessionClient();

    // Delete the product (translations will be deleted automatically due to cascade)
    await db.deleteRow("app", "webshop_products", id);

    if (!skipRevalidation) {
      revalidatePath("/shop");
      revalidatePath("/admin/products");
    }

    return true;
  } catch (error) {
    console.error("Error deleting product:", error);
    return false;
  }
}

async function _updateProductStatus(
  id: string,
  status: "draft" | "published" | "archived",
  skipRevalidation = false
): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient();
    const statusValue = mapProductStatus(status);

    const product = await db.updateRow<WebshopProducts>(
      "app",
      "webshop_products",
      id,
      {
        status: statusValue,
      }
    );

    if (!skipRevalidation) {
      revalidatePath("/shop");
      revalidatePath("/admin/products");
    }

    return product ?? null;
  } catch (error) {
    console.error("Error updating product status:", error);
    return null;
  }
}

export async function bulkUpdateProductStatus(
  productIds: string[],
  status: "draft" | "published" | "archived"
) {
  if (!productIds.length) {
    return { success: false, error: "No products selected" };
  }

  try {
    const { db } = await createSessionClient();
    const statusValue = mapProductStatus(status);

    await Promise.all(
      productIds.map((id) =>
        db.updateRow<WebshopProducts>("app", "webshop_products", id, {
          status: statusValue,
        })
      )
    );

    revalidateProductPaths();
    return { success: true };
  } catch (error) {
    console.error("Error bulk updating product status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

export async function bulkUpdateProductPrices(
  productIds: string[],
  options: { mode: "percent" | "absolute"; value: number }
) {
  if (!productIds.length) {
    return { success: false, error: "No products selected" };
  }
  if (!Number.isFinite(options.value)) {
    return { success: false, error: "Invalid value" };
  }

  try {
    const { db } = await createSessionClient();
    await Promise.all(
      productIds.map(async (id) => {
        const product = await db.getRow<WebshopProducts>(
          "app",
          "webshop_products",
          id
        );
        const currentPrice = Number(product?.regular_price ?? 0);
        let nextPrice =
          options.mode === "percent"
            ? currentPrice * (1 + options.value / 100)
            : options.value;
        nextPrice = Number.isFinite(nextPrice)
          ? Math.max(0, Number(nextPrice.toFixed(2)))
          : currentPrice;

        await db.updateRow<WebshopProducts>("app", "webshop_products", id, {
          regular_price: nextPrice,
        });
      })
    );

    revalidateProductPaths();
    return { success: true };
  } catch (error) {
    console.error("Error bulk updating product prices:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update prices",
    };
  }
}

export async function bulkUpdateProductStock(
  productIds: string[],
  options: { mode: "set" | "adjust"; value: number }
) {
  if (!productIds.length) {
    return { success: false, error: "No products selected" };
  }
  if (!Number.isFinite(options.value)) {
    return { success: false, error: "Invalid value" };
  }

  try {
    const { db } = await createSessionClient();
    await Promise.all(
      productIds.map(async (id) => {
        const product = await db.getRow<WebshopProducts>(
          "app",
          "webshop_products",
          id
        );
        const currentStock =
          typeof product?.stock === "number" ? product.stock : 0;
        let nextStock =
          options.mode === "set" ? options.value : currentStock + options.value;

        nextStock = Number.isFinite(nextStock)
          ? Math.max(0, Math.floor(nextStock))
          : currentStock;

        await db.updateRow<WebshopProducts>("app", "webshop_products", id, {
          stock: nextStock,
        });
      })
    );

    revalidateProductPaths();
    return { success: true };
  } catch (error) {
    console.error("Error bulk updating product stock:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update stock",
    };
  }
}

function revalidateProductPaths() {
  revalidatePath("/admin/shop/products");
  revalidatePath("/admin/shop");
  revalidatePath("/shop");
}

// AI Translation function
export async function translateProductContent(
  content: ProductTranslation,
  fromLocale: "en" | "no",
  toLocale: "en" | "no"
): Promise<ProductTranslation | null> {
  try {
    const targetLanguage = toLocale === "en" ? "English" : "Norwegian";
    const sourceLanguage = fromLocale === "en" ? "English" : "Norwegian";

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: z.object({
        title: z.string(),
        description: z.string(),
      }),
      prompt: `Translate the following product content from ${sourceLanguage} to ${targetLanguage}. 
      Maintain the same tone and marketing appeal. For product descriptions, keep technical specifications 
      and measurements in their original format but translate the descriptive text.
      
      Title: ${content.title}
      Description: ${content.description}
      
      Provide the translation in ${targetLanguage}.`,
    });

    return {
      title: result.object.title,
      description: result.object.description,
    };
  } catch (error) {
    console.error("Error translating product content:", error);
    return null;
  }
}

// Get products for public pages (published only)
function _getProducts(
  _status: "in-stock" | "all" = "all",
  locale: "en" | "no" = "en"
): Promise<ProductWithTranslations[]> {
  return listProducts({
    status: "published",
    locale,
    limit: 50,
  });
}

const PRODUCT_IMAGE_BUCKET =
  process.env.APPWRITE_PRODUCT_BUCKET_ID || "product-images";

export async function uploadProductImage(formData: FormData) {
  const file = formData.get("file");
  if (!(file && file instanceof File)) {
    throw new Error("No file provided");
  }

  const { storage } = await createSessionClient();
  const uploaded = await storage.createFile(
    PRODUCT_IMAGE_BUCKET,
    "unique()",
    file
  );
  const url = getStorageFileUrl(PRODUCT_IMAGE_BUCKET, uploaded.$id);
  return { id: uploaded.$id, url };
}
