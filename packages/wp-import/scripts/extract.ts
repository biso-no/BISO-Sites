import { mkdir, writeFile } from "node:fs/promises";
import {
  extractJobs,
  extractOrders,
  extractProducts,
  parseSince,
} from "../src/extract/index";
import { WpClient } from "../src/wp/client";

const args = new Set(process.argv.slice(2));
const sinceArg =
  process.argv
    .slice(2)
    .find((a) => a.startsWith("--since="))
    ?.split("=")[1] ?? "3m";
const only = (name: string): boolean =>
  args.has(`--${name}`) ||
  !(args.has("--jobs") || args.has("--products") || args.has("--orders"));

const baseUrl = process.env.WP_BASE_URL ?? "https://biso.no";
const client = new WpClient({
  baseUrl,
  consumerKey: process.env.WC_CONSUMER_KEY,
  consumerSecret: process.env.WC_CONSUMER_SECRET,
});

const outputDir = new URL("../snapshots/", import.meta.url).pathname;
await mkdir(outputDir, { recursive: true });

const since = parseSince(sinceArg, new Date());
console.log(`Extracting from ${baseUrl} (since ${since})`);

const write = async (name: string, data: unknown): Promise<void> => {
  await writeFile(`${outputDir}${name}.json`, JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : 0;
  console.log(`  ${name}: ${count} records → snapshots/${name}.json`);
};

if (only("jobs")) {
  await write("jobs", await extractJobs(client, since));
}
if (only("products")) {
  await write("products", await extractProducts(client));
}
if (only("orders")) {
  if (process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET) {
    await write("orders", await extractOrders(client));
  } else {
    console.error(
      "Orders need WC_CONSUMER_KEY and WC_CONSUMER_SECRET in .env — skipping."
    );
  }
}
