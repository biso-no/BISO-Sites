/**
 * One-off repair for products saved while `member_only` set the row ACL.
 *
 * Until this branch, `buildProductPermissions` derived the audience from
 * `member_only`, so a members-only product and its `content_translations` rows
 * were granted `read("team:<members>")` instead of `read("any")`. Members-only
 * now limits who can BUY a product, not who can see it, so those rows should
 * carry `read("any")` like every other published product.
 *
 * THIS IS NOT URGENT, and running it will not change anything a visitor can
 * see. Both tables still carry a table-level `read("any")`, and Appwrite's row
 * security is additive — a row is readable if the table grants it OR the row
 * does — so the stale ACLs are inert today. This is insurance for the day the
 * table-level grants are removed (`packages/api/content-permission-cutover.ts`),
 * at which point those rows would abruptly become members-only for real and
 * every members-only product would vanish from the shop.
 *
 * Because the effect is invisible, do not try to validate this by watching the
 * storefront — check the `$permissions` it prints instead. Saving each affected
 * product in the CMS fixes it too; this script exists so nobody has to remember
 * which ones.
 *
 * Dry run (default) prints what it would change and writes nothing:
 *
 *   APPWRITE_API_KEY=… bun scripts/repair-member-only-product-permissions.mjs
 *
 * Apply:
 *
 *   APPWRITE_API_KEY=… bun scripts/repair-member-only-product-permissions.mjs --apply
 *
 * Only ever *widens* read access on published members-only products, and only
 * to `read("any")` — the access those rows would get if saved in the CMS today.
 * Unpublished rows are left alone: their empty ACL is correct.
 */
import { Client, Permission, Query, Role, TablesDB } from "node-appwrite";

const DATABASE_ID = "app";
const PRODUCTS_TABLE = "webshop_products";
const TRANSLATIONS_TABLE = "content_translations";
const PAGE_SIZE = 100;

const apply = process.argv.includes("--apply");

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT;
const project =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!(endpoint && project && apiKey)) {
  console.error(
    "Missing configuration. Need NEXT_PUBLIC_APPWRITE_ENDPOINT (or APPWRITE_ENDPOINT), NEXT_PUBLIC_APPWRITE_PROJECT (or APPWRITE_PROJECT_ID) and APPWRITE_API_KEY."
  );
  process.exit(1);
}

const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);

const PUBLIC_READ = Permission.read(Role.any());

/** A row whose ACL grants read to a team rather than to anyone. */
function needsRepair(row) {
  const permissions = row.$permissions ?? [];
  return (
    !permissions.includes(PUBLIC_READ) &&
    permissions.some((entry) => entry.startsWith('read("team:'))
  );
}

/** Keep every non-read grant, and replace the read grants with `read(any)`. */
function repairedPermissions(row) {
  const kept = (row.$permissions ?? []).filter(
    (entry) => !entry.startsWith("read(")
  );
  return [...kept, PUBLIC_READ];
}

async function* listAll(tableId, queries) {
  let cursor = null;
  while (true) {
    const page = [...queries, Query.limit(PAGE_SIZE)];
    if (cursor) {
      page.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: page,
    });
    if (rows.length === 0) {
      return;
    }
    for (const row of rows) {
      yield row;
    }
    if (rows.length < PAGE_SIZE) {
      return;
    }
    cursor = rows.at(-1).$id;
  }
}

async function repairRow(tableId, row, label) {
  rowsScanned += 1;
  if (Array.isArray(row.$permissions) && row.$permissions.length > 0) {
    sawPermissions = true;
  }
  if (!needsRepair(row)) {
    return false;
  }
  console.log(
    `${apply ? "fixing " : "would fix"} ${label}: ${JSON.stringify(row.$permissions)} -> ["${PUBLIC_READ}"]`
  );
  if (apply) {
    await db.updateRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId: row.$id,
      permissions: repairedPermissions(row),
    });
  }
  return true;
}

let productsFixed = 0;
let translationsFixed = 0;
// A zero count is only trustworthy if the rows actually came back with their
// ACLs. If `$permissions` is absent from the projection, every row looks clean
// and the run would report "nothing to do" for the wrong reason.
let sawPermissions = false;
let rowsScanned = 0;

for await (const product of listAll(PRODUCTS_TABLE, [
  Query.equal("member_only", true),
  Query.equal("status", "published"),
  Query.select(["$id", "$permissions", "slug"]),
])) {
  const label = `product ${product.slug ?? product.$id}`;
  if (await repairRow(PRODUCTS_TABLE, product, label)) {
    productsFixed += 1;
  }

  for await (const translation of listAll(TRANSLATIONS_TABLE, [
    Query.equal("content_type", "product"),
    Query.equal("content_id", product.$id),
    Query.select(["$id", "$permissions", "locale"]),
  ])) {
    const translationLabel = `  translation ${translation.locale ?? translation.$id} of ${label}`;
    if (await repairRow(TRANSLATIONS_TABLE, translation, translationLabel)) {
      translationsFixed += 1;
    }
  }
}

if (rowsScanned > 0 && !sawPermissions) {
  console.error(
    `\nRefusing to report a result: read ${rowsScanned} row(s) and not one came back with a non-empty $permissions array.\n` +
      "That almost certainly means this Appwrite version drops $permissions from a Query.select() projection, " +
      "in which case every row looks clean and a count of 0 means nothing. Remove the Query.select() calls and re-run."
  );
  process.exit(2);
}

console.log(
  apply
    ? `Done. Repaired ${productsFixed} product row(s) and ${translationsFixed} translation row(s).`
    : `Dry run. ${productsFixed} product row(s) and ${translationsFixed} translation row(s) would be repaired. Re-run with --apply to write.`
);
