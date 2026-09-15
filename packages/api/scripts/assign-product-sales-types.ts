/**
 * Assigns a sales type to every existing webshop product and archives the two
 * legacy products. Dry-run by default; pass --apply to write.
 *
 * Run AFTER the sales types exist (admin → Regnskap → "Opprett standard
 * salgstyper") and AFTER the accountant has confirmed the Varesalg bucket.
 *
 * Usage (from packages/api):
 *   bun run finago:assign-sales-types
 *   bun run finago:assign-sales-types -- --apply
 */
import { Client, Query, TablesDB } from "node-appwrite";
import {
  PRODUCT_SALES_TYPES,
  planProductUpdates,
} from "./product-sales-type-map";

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
const project =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!(endpoint && project && apiKey)) {
  console.error(
    "Missing Appwrite configuration: need NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT, and APPWRITE_API_KEY."
  );
  process.exit(2);
}

const apply = process.argv.includes("--apply");
const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);

for (const salesTypeId of Object.keys(PRODUCT_SALES_TYPES)) {
  const row = await db
    .getRow({ databaseId: "app", rowId: salesTypeId, tableId: "sales_types" })
    .catch(() => null);
  if (!row || (row as { active?: boolean }).active === false) {
    console.error(
      `Sales type "${salesTypeId}" is missing or inactive. Create the default sales types in admin first.`
    );
    process.exit(1);
  }
}

const products = await db.listRows({
  databaseId: "app",
  queries: [Query.select(["$id", "sales_type", "status"]), Query.limit(500)],
  tableId: "webshop_products",
});
const plan = planProductUpdates(
  products.rows as unknown as Array<{
    $id: string;
    sales_type: string | null;
    status: string;
  }>
);

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`${apply ? "Assigning" : "Would assign"}: ${plan.assign.length}`);
for (const change of plan.assign) {
  console.log(`  ${change.id}: ${change.from ?? "—"} → ${change.to}`);
}
console.log(`${apply ? "Archiving" : "Would archive"}: ${plan.archive.length}`);
for (const id of plan.archive) {
  console.log(`  ${id}`);
}
if (plan.unmapped.length > 0) {
  console.log(`Not in the map (left untouched): ${plan.unmapped.length}`);
  for (const id of plan.unmapped) {
    console.log(`  ${id}`);
  }
}

if (apply) {
  for (const change of plan.assign) {
    await db.updateRow({
      data: { sales_type: change.to },
      databaseId: "app",
      rowId: change.id,
      tableId: "webshop_products",
    });
  }
  for (const id of plan.archive) {
    await db.updateRow({
      data: { status: "archived" },
      databaseId: "app",
      rowId: id,
      tableId: "webshop_products",
    });
  }
  console.log("Done.");
}
