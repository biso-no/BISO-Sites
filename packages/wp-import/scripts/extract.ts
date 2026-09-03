import { mkdir, writeFile } from "node:fs/promises";
import { parseConcurrency } from "../src/concurrency";
import {
  extractJobs,
  extractOrders,
  extractProducts,
  parseSince,
} from "../src/extract/index";
import { WpClient, type WpProgressEvent } from "../src/wp/client";

const argv = process.argv.slice(2);
const args = new Set(argv);
const sinceArg =
  argv.find((a) => a.startsWith("--since="))?.split("=")[1] ?? "3m";
const only = (name: string): boolean =>
  args.has(`--${name}`) ||
  !(args.has("--jobs") || args.has("--products") || args.has("--orders"));

const baseUrl = process.env.WP_BASE_URL ?? "https://biso.no";
/**
 * Pages after the first are fetched in parallel. 4 is deliberately gentle on
 * biso.no; raise it with --concurrency=N if the host copes.
 */
const concurrency = parseConcurrency(argv, 4);

/**
 * Extraction is a long silent wait otherwise: the orders endpoint alone runs
 * to thousands of records across a hundred-plus pages, and without per-page
 * output there is no way to tell a slow endpoint from a stalled one.
 */
const reportProgress = (event: WpProgressEvent): void => {
  if (event.kind === "retry") {
    console.error(
      `    ${event.path} retry ${event.attempt}/${event.maxRetries}: ${event.reason} — backing off ${event.backoffMs}ms`
    );
    return;
  }
  const of = event.total === null ? "" : ` of ${event.total}`;
  console.log(
    `    ${event.path} page ${event.page}/${event.totalPages} — ${event.received}${of} records (${event.elapsedMs}ms)`
  );
};

const client = new WpClient({
  baseUrl,
  concurrency,
  consumerKey: process.env.WC_CONSUMER_KEY,
  consumerSecret: process.env.WC_CONSUMER_SECRET,
  onProgress: reportProgress,
});

const outputDir = new URL("../snapshots/", import.meta.url).pathname;
await mkdir(outputDir, { recursive: true });

const since = parseSince(sinceArg, new Date());
console.log(
  `Extracting from ${baseUrl} (since ${since}, concurrency ${concurrency})`
);

const write = async (name: string, data: unknown): Promise<void> => {
  await writeFile(`${outputDir}${name}.json`, JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : 0;
  console.log(`  ${name}: ${count} records → snapshots/${name}.json`);
};

if (only("jobs")) {
  await write("jobs", await extractJobs(client, since));
}
if (only("products")) {
  // Variation prices live behind /wc/v3, so without WooCommerce credentials
  // the per-product variation fetch would 401 on every request. Skip it and
  // say so rather than failing the whole products extract.
  const includeVariations = Boolean(
    process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET
  );
  if (!includeVariations) {
    console.error(
      "  products: no WooCommerce credentials — skipping variation prices; variable products will import without variations."
    );
  }
  await write(
    "products",
    await extractProducts(client, { concurrency, includeVariations })
  );
}
if (only("orders")) {
  if (process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET) {
    // --since scopes jobs only; orders are imported as a full historical
    // archive. Said out loud because the whole WooCommerce order history is
    // far more than an operator who just passed --since=3m expects.
    console.log(
      "  orders: --since does not apply — fetching the complete order history"
    );
    await write("orders", await extractOrders(client));
  } else {
    console.error(
      "Orders need WC_CONSUMER_KEY and WC_CONSUMER_SECRET in .env — skipping."
    );
  }
}
