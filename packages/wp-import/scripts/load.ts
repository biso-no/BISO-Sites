import { readFile } from "node:fs/promises";
import { ID, Storage } from "node-appwrite";
import { clientFromEnv, createDb } from "../src/appwrite";
import {
  buildJobUpsert,
  buildProductUpsert,
  buildTranslationRows,
} from "../src/load/index";
import { mirrorImage } from "../src/media";
import {
  buildJobPermissions,
  buildPublicContentPermissions,
} from "../src/permissions";
import {
  detectLocale,
  otherLocale,
  translateFields,
} from "../src/transform/locale";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const wants = (name: string): boolean => args.has(`--${name}`);

// Validate Appwrite configuration before touching the filesystem, so a
// missing .env fails fast with a clear message instead of surfacing as an
// unrelated ENOENT on the snapshot read below.
const db = createDb();
console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);

const root = new URL("../", import.meta.url).pathname;
const payload = JSON.parse(
  await readFile(`${root}snapshots/transformed.json`, "utf8")
) as {
  jobs: Record<string, never>[];
  orders: Array<{ row: Record<string, unknown>; rowId: string }>;
  products: Record<string, never>[];
};

const upsert = async (
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<void> => {
  if (!apply) {
    console.log(`  would upsert ${tableId}/${rowId}`);
    return;
  }
  // db.upsertRow takes row permissions as a dedicated `permissions` request
  // field, not as a `$permissions` column inside `data` — none of jobs,
  // webshop_products or content_translations has a `$permissions` column, so
  // leaving it nested in `data` would either be silently dropped or rejected
  // as an unknown attribute. Pull it back out here before writing.
  const { $permissions, ...rest } = data;
  await db.upsertRow({
    data: rest,
    databaseId: "app",
    permissions: Array.isArray($permissions)
      ? ($permissions as string[])
      : undefined,
    rowId,
    tableId,
  });
};

if (wants("jobs")) {
  for (const job of payload.jobs as unknown as Array<{
    descriptionHtml: string;
    row: Record<string, unknown>;
    rowId: string;
    shortDescription: string;
    sourceLocale: "no" | "en";
    title: string;
  }>) {
    const status = String(job.row.status);
    const target = otherLocale(job.sourceLocale);
    const translated = await translateFields({
      contentType: "job vacancy",
      fields: [
        { key: "title", value: job.title },
        { key: "description", value: job.descriptionHtml },
        { key: "short_description", value: job.shortDescription },
      ],
      sourceLocale: job.sourceLocale,
      targetLocale: target,
    });

    const translations = buildTranslationRows({
      contentId: job.rowId,
      contentType: "job",
      permissions: buildJobPermissions(status),
      source: {
        description: job.descriptionHtml,
        locale: job.sourceLocale,
        shortDescription: job.shortDescription || null,
        title: job.title,
      },
      target: {
        description: translated.description || job.descriptionHtml,
        locale: target,
        shortDescription: translated.short_description || null,
        title: translated.title || job.title,
      },
    });

    await upsert("jobs", job.rowId, buildJobUpsert(job, translations));
  }
  console.log(`Jobs: ${payload.jobs.length}`);
}

if (wants("products")) {
  const storage = new Storage(clientFromEnv());
  const mediaCache = new Map<string, string>();
  const uploadToMedia = async (file: File): Promise<{ $id: string }> =>
    await storage.createFile({
      bucketId: "media",
      fileId: ID.unique(),
      file,
    });

  for (const product of payload.products as unknown as Array<{
    descriptionHtml: string;
    imageUrls: string[];
    row: Record<string, unknown>;
    rowId: string;
    shortDescription: string;
    title: string;
  }>) {
    const status = String(product.row.status);

    // Mirror images BEFORE writing the row, so no imported row ever points at
    // biso.no.
    const fileIds: string[] = [];
    if (apply) {
      for (const url of product.imageUrls) {
        try {
          fileIds.push(
            await mirrorImage({ cache: mediaCache, upload: uploadToMedia }, url)
          );
        } catch (error) {
          console.error(
            `  image failed for ${product.rowId}: ${String(error)}`
          );
        }
      }
    }

    const detection = detectLocale(
      `${product.title} ${product.descriptionHtml}`
    );
    const target = otherLocale(detection.locale);
    const translated = await translateFields({
      contentType: "webshop product",
      fields: [
        { key: "title", value: product.title },
        { key: "description", value: product.descriptionHtml },
        { key: "short_description", value: product.shortDescription },
      ],
      sourceLocale: detection.locale,
      targetLocale: target,
    });

    const translations = buildTranslationRows({
      contentId: product.rowId,
      contentType: "product",
      permissions: buildPublicContentPermissions(status),
      source: {
        description: product.descriptionHtml,
        locale: detection.locale,
        shortDescription: product.shortDescription || null,
        title: product.title,
      },
      target: {
        description: translated.description || product.descriptionHtml,
        locale: target,
        shortDescription: translated.short_description || null,
        title: translated.title || product.title,
      },
    });

    const row = {
      ...product.row,
      ...(fileIds.length > 0 ? { image: fileIds[0], images: fileIds } : {}),
    };

    await upsert(
      "webshop_products",
      product.rowId,
      buildProductUpsert({ row, rowId: product.rowId }, translations)
    );
  }
  console.log(`Products: ${payload.products.length}`);
}

if (wants("orders")) {
  for (const order of payload.orders) {
    await upsert("orders", order.rowId, order.row);
  }
  console.log(`Orders: ${payload.orders.length}`);
}
