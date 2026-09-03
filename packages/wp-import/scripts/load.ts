import { readFile } from "node:fs/promises";
import { ID, Storage } from "node-appwrite";
import {
  clientFromEnv,
  createDb,
  loadContentTranslations,
} from "../src/appwrite";
import { mapWithConcurrency, parseConcurrency } from "../src/concurrency";
import {
  buildJobUpsert,
  buildOrderItemRows,
  buildProductCampusIndex,
  buildProductUpsert,
  buildTranslationRows,
  type ExistingTranslation,
  existingTargetContent,
  type LocaleContent,
  resolveOrderCampusId,
  type TranslationPayload,
} from "../src/load/index";
import { mirrorImage } from "../src/media";
import {
  buildJobPermissions,
  buildOrderPermissions,
  buildPublicContentPermissions,
} from "../src/permissions";
import { createProgressReporter } from "../src/progress";
import type { TransformedJob } from "../src/transform/jobs";
import {
  detectLocale,
  otherLocale,
  translateFields,
} from "../src/transform/locale";
import type { TransformedOrderItem } from "../src/transform/orders";
import type { TransformedProduct } from "../src/transform/products";

const CONTENT_FLAGS = ["jobs", "products", "orders"] as const;
/**
 * Rows processed in parallel. Jobs and products are paced by one OpenAI call
 * each, orders by Appwrite write latency; 6 keeps both providers comfortable
 * while turning a serial walk over the whole catalogue into a short one.
 */
const DEFAULT_CONCURRENCY = 6;

const argv = process.argv.slice(2);
const args = new Set(argv);
const apply = args.has("--apply");
const wants = (name: string): boolean => args.has(`--${name}`);
const concurrency = parseConcurrency(argv, DEFAULT_CONCURRENCY);

if (!CONTENT_FLAGS.some((flag) => wants(flag))) {
  console.error(
    `Nothing to load — pass at least one content flag: ${CONTENT_FLAGS.map((f) => `--${f}`).join(", ")} (add --apply to write; omit it for a dry run). Optional: --concurrency=N (default ${DEFAULT_CONCURRENCY}).`
  );
  process.exit(1);
}

// Validate Appwrite configuration before touching the filesystem, so a
// missing .env fails fast with a clear message instead of surfacing as an
// unrelated ENOENT on the snapshot read below.
const db = createDb();
console.log(
  `Mode: ${apply ? "APPLY" : "dry-run"} (concurrency ${concurrency})`
);

