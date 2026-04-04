import { Client, ID, Permission, Role, TablesDB } from "node-appwrite";
import { wcApi } from "./client";

const APPWRITE_ENDPOINT =
  process.env.APPWRITE_ENDPOINT || "https://appwrite.biso.no/v1";
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "dev";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;

const DATABASE_ID = "app";
const PRODUCTS_TABLE = "webshop_products";

const CAMPUS_DEPT_FIELD: Record<string, string> = {
  "1": "department_oslo",
  "2": "department_bergen",
  "3": "department_trondheim",
  "4": "department_stavanger",
  "5": "department_national",
};

interface WcMetaItem {
  id: number;
  key: string;
  value: string;
}

function getMeta(metaData: WcMetaItem[], key: string): string | null {
  return metaData.find((m) => m.key === key)?.value || null;
}

function extractCampusAndDepartment(metaData: WcMetaItem[]) {
  const campus = getMeta(metaData, "campus");
  if (!(campus && CAMPUS_DEPT_FIELD[campus])) {
    return { campus_id: null, departmentId: null };
  }
  const deptField = CAMPUS_DEPT_FIELD[campus];
  const departmentId = getMeta(metaData, deptField) || null;
  return { campus_id: campus, departmentId };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(str: string, max: number): string {
  if (str.length <= max) {
    return str;
  }
  return `${str.slice(0, max - 3)}...`;
}

async function migrateProducts(dryRun = false) {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setKey(APPWRITE_API_KEY);

  const db = new TablesDB(client);

  let page = 1;
  const perPage = 50;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let hasMore = true;

  console.log(
    `Starting WooCommerce → Appwrite product migration${dryRun ? " (DRY RUN)" : ""}...`
  );

  while (hasMore) {
    console.log(`\nFetching WC products page ${page}...`);

    // biome-ignore lint/suspicious/noExplicitAny: WC API types
    const response = await (wcApi as any).getProducts({
      page,
      per_page: perPage,
      status: "publish",
    });
    // biome-ignore lint/suspicious/noExplicitAny: WC API types
    const products: any[] = response.data;

    if (!products || products.length === 0) {
      hasMore = false;
      break;
    }

    for (const product of products) {
      try {
        const { campus_id, departmentId } = extractCampusAndDepartment(
          product.meta_data || []
        );

        if (!campus_id) {
          console.warn(
            `  SKIP  ${product.id} "${product.name}": missing campus meta`
          );
          totalSkipped++;
          continue;
        }

        const description = truncate(
          stripHtml(product.description || "") || product.name,
          7900
        );
        const shortDescription = product.short_description
          ? truncate(stripHtml(product.short_description), 3900)
          : null;

        const category = product.categories?.[0]?.slug ?? "uncategorized";
        const image: string | null = product.images?.[0]?.src ?? null;
        const price = Number.parseFloat(
          product.regular_price || product.price || "0"
        );

        const metadata = truncate(
          JSON.stringify({
            wc_id: product.id,
            sku: product.sku || null,
            type: product.type,
            on_sale: product.on_sale,
            woo_expiry_date:
              getMeta(product.meta_data, "woo_expiry_date") || null,
          }),
          1900
        );

        const productId = ID.unique();
        const permissions = [Permission.read(Role.any())];

        const translationRefs = [
          {
            content_id: productId,
            content_type: "product",
            locale: "no",
            title: product.name,
            description,
            short_description: shortDescription,
            $permissions: permissions,
          },
        ];

        const productData = {
          slug: product.slug,
          status: "published",
          campus_id,
          category,
          regular_price: price,
          member_price: null,
          member_only: false,
          image,
          stock: product.stock_quantity ?? null,
          metadata,
          campus: campus_id,
          department: departmentId,
          departmentId,
          translation_refs: translationRefs,
        };

        console.log(
          `  ${dryRun ? "DRY RUN" : "CREATE"} ${product.id} "${product.name}" ` +
            `(campus: ${campus_id}, dept: ${departmentId ?? "none"}, price: ${price})`
        );

        if (!dryRun) {
          await db.createRow(
            DATABASE_ID,
            PRODUCTS_TABLE,
            productId,
            productData,
            permissions
          );
        }

        totalMigrated++;
      } catch (err) {
        console.error(`  ERROR  product ${product.id} "${product.name}":`, err);
        totalSkipped++;
      }
    }

    hasMore = products.length === perPage;
    page++;
  }

  console.log(
    `\nDone. Migrated: ${totalMigrated}, Skipped/Errors: ${totalSkipped}`
  );
}

const dryRun = process.argv.includes("--dry-run");
await migrateProducts(dryRun);
