import { mapWithConcurrency } from "../concurrency";
import type { WpClient } from "../wp/client";

export interface WpJob {
  campus: string[];
  content: string;
  date_posted: string;
  department: string[];
  expiry_date: string | null;
  id: number;
  is_expired: boolean;
  job_type: string | null;
  location: string | null;
  slug: string;
  thumbnail: unknown[];
  title: string;
  url: string;
  verv: string[];
}

export interface WpJobPost {
  content: { rendered: string };
  date: string;
  /**
   * The site's local `date` has no timezone suffix, so `new Date(post.date)`
   * parses it in the *host machine's* local time. `date_gmt` is always UTC
   * and is what the `--since` cutoff must be compared against so the
   * extraction window doesn't depend on which machine runs it.
   */
  date_gmt: string;
  id: number;
  link: string;
  /** UTC last-modified counterpart of `date_gmt`; backdates `$updatedAt`. */
  modified_gmt: string;
  slug: string;
  status: string;
  title: { rendered: string };
}

export interface WpProductPost {
  acf: Record<string, string | false>;
  content: { rendered: string };
  /** UTC publish date; backdates `$createdAt`. See `wpGmtToIso`. */
  date_gmt: string;
  id: number;
  /** UTC last-modified date; backdates `$updatedAt`. */
  modified_gmt: string;
  slug: string;
  status: string;
  title: { rendered: string };
}

export interface WcStoreProduct {
  categories: Array<{ id: number; name: string; slug: string }>;
  description: string;
  id: number;
  images: Array<{ alt: string; id: number; src: string }>;
  name: string;
  prices: {
    currency_minor_unit: number;
    price: string;
    price_range: { max_amount: string; min_amount: string } | null;
  };
  short_description: string;
  slug: string;
  type: string;
  variations: Array<{
    attributes: Array<{ name: string; value: string }>;
    id: number;
  }>;
}

/**
 * A variation from `/wc/v3/products/<id>/variations`, which — unlike the
 * Store API's `variations` (id + attributes only) — carries real prices,
 * stock and ordering. Note the attribute value lives in `option` here, where
 * the Store API calls it `value`.
 */
export interface WcProductVariation {
  attributes: Array<{ name: string; option: string }>;
  id: number;
  menu_order: number;
  /** Effective price; falls back for a variation with no explicit regular_price. */
  price: string;
  regular_price: string;
  sku: string;
  status: string;
  stock_quantity: number | null;
}

export interface WcOrder {
  billing: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  currency: string;
  /**
   * WooCommerce's `date_created` is site-local with no timezone suffix; the
   * `_gmt` variants are UTC and are the ones that may be trusted on any host.
   * These backdate `$createdAt` / `$updatedAt` — the `orders` table has no
   * date column of its own.
   */
  date_created_gmt: string;
  date_modified_gmt: string;
  discount_total: string;
  id: number;
  line_items: Array<{
    /** WooCommerce line-item id — the stable half of the order_items row id. */
    id: number;
    name: string;
    price: number;
    product_id: number;
    quantity: number;
    total: string;
    /** 0 when the line is not a variation of a variable product. */
    variation_id: number;
  }>;
  payment_method_title: string;
  status: string;
  total: string;
}

const RELATIVE_WINDOW = /^(\d+)([dmy])$/;

export function parseSince(value: string, now: Date): string {
  if (value === "all") {
    return new Date(0).toISOString();
  }

  const relative = RELATIVE_WINDOW.exec(value);
  if (relative) {
    const amount = Number.parseInt(relative[1] ?? "0", 10);
    const unit = relative[2];
    const date = new Date(now.getTime());
    if (unit === "d") {
      date.setUTCDate(date.getUTCDate() - amount);
    } else if (unit === "m") {
      date.setUTCMonth(date.getUTCMonth() - amount);
    } else {
      date.setUTCFullYear(date.getUTCFullYear() - amount);
    }
    return date.toISOString();
  }

  const explicit = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(explicit.getTime())) {
    throw new Error(`Unrecognised --since value: ${value}`);
  }
  return explicit.toISOString();
}

/**
 * Jobs need two sources joined on the post id: /custom/v1/jobs is the only
 * endpoint that resolves the campus/verv taxonomies (they are not registered
 * with show_in_rest), and /wp/v2/awsm_job_openings is the only source of the
 * raw post content and date.
 */
export async function extractJobs(
  client: WpClient,
  sinceIso: string
): Promise<Array<WpJob & { post: WpJobPost }>> {
  const posts = await client.fetchAllPages<WpJobPost>(
    "/wp/v2/awsm_job_openings"
  );
  const postsById = new Map(posts.map((post) => [post.id, post]));

  const custom: WpJob[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const body = await client.fetchJson<{
      jobs: WpJob[];
      pagination: { total_pages: number };
    }>("/custom/v1/jobs", {
      includeExpired: "true",
      page: String(page),
      per_page: "100",
    });
    custom.push(...body.jobs);
    totalPages = body.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);

  const since = new Date(sinceIso).getTime();

  return custom.flatMap((job) => {
    const post = postsById.get(job.id);
    if (!post) {
      return [];
    }
    if (new Date(`${post.date_gmt}Z`).getTime() < since) {
      return [];
    }
    return [{ ...job, post }];
  });
}

export type ExtractedProduct = WpProductPost & {
  store: WcStoreProduct | null;
  variations: WcProductVariation[];
};

/**
 * Products need three sources: /wp/v2/product carries the ACF
 * campus/department IDs, /wc/store/v1/products carries the base price and
 * images, and /wc/v3/products/<id>/variations carries per-variation prices.
 *
 * That third call is per-product and only meaningful for `type: "variable"`,
 * so it is fanned out through a bounded pool rather than walked serially. It
 * needs WooCommerce credentials; without them `includeVariations` must be
 * false or every request 401s.
 */
export async function extractProducts(
  client: WpClient,
  options: { concurrency?: number; includeVariations?: boolean } = {}
): Promise<ExtractedProduct[]> {
  const posts = await client.fetchAllPages<WpProductPost>("/wp/v2/product");
  const store = await client.fetchAllPages<WcStoreProduct>(
    "/wc/store/v1/products"
  );
  const storeById = new Map(store.map((product) => [product.id, product]));

  const merged = posts.map((post) => ({
    ...post,
    store: storeById.get(post.id) ?? null,
  }));

  if (!options.includeVariations) {
    return merged.map((post) => ({ ...post, variations: [] }));
  }

  const variable = merged.filter((post) => post.store?.type === "variable");
  const fetched = await mapWithConcurrency(
    variable,
    options.concurrency ?? 4,
    async (post) =>
      [
        post.id,
        await client.fetchAllPages<WcProductVariation>(
          `/wc/v3/products/${post.id}/variations`
        ),
      ] as const
  );
  const variationsById = new Map(fetched);

  return merged.map((post) => ({
    ...post,
    variations: variationsById.get(post.id) ?? [],
  }));
}

export async function extractOrders(client: WpClient): Promise<WcOrder[]> {
  return await client.fetchAllPages<WcOrder>("/wc/v3/orders", {
    // Offset paging over the default `date desc` sort is unstable: an order
    // placed mid-extract shifts every later page by one, silently skipping a
    // record. Sorting by the immutable id pins the window instead.
    order: "asc",
    orderby: "id",
    status: "any",
  });
}