const root = new URL("../", import.meta.url).pathname;
const payload = JSON.parse(
  await readFile(`${root}snapshots/transformed.json`, "utf8")
) as {
  jobs: TransformedJob[];
  orders: Array<{
    items: TransformedOrderItem[];
    row: Record<string, unknown>;
    rowId: string;
  }>;
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

/**
 * Produces the `content_translations` rows for one piece of content, and says
 * whether the target locale came from a previous run.
 *
 * Translation is by far the most expensive thing the load does, so the order
 * of the branches matters: an existing target-locale row is reused verbatim,
 * a dry run never spends a call at all, and only a genuinely new row reaches
 * the model.
 */
const resolveTranslations = async (input: {
  /** "job vacancy" / "webshop product" — steers the translation prompt. */
  aiContentType: string;
  contentId: string;
  /** "job" / "product" — the content_translations discriminator. */
  contentType: string;
  existing: Map<string, ExistingTranslation>;
  label: string;
  permissions: string[];
  source: LocaleContent;
}): Promise<{ reused: boolean; rows: TranslationPayload[] }> => {
  const target = otherLocale(input.source.locale);
  const base = {
    contentId: input.contentId,
    contentType: input.contentType,
    existing: input.existing,
    permissions: input.permissions,
    source: input.source,
  };

  const alreadyTranslated = existingTargetContent(
    input.existing,
    input.contentId,
    target
  );
  if (alreadyTranslated) {
    return {
      reused: true,
      rows: buildTranslationRows({ ...base, target: alreadyTranslated }),
    };
  }

  if (!apply) {
    console.log(
      `  [dry-run] ${input.label}: ${input.source.locale}->${target} translation will be generated on --apply`
    );
    return {
      reused: false,
      rows: buildTranslationRows({ ...base, target: null }),
    };
  }

  const translated = await translateFields({
    contentType: input.aiContentType,
    fields: [
      { key: "title", value: input.source.title },
      { key: "description", value: input.source.description },
      { key: "short_description", value: input.source.shortDescription ?? "" },
    ],
    sourceLocale: input.source.locale,
    targetLocale: target,
  });

  return {
    reused: false,
    rows: buildTranslationRows({
      ...base,
      target: {
        description: translated.description || input.source.description,
        locale: target,
        shortDescription: translated.short_description || null,
        title: translated.title || input.source.title,
      },
    }),
  };
};

/** One row's outcome, tallied after the pool drains. */
interface RowOutcome {
  ok: boolean;
  reused: boolean;
}

const summarise = (outcomes: RowOutcome[]): string => {
  const succeeded = outcomes.filter((outcome) => outcome.ok).length;
  const reused = outcomes.filter((outcome) => outcome.reused).length;
  return `${succeeded} succeeded, ${outcomes.length - succeeded} failed, ${reused} reused an existing translation (no OpenAI call)`;
};

if (wants("jobs")) {
  // Read-only, so fetched unconditionally (dry run or --apply). Serves two
  // purposes: a second `load --jobs --apply` must resume by upserting existing
  // rows in place rather than colliding on content_translations'
  // uniq_content_locale index, and any translation it already generated is
  // reused instead of re-billed.
  const existingJobTranslations = await loadContentTranslations(db, "job");
  console.log(
    `Jobs: ${payload.jobs.length} rows to load, ${existingJobTranslations.size} translations already in Appwrite`
  );
  const progress = createProgressReporter({
    label: "jobs",
    total: payload.jobs.length,
  });

  const outcomes = await mapWithConcurrency<TransformedJob, RowOutcome>(
    payload.jobs,
    concurrency,
    async (job) => {
      try {
        const status = String(job.row.status);
        const { reused, rows } = await resolveTranslations({
          aiContentType: "job vacancy",
          contentId: job.rowId,
          contentType: "job",
          existing: existingJobTranslations,
          label: `jobs/${job.rowId}`,
          permissions: buildJobPermissions(status),
          source: {
            description: job.descriptionHtml,
            locale: job.sourceLocale,
            shortDescription: job.shortDescription || null,
            title: job.title,
          },
        });

        await upsert("jobs", job.rowId, buildJobUpsert(job, rows));
        progress.record(true);
        return { ok: true, reused };
      } catch (error) {
        console.error(`  job ${job.rowId} failed: ${String(error)}`);
        progress.record(false);
        return { ok: false, reused: false };
      }
    }
  );
  progress.finish();
  console.log(`Jobs: ${summarise(outcomes)}`);
}

if (wants("products")) {
  const storage = new Storage(clientFromEnv());
  const mediaCache = new Map<string, Promise<string>>();
  const uploadToMedia = async (file: File): Promise<{ $id: string }> =>
    await storage.createFile({
      bucketId: "media",
      fileId: ID.unique(),
      file,
    });

  // Same resume guarantee as the jobs branch above.
  const existingProductTranslations = await loadContentTranslations(
    db,
    "product"
  );
  console.log(
    `Products: ${payload.products.length} rows to load, ${existingProductTranslations.size} translations already in Appwrite`
  );
  const progress = createProgressReporter({
    label: "products",
    total: payload.products.length,
  });

  const outcomes = await mapWithConcurrency<TransformedProduct, RowOutcome>(
    payload.products,
    concurrency,
    async (product) => {
      try {
        const status = String(product.row.status);

        // Mirror images BEFORE writing the row, so no imported row ever points
        // at biso.no. mediaCache single-flights a url shared by two products
        // being mirrored at the same time.
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
        const { reused, rows } = await resolveTranslations({
          aiContentType: "webshop product",
          contentId: product.rowId,
          contentType: "product",
          existing: existingProductTranslations,
          label: `webshop_products/${product.rowId}`,
          permissions: buildPublicContentPermissions(status),
          source: {
            description: product.descriptionHtml,
            locale: detection.locale,
            shortDescription: product.shortDescription || null,
            title: product.title,
          },
        });

        const row = {
          ...product.row,
          ...(fileIds.length > 0 ? { image: fileIds[0], images: fileIds } : {}),
        };

        await upsert(
          "webshop_products",
          product.rowId,
          buildProductUpsert(
            { row, rowId: product.rowId, variations: product.variations },
            rows
          )
        );
        progress.record(true);
        return { ok: true, reused };
      } catch (error) {
        console.error(`  product ${product.rowId} failed: ${String(error)}`);
        progress.record(false);
        return { ok: false, reused: false };
      }
    }
  );
  progress.finish();
  console.log(`Products: ${summarise(outcomes)}`);
}

if (wants("orders")) {
  // Campus is derived from the ordered products' ACF campus — the data
  // already lives in snapshots/transformed.json, no extra Appwrite read.
  const productCampusByRowId = buildProductCampusIndex(payload.products);
  // Only products that actually made it through transform may be named by an
  // order_items relationship; see buildOrderItemRows.
  const importedProductRowIds = new Set(
    payload.products.map((product) => product.rowId)
  );
  // Same guard for the `variation` relationship. Only the non-member half of
  // a collapsed pair exists as a row, so a line item naming the member half
  // must stay unlinked rather than fail the whole order.
  const importedVariationRowIds = new Set(
    payload.products.flatMap((product) =>
      (product.variations ?? []).map((variation) => variation.rowId)
    )
  );

  console.log(`Orders: ${payload.orders.length} rows to load`);
  const progress = createProgressReporter({
    label: "orders",
    total: payload.orders.length,
  });

  // Orders never translate, so the pool here is purely about Appwrite write
  // latency — which is the whole cost of a 14k-row branch.
  const outcomes = await mapWithConcurrency(
    payload.orders,
    concurrency,
    async (order) => {
      try {
        const userId =
          typeof order.row.userId === "string" ? order.row.userId : null;
        const campusId = resolveOrderCampusId(
          order.items,
          productCampusByRowId
        );

        const permissions = buildOrderPermissions(userId);
        const itemRows = buildOrderItemRows(
          order.items,
          importedProductRowIds,
          importedVariationRowIds,
          permissions
        );

        await upsert("orders", order.rowId, {
          ...order.row,
          $permissions: permissions,
          campus_id: campusId,
          order_items: itemRows,
        });
        progress.record(true);
        return {
          ok: true,
          unlinkedItems: itemRows.filter((row) => !("product" in row)).length,
          unresolvedCampus: campusId ? 0 : 1,
        };
      } catch (error) {
        console.error(`  order ${order.rowId} failed: ${String(error)}`);
        progress.record(false);
        return { ok: false, unlinkedItems: 0, unresolvedCampus: 0 };
      }
    }
  );
  progress.finish();

  const succeeded = outcomes.filter((outcome) => outcome.ok).length;
  const unresolvedCampus = outcomes.reduce(
    (total, outcome) => total + outcome.unresolvedCampus,
    0
  );
  const unlinkedItems = outcomes.reduce(
    (total, outcome) => total + outcome.unlinkedItems,
    0
  );
  console.log(
    `Orders: ${succeeded} succeeded, ${outcomes.length - succeeded} failed, ${unresolvedCampus} without a resolvable campus_id, ${unlinkedItems} line items with no matching product row`
  );
}
