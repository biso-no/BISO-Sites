import { readFile } from "node:fs/promises";
import { ID, Storage } from "node-appwrite";
import {
  clientFromEnv,
  createDb,
  loadContentTranslationIds,
} from "../src/appwrite";
import {
  buildJobUpsert,
  buildProductUpsert,
  buildTranslationRows,
  type TranslationPayload,
} from "../src/load/index";
import { mirrorImage } from "../src/media";
import {
  buildJobPermissions,
  buildPublicContentPermissions,
} from "../src/permissions";
import type { TransformedJob } from "../src/transform/jobs";
import {
  detectLocale,
  otherLocale,
  translateFields,
} from "../src/transform/locale";
import type { TransformedProduct } from "../src/transform/products";

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
  jobs: TransformedJob[];
  orders: Array<{ row: Record<string, unknown>; rowId: string }>;
  products: TransformedProduct[];
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
  // Read-only, so fetched unconditionally (dry run or --apply) — a second
  // `load --jobs --apply` must resume by upserting existing rows in place,
  // not colliding on content_translations' uniq_content_locale index.
  const existingJobTranslationIds = await loadContentTranslationIds(db, "job");

  let succeeded = 0;
  let failed = 0;
  for (const job of payload.jobs) {
    try {
      const status = String(job.row.status);
      const target = otherLocale(job.sourceLocale);
      const translationInput = {
        contentId: job.rowId,
        contentType: "job",
        existingIds: existingJobTranslationIds,
        permissions: buildJobPermissions(status),
        source: {
          description: job.descriptionHtml,
          locale: job.sourceLocale,
          shortDescription: job.shortDescription || null,
          title: job.title,
        },
      };

      let translations: TranslationPayload[];
      if (apply) {
        // Only spend a real gpt-5-nano call once the operator has committed
        // to applying the import — a dry run must be free to inspect.
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
        translations = buildTranslationRows({
          ...translationInput,
          target: {
            description: translated.description || job.descriptionHtml,
            locale: target,
            shortDescription: translated.short_description || null,
            title: translated.title || job.title,
          },
        });
      } else {
        console.log(
          `  [dry-run] jobs/${job.rowId}: ${job.sourceLocale}->${target} translation will be generated on --apply`
        );
        translations = buildTranslationRows({
          ...translationInput,
          target: null,
        });
      }

      await upsert("jobs", job.rowId, buildJobUpsert(job, translations));
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(`  job ${job.rowId} failed: ${String(error)}`);
    }
  }
  console.log(`Jobs: ${succeeded} succeeded, ${failed} failed`);
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

  // Same resume guarantee as the jobs branch above.
  const existingProductTranslationIds = await loadContentTranslationIds(
    db,
    "product"
  );

  let succeeded = 0;
  let failed = 0;
  for (const product of payload.products) {
    try {
      const status = String(product.row.status);

      // Mirror images BEFORE writing the row, so no imported row ever points
      // at biso.no.
      const fileIds: string[] = [];
      if (apply) {
        for (const url of product.imageUrls) {
          try {
            fileIds.push(
              await mirrorImage(
                { cache: mediaCache, upload: uploadToMedia },
                url
              )
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
      const translationInput = {
        contentId: product.rowId,
        contentType: "product",
        existingIds: existingProductTranslationIds,
        permissions: buildPublicContentPermissions(status),
        source: {
          description: product.descriptionHtml,
          locale: detection.locale,
          shortDescription: product.shortDescription || null,
          title: product.title,
        },
      };

      let translations: TranslationPayload[];
      if (apply) {
        // Only spend a real gpt-5-nano call once the operator has committed
        // to applying the import — a dry run must be free to inspect.
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
        translations = buildTranslationRows({
          ...translationInput,
          target: {
            description: translated.description || product.descriptionHtml,
            locale: target,
            shortDescription: translated.short_description || null,
            title: translated.title || product.title,
          },
        });
      } else {
        console.log(
          `  [dry-run] webshop_products/${product.rowId}: ${detection.locale}->${target} translation will be generated on --apply`
        );
        translations = buildTranslationRows({
          ...translationInput,
          target: null,
        });
      }

      const row = {
        ...product.row,
        ...(fileIds.length > 0 ? { image: fileIds[0], images: fileIds } : {}),
      };

      await upsert(
        "webshop_products",
        product.rowId,
        buildProductUpsert({ row, rowId: product.rowId }, translations)
      );
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(`  product ${product.rowId} failed: ${String(error)}`);
    }
  }
  console.log(`Products: ${succeeded} succeeded, ${failed} failed`);
}

if (wants("orders")) {
  let succeeded = 0;
  let failed = 0;
  for (const order of payload.orders) {
    try {
      await upsert("orders", order.rowId, order.row);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(`  order ${order.rowId} failed: ${String(error)}`);
    }
  }
  console.log(`Orders: ${succeeded} succeeded, ${failed} failed`);
}
